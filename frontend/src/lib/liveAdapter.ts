import {
  createClient,
  deriveExternalMessageCallKey,
  isSuccessful,
  MessageType,
} from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createClient as createStableReadClient } from "genlayer-stable";
import { studionet as stableStudionet } from "genlayer-stable/chains";
import { ExecutionResult } from "genlayer-js/types";
import type { CalldataEncodable, Hash, MessageFeeAllocationInput } from "genlayer-js/types";
import type { Hex } from "viem";
import { manifestMethod } from "./interfaceManifest";
import { buildAction, type WriteAction } from "./domain";
import { feeEstimateOptions, messageAllocationFor } from "./feeProfile";
import { validateSharedWorkflowArgs } from "./serialization";
import {
  BUYER_ROLE_ADDRESS,
  LIVE_CHAIN_ID,
  LIVE_CONTRACT,
  LIVE_NETWORK,
  LIVE_RPC,
  SUPPLIER_ROLE_ADDRESS,
  liveV1WriteBlockReason,
  sameAddress,
  type Address,
} from "./liveConfig";
import type { TransactionRecord } from "./transactions";

export type LiveRole = "buyer" | "supplier" | "party" | "permissionless";
export type RoleContext = { buyer?: Address; supplier?: Address };
export type BrowserProvider = {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
};

export const methodRoles: Record<string, LiveRole> = {
  create_tender: "buyer",
  add_requirement: "buyer",
  add_certification_requirement: "buyer",
  freeze_tender: "buyer",
  fund_tender: "buyer",
  cancel_tender: "buyer",
  submit_bid: "permissionless",
  add_bid_evidence: "supplier",
  begin_bid_evaluation: "buyer",
  adjudicate_requirement: "buyer",
  finalize_bid_evaluation: "buyer",
  award_bid: "buyer",
  accept_award: "supplier",
  post_supplier_bond: "supplier",
  create_delivery: "supplier",
  add_delivery_evidence: "supplier",
  begin_inspection: "buyer",
  adjudicate_delivery: "buyer",
  accept_delivery: "buyer",
  reject_delivery: "buyer",
  release_milestone: "buyer",
  settle_award: "buyer",
  refund_buyer: "buyer",
  open_dispute: "party",
  resolve_dispute: "buyer",
};

export type TypedAction = WriteAction & {
  kwargs: Record<string, unknown>;
};

export type LiveClient = ReturnType<typeof createClient>;

export type StoredLiveTransaction = TransactionRecord & {
  address: Address;
  account: Address;
  value?: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const memoryStorage = new Map<string, string>();
const fallbackStorage: StorageLike = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => { memoryStorage.set(key, value); },
  removeItem: (key) => { memoryStorage.delete(key); },
};

function storageOrFallback(storage?: StorageLike): StorageLike {
  return storage ?? (typeof window !== "undefined" ? window.localStorage : fallbackStorage);
}

export function createLiveReadClient(): LiveClient {
  // The hosted Studionet RPC rejects RC gen_call reads; the pinned stable client
  // returns canonical V2.1.2 contract state. Keep the RC signer isolated.
  return createStableReadClient({ chain: stableStudionet, endpoint: LIVE_RPC }) as unknown as LiveClient;
}

export function createLiveWalletClient(address: Address, provider: BrowserProvider): LiveClient {
  type ClientConfig = NonNullable<Parameters<typeof createClient>[0]>;
  // Studionet is served by the stable SDK; RC wallet writes target a different
  // transport protocol and can fail even when the transaction is valid.
  return createStableReadClient({
    chain: stableStudionet,
    endpoint: LIVE_RPC,
    account: address,
    provider: provider as ClientConfig["provider"],
  }) as unknown as LiveClient;
}

export async function assertStudioDevWallet(provider: BrowserProvider, expectedAddress?: Address): Promise<Address> {
  const chainId = await provider.request({ method: "eth_chainId" });
  const numericChainId = typeof chainId === "string" ? (chainId.startsWith("0x") ? Number.parseInt(chainId, 16) : Number(chainId)) : Number(chainId);
  if (numericChainId !== LIVE_CHAIN_ID) throw new Error(`Wrong network: expected ${LIVE_NETWORK} (${LIVE_CHAIN_ID}), received ${numericChainId}`);
  const accounts = await provider.request({ method: "eth_accounts" });
  const address = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof address !== "string") throw new Error("Wallet disconnected");
  if (expectedAddress && !sameAddress(address, expectedAddress)) throw new Error(`Wrong wallet: expected ${expectedAddress}`);
  return address as Address;
}

export function requiredRole(method: string): LiveRole {
  return methodRoles[method] ?? "permissionless";
}

export function assertRole(method: string, account: Address, context: { buyer?: Address; supplier?: Address }): void {
  const role = requiredRole(method);
  const buyer = context.buyer ?? BUYER_ROLE_ADDRESS;
  const supplier = context.supplier ?? SUPPLIER_ROLE_ADDRESS;
  const isBuyer = sameAddress(account, buyer);
  const isSupplier = sameAddress(account, supplier);
  if (role === "buyer" && !isBuyer) throw new Error(`${method} requires the buyer wallet`);
  if (role === "supplier" && !isSupplier) throw new Error(`${method} requires the supplier wallet`);
  if (role === "party" && !isBuyer && !isSupplier) throw new Error(`${method} requires a frozen buyer or supplier wallet`);
}

function normalizeActionValue(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("numeric contract values must be non-negative safe integers; use bigint for large values");
    return BigInt(value);
  }
  if (Array.isArray(value)) return value.map(normalizeActionValue);
  return value;
}

export function buildTypedAction(
  method: string,
  kwargs: Record<string, unknown>,
  options: { requestId: string; value?: bigint | number | string } = { requestId: crypto.randomUUID() },
): TypedAction {
  const manifest = manifestMethod(method);
  if (manifest.kind !== "write") throw new Error(`${method} is not writable`);
  const expected = [...manifest.arguments];
  const received = Object.keys(kwargs);
  const missing = expected.filter((key) => !(key in kwargs));
  const extra = received.filter((key) => !expected.includes(key));
  if (missing.length || extra.length) throw new Error(`${method} kwargs mismatch; missing=${missing.join(",")} extra=${extra.join(",")}`);
  const normalized = Object.fromEntries(expected.map((key) => [key, normalizeActionValue(kwargs[key])]));
  validateSharedWorkflowArgs(method, normalized);
  const action = buildAction(method, expected.map((key) => normalized[key]), options);
  return { ...action, kwargs: normalized };
}

export function externalAllocation(method: string, canonicalRecipient: Address): MessageFeeAllocationInput[] {
  const allocation = messageAllocationFor(method, canonicalRecipient);
  if (allocation.length !== 1 || allocation[0].messageType !== MessageType.External) {
    throw new Error(`${method} must have exactly one external message allocation`);
  }
  const data = "0x" as Hex;
  const expectedCallKey = deriveExternalMessageCallKey(data);
  if (allocation[0].callKey !== expectedCallKey) throw new Error(`${method} external call key does not match its data`);
  return allocation;
}

export interface LiveWriteParams {
  client: LiveClient;
  action: TypedAction;
  account: Address;
  signingProvider?: BrowserProvider;
  canonicalRecipient?: Address;
  roleContext?: RoleContext;
  storage?: StorageLike;
  readPrecondition?: () => Promise<RoleContext | void>;
  canonicalReadback: () => Promise<unknown>;
}

export interface LiveWriteResult {
  action: TypedAction;
  hash: `0x${string}`;
  receipt: unknown;
  readback: unknown;
  fees?: Awaited<ReturnType<LiveClient["estimateTransactionFees"]>>;
}

function recordKey(requestId: string): string { return `procura:live-tx:${requestId}`; }
const transactionIndexKey = "procura:live-tx-index";

function persistedTransactionIds(storage: StorageLike): string[] {
  const raw = storage.getItem(transactionIndexKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch { return []; }
}

function persistedTransactions(storage: StorageLike): StoredLiveTransaction[] {
  return persistedTransactionIds(storage).map((requestId) => loadPendingTransaction(requestId, storage)).filter((record): record is StoredLiveTransaction => Boolean(record));
}

function sameAction(record: StoredLiveTransaction, action: TypedAction, account: Address): boolean {
  const recordArgs = record.args.map((value) => String(value));
  const actionArgs = action.args.map((value) => String(value));
  const recordValue = record.value ?? "0";
  const actionValue = action.value?.toString() ?? "0";
  return typeof record.account === "string" && record.account.toLowerCase() === account.toLowerCase() && record.method === action.method && recordValue === actionValue && recordArgs.length === actionArgs.length && recordArgs.every((value, index) => value === actionArgs[index]);
}

function persistPending(storage: StorageLike, action: TypedAction, account: Address, hash: `0x${string}`): void {
  const record: StoredLiveTransaction = {
    requestId: action.requestId,
    method: action.method,
    args: [...action.args] as unknown as CalldataEncodable[],
    txHash: hash,
    phase: "PERSIST_HASH",
    address: LIVE_CONTRACT,
    account,
    value: action.value?.toString(),
  };
  storage.setItem(recordKey(action.requestId), JSON.stringify(record, (_, value) => typeof value === "bigint" ? value.toString() : value));
  const ids = persistedTransactionIds(storage);
  if (!ids.includes(action.requestId)) storage.setItem(transactionIndexKey, JSON.stringify([...ids, action.requestId]));
}

function updatePending(storage: StorageLike, requestId: string, patch: Partial<StoredLiveTransaction>): void {
  const current = loadPendingTransaction(requestId, storage);
  if (!current) return;
  storage.setItem(recordKey(requestId), JSON.stringify({ ...current, ...patch }, (_, value) => typeof value === "bigint" ? value.toString() : value));
}

export function loadPendingTransaction(requestId: string, storage?: StorageLike): StoredLiveTransaction | null {
  const raw = storageOrFallback(storage).getItem(recordKey(requestId));
  return raw ? JSON.parse(raw) as StoredLiveTransaction : null;
}

/**
 * Studionet stable SDK 1.1.8 uses getTransaction rather than the RC helper.
 * Require finalized, successful consensus execution. A timeout is ambiguous:
 * the caller must reconcile the persisted hash, NEVER rebroadcast.
 */
async function waitForStudionetFinalization(client: LiveClient, hash: Hash) {
  const stable = client as unknown as {
    getTransaction?: (args: { hash: Hash }) => Promise<Record<string, unknown>>;
    waitForFinalization?: (args: { hash: Hash; fullTransaction: true }) => Promise<unknown>;
  };
  if (!stable.getTransaction && stable.waitForFinalization) {
    return stable.waitForFinalization({ hash, fullTransaction: true }) as Promise<Awaited<ReturnType<LiveClient["waitForFinalization"]>>>;
  }
  if (!stable.getTransaction) throw new Error("Studionet transaction lookup unavailable; reconcile the persisted hash");
  for (let i = 0; i < 45; i += 1) {
    const tx = await stable.getTransaction({ hash });
    if (tx.statusName === "FINALIZED") {
      const consensus = tx.consensus_data as {
        leader_receipt?: Array<{ result?: { status?: string } }>;
        validators?: Array<{ execution_result?: string }>;
      } | undefined;
      const success = tx.result_name === "MAJORITY_AGREE"
        && consensus?.leader_receipt?.[0]?.result?.status === "return"
        && (consensus.validators?.filter((v) => v.execution_result === "SUCCESS").length ?? 0) > 0
        && !consensus.validators?.some((v) => v.execution_result === "ERROR");
      return {
        ...tx,
        txExecutionResultName: success ? ExecutionResult.FINISHED_WITH_RETURN : ExecutionResult.FINISHED_WITH_ERROR,
      } as Awaited<ReturnType<LiveClient["waitForFinalization"]>>;
    }
    if (tx.statusName === "CANCELED" || tx.statusName === "UNDETERMINED") throw new Error("Studionet transaction did not finalize successfully: " + String(hash));
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Studionet finality timed out; reconcile the same persisted hash before any further write: " + String(hash));
}

export async function executeLiveWrite(params: LiveWriteParams): Promise<LiveWriteResult> {
  const blockedReason = liveV1WriteBlockReason(params.action.method);
  if (blockedReason) throw new Error(blockedReason);
  const { client, action, account, canonicalRecipient, canonicalReadback } = params;
  const storage = storageOrFallback(params.storage);
  if (client.chain.id !== LIVE_CHAIN_ID) throw new Error(`Client chain mismatch: expected ${LIVE_CHAIN_ID}`);
  const existing = loadPendingTransaction(action.requestId, storage);
  if (existing && !sameAction(existing, action, account)) {
    throw new Error(`request ${action.requestId} already has a different persisted transaction; refusing a duplicate broadcast`);
  }
  const prior = existing ?? persistedTransactions(storage).find((record) => sameAction(record, action, account));
  if (prior?.txHash) {
    const receipt = await waitForStudionetFinalization(client, prior.txHash as Hash);
    if (!isSuccessful(receipt) || receipt.statusName !== "FINALIZED" || receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
      updatePending(storage, prior.requestId, { phase: "EXECUTION_STATUS", finality: receipt.statusName === "FINALIZED" ? "FINALIZED" : "UNDETERMINED", execution: "ERROR" });
      throw new Error(`${action.method} recovered transaction failed: ${String(receipt.statusName ?? "UNKNOWN_STATUS")} / ${String(receipt.txExecutionResultName ?? "UNKNOWN_EXECUTION")}`);
    }
    const readback = await canonicalReadback();
    updatePending(storage, prior.requestId, { phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" });
    return { action, hash: prior.txHash as `0x${string}`, receipt, readback };
  }
  const preconditionContext = params.readPrecondition ? await params.readPrecondition() : undefined;
  assertRole(action.method, account, { ...(params.roleContext ?? {}), ...(preconditionContext ?? {}) });

  // Stable Studionet accepts regular SDK writes, while the preview fee estimator
  // calls sim_getFeeConfig, which this hosted RPC does not implement.
  // Only enable the proven no-fee write route after authenticated wallet preflight.
  if (params.signingProvider) {
    const payoutMethods = ["cancel_tender", "settle_award", "refund_buyer", "release_milestone", "resolve_dispute"];
    if (payoutMethods.includes(action.method)) {
      throw new Error("External transfers require a verified Studionet message-fee policy before LIVE execution.");
    }
    const hash = await client.writeContract({
      address: LIVE_CONTRACT,
      functionName: action.method,
      args: [...action.args] as unknown as CalldataEncodable[],
      value: action.value ?? 0n,
    }) as Hash;
    persistPending(storage, action, account, hash);
    updatePending(storage, action.requestId, { phase: "RECONCILE_SAME_HASH" });
    const receipt = await waitForStudionetFinalization(client, hash);
    if (!isSuccessful(receipt) || receipt.statusName !== "FINALIZED" || receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
      updatePending(storage, action.requestId, { phase: "EXECUTION_STATUS", finality: receipt.statusName === "FINALIZED" ? "FINALIZED" : "UNDETERMINED", execution: "ERROR" });
      throw new Error(`${action.method} execution failed: ${String(receipt.statusName ?? "UNKNOWN_STATUS")} / ${String(receipt.txExecutionResultName ?? "UNKNOWN_EXECUTION")}`);
    }
    updatePending(storage, action.requestId, { phase: "FINALITY", finality: "FINALIZED" });
    updatePending(storage, action.requestId, { phase: "EXECUTION_STATUS", finality: "FINALIZED", execution: "SUCCESS" });
    updatePending(storage, action.requestId, { phase: "CANONICAL_READBACK" });
    const readback = await canonicalReadback();
    updatePending(storage, action.requestId, { phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" });
    return { action, hash, receipt, readback };
  }

  const allocation = ["cancel_tender", "settle_award", "refund_buyer"].includes(action.method)
    ? externalAllocation(action.method, canonicalRecipient ?? (() => { throw new Error(`${action.method} requires canonical recipient`); })())
    : undefined;
  const estimateOptions = feeEstimateOptions(action.method, canonicalRecipient);
  const preflight = await client.simulateWriteContract({
    address: LIVE_CONTRACT,
    functionName: action.method,
    args: [...action.args] as unknown as CalldataEncodable[],
    value: action.value ?? 0n,
  });
  void preflight;
  const fees = await client.estimateTransactionFees({ ...estimateOptions, messageAllocations: allocation ?? estimateOptions.messageAllocations });
  if (fees.feeValue <= 0n) throw new Error(`${action.method} feeValue must be positive`);
  if (allocation && (!fees.messageAllocations || fees.messageAllocations.length !== 1 || fees.distribution.totalMessageFees <= 0n)) {
    throw new Error(`${action.method} fee estimate lost its external message allocation`);
  }
  const hash = await client.writeContract({
    address: LIVE_CONTRACT,
    functionName: action.method,
    args: [...action.args] as unknown as CalldataEncodable[],
    value: action.value ?? 0n,
    fees: { distribution: fees.distribution, feeValue: fees.feeValue, messageAllocations: fees.messageAllocations },
  }) as Hash;
  persistPending(storage, action, account, hash);
  updatePending(storage, action.requestId, { phase: "RECONCILE_SAME_HASH" });
  const receipt = await waitForStudionetFinalization(client, hash);
  if (!isSuccessful(receipt) || receipt.statusName !== "FINALIZED" || receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    updatePending(storage, action.requestId, { phase: "EXECUTION_STATUS", finality: receipt.statusName === "FINALIZED" ? "FINALIZED" : "UNDETERMINED", execution: "ERROR" });
    throw new Error(`${action.method} execution failed: ${String(receipt.statusName ?? "UNKNOWN_STATUS")} / ${String(receipt.txExecutionResultName ?? "UNKNOWN_EXECUTION")}`);
  }
  updatePending(storage, action.requestId, { phase: "FINALITY", finality: "FINALIZED" });
  updatePending(storage, action.requestId, { phase: "EXECUTION_STATUS", finality: "FINALIZED", execution: "SUCCESS" });
  updatePending(storage, action.requestId, { phase: "CANONICAL_READBACK" });
  const readback = await canonicalReadback();
  updatePending(storage, action.requestId, { phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" });
  return { action, hash, receipt, readback, fees };
}

export async function recoverLiveTransaction(params: {
  client: LiveClient;
  record: StoredLiveTransaction;
  canonicalReadback: () => Promise<unknown>;
  storage?: StorageLike;
}): Promise<{ hash: `0x${string}`; receipt: unknown; readback: unknown }> {
  if (params.client.chain.id !== LIVE_CHAIN_ID) throw new Error(`Client chain mismatch: expected ${LIVE_CHAIN_ID}`);
  if (params.record.address !== LIVE_CONTRACT) throw new Error(`Persisted transaction targets an unexpected contract: ${params.record.address}`);
  if (!params.record.txHash) throw new Error("No persisted transaction hash to recover");
  const receipt = await waitForStudionetFinalization(params.client, params.record.txHash as Hash);
  if (!isSuccessful(receipt) || receipt.statusName !== "FINALIZED" || receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Recovered transaction execution failed: ${String(receipt.statusName ?? "UNKNOWN_STATUS")} / ${String(receipt.txExecutionResultName ?? "UNKNOWN_EXECUTION")}`);
  }
  const readback = await params.canonicalReadback();
  if (params.storage) updatePending(params.storage, params.record.requestId, { phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" });
  return { hash: params.record.txHash as Hash, receipt, readback };
}
