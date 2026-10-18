import { createClient as createStableReadClient } from "genlayer-stable";
import { studionet as stableStudionet } from "genlayer-stable/chains";
import { ExecutionResult } from "genlayer-stable/types";
import type { CalldataEncodable, Hash } from "genlayer-stable/types";
import { manifestMethod } from "./interfaceManifest";
import { buildAction, type WriteAction } from "./domain";
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

export type LiveClient = ReturnType<typeof createStableReadClient>;

type SubmissionHook = (hash: Hash) => Promise<void> | void;
const submissionHookArms = new WeakMap<object, (hook: SubmissionHook | null) => boolean>();
const walletClientProviders = new WeakMap<object, BrowserProvider>();

function armSubmissionHook(client: LiveClient, hook: SubmissionHook | null): boolean {
  return submissionHookArms.get(client)?.(hook) ?? false;
}

export type StoredLiveTransaction = TransactionRecord & {
  address: Address;
  account: Address;
  value?: string;
  submissionHash?: string;
  evmTxHash?: string;
  genlayerTxId?: string;
  consensusStatus?: string;
  consensusResult?: string;
  trackingError?: string;
  finalizationPhase?: "BROADCAST_RESERVED" | "SUBMITTED" | "OUTCOME_UNKNOWN" | "UNAVAILABLE";
  finalizationTxHash?: string;
  finalizationError?: string;
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
  return createStableReadClient({ chain: stableStudionet, endpoint: LIVE_RPC });
}

export function createLiveWalletClient(address: Address, provider: BrowserProvider): LiveClient {
  type ClientConfig = NonNullable<Parameters<typeof createStableReadClient>[0]>;
  let onSubmitted: SubmissionHook | null = null;
  let broadcastReserved = false;
  const trackingProvider = {
    request: async (request: { method: string; params?: readonly unknown[] }) => {
      if (request.method === "eth_sendTransaction") {
        if (!onSubmitted) throw new Error("wallet broadcast is not armed by a persisted Procura request");
        if (broadcastReserved) throw new Error("stable SDK attempted a second wallet broadcast; reconcile the first transaction hash");
        broadcastReserved = true;
      }
      const result = await provider.request(request);
      if (request.method === "eth_sendTransaction") {
        if (typeof result !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result)) {
          throw new Error("wallet did not return a transaction hash; submission outcome must be reconciled before retrying");
        }
        await onSubmitted?.(result as Hash);
      }
      return result;
    },
  };
  const client = createStableReadClient({
    chain: stableStudionet,
    endpoint: LIVE_RPC,
    account: address,
    provider: trackingProvider as ClientConfig["provider"],
  });
  submissionHookArms.set(client, (hook) => {
    onSubmitted = hook;
    if (hook) broadcastReserved = false;
    return true;
  });
  walletClientProviders.set(client, provider);
  return client;
}

export async function assertStudionetWallet(provider: BrowserProvider, expectedAddress?: Address): Promise<Address> {
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

export interface LiveWriteParams {
  client: LiveClient;
  action: TypedAction;
  account: Address;
  signingProvider?: BrowserProvider;
  roleContext?: RoleContext;
  storage?: StorageLike;
  readPrecondition?: () => Promise<RoleContext | void>;
  canonicalReadback: () => Promise<unknown>;
  onTransactionUpdate?: (record: StoredLiveTransaction) => void;
}

export interface LiveWriteResult {
  action: TypedAction;
  hash: `0x${string}`;
  receipt: unknown;
  readback: unknown;
}

function successfulFinalizedExecution(receipt: unknown): boolean {
  if (typeof receipt !== "object" || receipt === null) return false;
  const result = receipt as { statusName?: unknown; txExecutionResultName?: unknown };
  return result.statusName === "FINALIZED" && result.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN;
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

function persistPending(storage: StorageLike, action: TypedAction, account: Address, hash?: `0x${string}`): void {
  const record: StoredLiveTransaction = {
    requestId: action.requestId,
    method: action.method,
    args: [...action.args] as unknown as CalldataEncodable[],
    ...(hash ? { txHash: hash, submissionHash: hash, evmTxHash: hash } : {}),
    phase: hash ? "PERSIST_HASH" : "BROADCAST_ONCE",
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
type TransactionProgress = (patch: Partial<StoredLiveTransaction>) => void | Promise<void>;
type StudionetReceipt = Record<string, unknown> & {
  statusName: string;
  txExecutionResultName: ExecutionResult;
};

function sameKnownHash(current: StoredLiveTransaction, hash: Hash): void {
  if (current.txHash && current.txHash.toLowerCase() !== hash.toLowerCase()) {
    throw new Error("wallet submission hash differs from the transaction journal; refusing a second broadcast");
  }
}

async function finalizeReadyTransaction(client: LiveClient, hash: Hash, storage: StorageLike, requestId: string, progress: TransactionProgress) {
  const current = loadPendingTransaction(requestId, storage);
  if (current?.finalizationPhase) return;
  const finalize = (client as unknown as { finalizeTransaction?: (args: { txId: Hash }) => Promise<Hash> }).finalizeTransaction;
  if (typeof finalize !== "function") {
    await progress({ finality: "READY_TO_FINALIZE", phase: "READY_TO_FINALIZE", finalizationPhase: "UNAVAILABLE", finalizationError: "Stable Studionet SDK has no finalizeTransaction action." });
    return;
  }
  await progress({ finality: "READY_TO_FINALIZE", phase: "READY_TO_FINALIZE", finalizationPhase: "BROADCAST_RESERVED", finalizationError: undefined });
  armSubmissionHook(client, async (finalizationTxHash) => {
    await progress({ finalizationTxHash, finalizationPhase: "SUBMITTED", finalizationError: undefined });
  });
  try {
    const finalizationTxHash = await finalize.call(client, { txId: current?.genlayerTxId as Hash ?? hash });
    await progress({ finalizationTxHash, finalizationPhase: "SUBMITTED", finalizationError: undefined });
  } catch (error) {
    // The wallet or RPC may have accepted the finalizer before the request timed out.
    // Keep tracking the same parent transaction and never send a second finalizer.
    await progress({ finalizationPhase: "OUTCOME_UNKNOWN", finalizationError: String(error instanceof Error ? error.message : error) });
  } finally {
    armSubmissionHook(client, null);
  }
}

export async function waitForStudionetFinalization(client: LiveClient, hash: Hash, progress: TransactionProgress = async () => undefined, onReady?: () => Promise<void>): Promise<StudionetReceipt> {
  const stable = client as unknown as {
    getTransaction?: (args: { hash: Hash }) => Promise<Record<string, unknown>>;
  };
  if (!stable.getTransaction) throw new Error("Studionet transaction lookup unavailable; reconcile the persisted hash");
  let delayMs = 3000;
  while (true) {
    let tx: Record<string, unknown>;
    try {
      tx = await stable.getTransaction({ hash });
    } catch (error) {
      await progress({ phase: "RECONCILE_SAME_HASH", finality: "PENDING", trackingError: String(error instanceof Error ? error.message : error) });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs + 3000, 30_000);
      continue;
    }
    const statusName = String(tx.statusName ?? tx.status_name ?? "PENDING");
    await progress({
      phase: statusName === "READY_TO_FINALIZE" ? "READY_TO_FINALIZE" : "RECONCILE_SAME_HASH",
      finality: statusName as StoredLiveTransaction["finality"],
      consensusStatus: statusName,
      consensusResult: String(tx.result_name ?? tx.resultName ?? ""),
      genlayerTxId: String(tx.tx_id ?? tx.txId ?? hash),
      evmTxHash: String(tx.hash ?? hash),
      submissionHash: String(tx.hash ?? hash),
      trackingError: "",
    });
    if (statusName === "READY_TO_FINALIZE" && onReady) await onReady();
    if (statusName === "FINALIZED") {
      const consensus = (tx.consensus_data ?? tx.consensusData) as {
        leader_receipt?: Array<{ execution_result?: string; executionResult?: string; result?: { status?: string } }>;
        validators?: Array<{ execution_result?: string; executionResult?: string; vote?: string; genvm_result?: { error_code?: string }; genvmResult?: { error_code?: string } }>;
      } | undefined;
      const leader = consensus?.leader_receipt?.[0];
      const validators = consensus?.validators ?? [];
      const successfulValidators = validators.filter((validator) => {
        const execution = validator.execution_result ?? validator.executionResult;
        return execution === "SUCCESS" || execution === "FINISHED_WITH_RETURN";
      });
      const invalidValidator = validators.some((validator) => {
        const execution = validator.execution_result ?? validator.executionResult;
        if (execution === "SUCCESS" || execution === "FINISHED_WITH_RETURN") return false;
        const idle = String(validator.vote ?? "").toLowerCase() === "idle";
        const errorCode = validator.genvm_result?.error_code ?? validator.genvmResult?.error_code;
        return !(idle && errorCode === "CONSENSUS_VALIDATOR_QUORUM_REACHED");
      });
      const resultName = String(tx.result_name ?? tx.resultName ?? "");
      const leaderExecution = leader?.execution_result ?? leader?.executionResult;
      const leaderSucceeded = (leaderExecution === "SUCCESS" || leaderExecution === "FINISHED_WITH_RETURN") && leader?.result?.status === "return";
      const success = resultName === "MAJORITY_AGREE" && leaderSucceeded && successfulValidators.length >= 2 && !invalidValidator;
      await progress({ phase: "EXECUTION_STATUS", finality: "FINALIZED", consensusStatus: "FINALIZED", consensusResult: resultName, execution: success ? "SUCCESS" : "ERROR" });
      return {
        ...tx,
        statusName,
        txExecutionResultName: success ? ExecutionResult.FINISHED_WITH_RETURN : ExecutionResult.FINISHED_WITH_ERROR,
      };
    }
    if (["CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(statusName)) {
      await progress({ phase: "EXECUTION_STATUS", finality: statusName as StoredLiveTransaction["finality"], consensusStatus: statusName, execution: "ERROR" });
      return { ...tx, statusName, txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs + 3000, 30_000);
  }
}

export async function executeLiveWrite(params: LiveWriteParams): Promise<LiveWriteResult> {
  const blockedReason = liveV1WriteBlockReason(params.action.method);
  if (blockedReason) throw new Error(blockedReason);
  const { client, action, account, signingProvider, canonicalReadback } = params;
  const storage = storageOrFallback(params.storage);
  if (client.chain.id !== LIVE_CHAIN_ID) throw new Error(`Client chain mismatch: expected ${LIVE_CHAIN_ID}`);
  const existing = loadPendingTransaction(action.requestId, storage);
  if (existing && !sameAction(existing, action, account)) {
    throw new Error(`request ${action.requestId} already has a different persisted transaction; refusing a duplicate broadcast`);
  }
  if (existing && !existing.txHash) throw new Error(`request ${action.requestId} has a reserved but unresolved submission; reconcile it before any retry`);
  const prior = existing ?? persistedTransactions(storage).find((record) => sameAction(record, action, account));
  if (prior && !prior.txHash) throw new Error(`prior ${action.method} submission has no resolved hash; reconcile it before any retry`);
  const progress: TransactionProgress = (patch) => {
    updatePending(storage, action.requestId, patch);
    const current = loadPendingTransaction(action.requestId, storage);
    if (current) params.onTransactionUpdate?.(current);
  };
  if (prior?.txHash) {
    const receipt = await waitForStudionetFinalization(client, prior.txHash as Hash, progress, () => finalizeReadyTransaction(client, prior.txHash as Hash, storage, action.requestId, progress));
    if (!successfulFinalizedExecution(receipt)) {
      await progress({ phase: "EXECUTION_STATUS", finality: receipt.statusName === "FINALIZED" ? "FINALIZED" : "UNDETERMINED", execution: "ERROR" });
      throw new Error(`${action.method} recovered transaction failed: ${String(receipt.statusName ?? "UNKNOWN_STATUS")} / ${String(receipt.txExecutionResultName ?? "UNKNOWN_EXECUTION")}`);
    }
    const readback = await canonicalReadback();
    await progress({ phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" });
    return { action, hash: prior.txHash as `0x${string}`, receipt, readback };
  }
  const preconditionContext = params.readPrecondition ? await params.readPrecondition() : undefined;
  assertRole(action.method, account, { ...(params.roleContext ?? {}), ...(preconditionContext ?? {}) });
  if (!signingProvider) throw new Error("Connect the originating browser wallet before submitting a LIVE write.");
  if (walletClientProviders.get(client) !== signingProvider) throw new Error("The verified wallet does not match the signer attached to this stable Studionet client.");
  await assertStudionetWallet(signingProvider, account);

  const payoutMethods = ["cancel_tender", "settle_award", "refund_buyer", "release_milestone", "resolve_dispute"];
  if (payoutMethods.includes(action.method)) {
    throw new Error("External transfers require a verified Studionet message-fee policy before LIVE execution.");
  }

  persistPending(storage, action, account);
  params.onTransactionUpdate?.(loadPendingTransaction(action.requestId, storage)!);
  let observedHash: Hash | undefined;
  if (!armSubmissionHook(client, async (submittedHash) => {
    observedHash = submittedHash;
    const current = loadPendingTransaction(action.requestId, storage);
    if (!current) throw new Error("submission journal reservation disappeared before wallet broadcast");
    sameKnownHash(current, submittedHash);
    await progress({ txHash: submittedHash, submissionHash: submittedHash, evmTxHash: submittedHash, phase: "PERSIST_HASH", finality: "PENDING", execution: "UNKNOWN", trackingError: "" });
  })) {
    throw new Error("wallet signer is not attached to this stable Studionet client; refusing to broadcast");
  }
  let returnedHash: Hash;
  try {
    returnedHash = await client.writeContract({
      address: LIVE_CONTRACT,
      functionName: action.method,
      args: [...action.args] as unknown as CalldataEncodable[],
      value: action.value ?? 0n,
    }) as Hash;
  } catch (error) {
    const journal = loadPendingTransaction(action.requestId, storage);
    if (!journal?.txHash && observedHash) {
      persistPending(storage, action, account, observedHash);
      params.onTransactionUpdate?.(loadPendingTransaction(action.requestId, storage)!);
    }
    const recoveredHash = loadPendingTransaction(action.requestId, storage)?.txHash;
    if (!recoveredHash) {
      await progress({ trackingError: String(error instanceof Error ? error.message : error), execution: "UNKNOWN" });
      throw new Error(`${action.method} submission outcome is unresolved; its reserved request is persisted and must be reconciled without rebroadcast.`, { cause: error });
    }
    returnedHash = recoveredHash as Hash;
  } finally {
    armSubmissionHook(client, null);
  }
  const journal = loadPendingTransaction(action.requestId, storage);
  if (!journal?.txHash) {
    persistPending(storage, action, account, observedHash ?? returnedHash);
    params.onTransactionUpdate?.(loadPendingTransaction(action.requestId, storage)!);
  }
  const saved = loadPendingTransaction(action.requestId, storage);
  if (!saved?.txHash) throw new Error("submitted transaction hash was not persisted; reconcile the wallet activity before retrying");
  if (observedHash && returnedHash.toLowerCase() !== observedHash.toLowerCase()) {
    await progress({ genlayerTxId: returnedHash, evmTxHash: observedHash, submissionHash: observedHash, phase: "RECONCILE_SAME_HASH", finality: "PENDING" });
  }
  const hash = saved.txHash as Hash;
  const ready = () => finalizeReadyTransaction(client, hash, storage, action.requestId, progress);
  const receipt = await waitForStudionetFinalization(client, hash, progress, ready);
  if (!successfulFinalizedExecution(receipt)) {
    await progress({ phase: "EXECUTION_STATUS", finality: receipt.statusName === "FINALIZED" ? "FINALIZED" : "UNDETERMINED", execution: "ERROR" });
    throw new Error(`${action.method} execution failed: ${String(receipt.statusName ?? "UNKNOWN_STATUS")} / ${String(receipt.txExecutionResultName ?? "UNKNOWN_EXECUTION")}`);
  }
  await progress({ phase: "FINALITY", finality: "FINALIZED" });
  await progress({ phase: "EXECUTION_STATUS", finality: "FINALIZED", execution: "SUCCESS" });
  await progress({ phase: "CANONICAL_READBACK" });
  const readback = await canonicalReadback();
  await progress({ phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" });
  return { action, hash, receipt, readback };
}

export async function recoverLiveTransaction(params: {
  client: LiveClient;
  record: StoredLiveTransaction;
  canonicalReadback: () => Promise<unknown>;
  storage?: StorageLike;
  onTransactionUpdate?: (record: StoredLiveTransaction) => void;
}): Promise<{ hash: `0x${string}`; receipt: unknown; readback: unknown }> {
  if (params.client.chain.id !== LIVE_CHAIN_ID) throw new Error(`Client chain mismatch: expected ${LIVE_CHAIN_ID}`);
  if (params.record.address !== LIVE_CONTRACT) throw new Error(`Persisted transaction targets an unexpected contract: ${params.record.address}`);
  if (!params.record.txHash) throw new Error("No persisted transaction hash to recover");
  const storage = storageOrFallback(params.storage);
  const progress: TransactionProgress = (patch) => {
    updatePending(storage, params.record.requestId, patch);
    const current = loadPendingTransaction(params.record.requestId, storage);
    if (current) params.onTransactionUpdate?.(current);
  };
  const receipt = await waitForStudionetFinalization(
    params.client,
    params.record.txHash as Hash,
    progress,
    () => finalizeReadyTransaction(params.client, params.record.txHash as Hash, storage, params.record.requestId, progress),
  );
  if (!successfulFinalizedExecution(receipt)) {
    throw new Error(`Recovered transaction execution failed: ${String(receipt.statusName ?? "UNKNOWN_STATUS")} / ${String(receipt.txExecutionResultName ?? "UNKNOWN_EXECUTION")}`);
  }
  const readback = await params.canonicalReadback();
  await progress({ phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" });
  return { hash: params.record.txHash as Hash, receipt, readback };
}
