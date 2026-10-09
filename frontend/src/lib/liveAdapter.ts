import {
  createClient,
  deriveExternalMessageCallKey,
  MessageType,
} from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { ExecutionResult } from "genlayer-js/types";
import type { CalldataEncodable, Hash, MessageFeeAllocationInput } from "genlayer-js/types";
import type { Hex } from "viem";
import { manifestMethod } from "./interfaceManifest";
import { buildAction, type WriteAction } from "./domain";
import { feeEstimateOptions, messageAllocationFor } from "./feeProfile";
import {
  BUYER_ROLE_ADDRESS,
  LIVE_CHAIN_ID,
  LIVE_CONTRACT,
  LIVE_NETWORK,
  LIVE_RPC,
  SUPPLIER_ROLE_ADDRESS,
  sameAddress,
  type Address,
} from "./liveConfig";
import type { TransactionRecord } from "./transactions";

export type LiveRole = "buyer" | "supplier" | "party" | "permissionless";
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
  return createClient({ chain: studioDevnet });
}

export function createLiveWalletClient(address: Address, provider: BrowserProvider): LiveClient {
  type ClientConfig = NonNullable<Parameters<typeof createClient>[0]>;
  const config: ClientConfig = { chain: studioDevnet, account: address, provider: provider as ClientConfig["provider"] };
  return createClient(config);
}

export async function assertStudioDevWallet(provider: BrowserProvider, expectedAddress?: Address): Promise<Address> {
  const chainId = await provider.request({ method: "eth_chainId" });
  const numericChainId = typeof chainId === "string" ? Number.parseInt(chainId, 16) : Number(chainId);
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
    if (!Number.isInteger(value) || value < 0) throw new Error("numeric contract values must be non-negative integers");
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
  canonicalRecipient?: Address;
  storage?: StorageLike;
  readPrecondition?: () => Promise<void>;
  canonicalReadback: () => Promise<unknown>;
}

export interface LiveWriteResult {
  action: TypedAction;
  hash: `0x${string}`;
  receipt: unknown;
  readback: unknown;
  fees: Awaited<ReturnType<LiveClient["estimateTransactionFees"]>>;
}

function recordKey(requestId: string): string { return `procura:live-tx:${requestId}`; }

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

export async function executeLiveWrite(params: LiveWriteParams): Promise<LiveWriteResult> {
  const { client, action, account, canonicalRecipient, canonicalReadback } = params;
  assertRole(action.method, account, {});
  if (client.chain.id !== LIVE_CHAIN_ID) throw new Error(`Client chain mismatch: expected ${LIVE_CHAIN_ID}`);
  if (params.readPrecondition) await params.readPrecondition();

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
  persistPending(storageOrFallback(params.storage), action, account, hash);
  const receipt = await client.waitForFinalization({ hash, fullTransaction: true });
  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    updatePending(storageOrFallback(params.storage), action.requestId, { phase: "EXECUTION_STATUS", finality: "FINALIZED", execution: "ERROR" });
    throw new Error(`${action.method} execution failed: ${String(receipt.txExecutionResultName)}`);
  }
  updatePending(storageOrFallback(params.storage), action.requestId, { phase: "FINALITY", finality: "FINALIZED", execution: "SUCCESS" });
  const readback = await canonicalReadback();
  updatePending(storageOrFallback(params.storage), action.requestId, { phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" });
  return { action, hash, receipt, readback, fees };
}

export async function recoverLiveTransaction(params: {
  client: LiveClient;
  record: StoredLiveTransaction;
  canonicalReadback: () => Promise<unknown>;
}): Promise<{ hash: `0x${string}`; receipt: unknown; readback: unknown }> {
  if (!params.record.txHash) throw new Error("No persisted transaction hash to recover");
  const receipt = await params.client.waitForFinalization({ hash: params.record.txHash as Hash, fullTransaction: true });
  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`Recovered transaction execution failed: ${String(receipt.txExecutionResultName)}`);
  }
  return { hash: params.record.txHash as Hash, receipt, readback: await params.canonicalReadback() };
}
