import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTypedAction, assertRole, assertStudionetWallet, createLiveWalletClient, executeLiveWrite, loadPendingTransaction, requiredRole, waitForStudionetFinalization } from "./liveAdapter";
import { BUYER_ROLE_ADDRESS, LIVE_CHAIN_ID, LIVE_CONTRACT, SUPPLIER_ROLE_ADDRESS } from "./liveConfig";
import { mockStudionetRpc, stableWalletForTest, successfulStudionetTransaction } from "./stableWalletTestSupport";

vi.mock("./liveConfig", async () => ({
  ...(await vi.importActual<typeof import("./liveConfig")>("./liveConfig")),
  liveV1WriteBlockReason: () => null,
}));

const numericHash = "1234567890123456789012345678901234567890123456789012345678901234";

function createTenderKwargs(tenderHash = numericHash) {
  return {
    tender_id: "LIVE-TENDER-1", title: "Controlled live tender", description: "Controlled live qualification", category: "ENERGY",
    currency_label: "GEN", budget_ceiling: 1000000000000000n, bid_deadline: "2026-12-31T00:00:00.000Z",
    evaluation_deadline: "2027-01-01T00:00:00.000Z", delivery_deadline: "2027-01-02T00:00:00.000Z",
    equivalence_policy: "strict", evaluation_policy: "objective", payment_policy: "full", supplier_bond_policy: "NONE", tender_hash: tenderHash,
  };
}

describe("Procura stable Studionet adapter", () => {
  beforeEach(() => { mockStudionetRpc(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("keeps numeric-only SHA strings as strings through shared schema ordering", () => {
    const action = buildTypedAction("create_tender", createTenderKwargs(), { requestId: "hash-regression" });
    expect(action.kwargs.tender_hash).toBe(numericHash);
    expect(typeof action.kwargs.tender_hash).toBe("string");
    expect(action.args[13]).toBe(numericHash);
  });

  it("enforces buyer and supplier roles without changing the contract", () => {
    expect(requiredRole("settle_award")).toBe("buyer");
    expect(requiredRole("submit_bid")).toBe("permissionless");
    expect(() => assertRole("settle_award", SUPPLIER_ROLE_ADDRESS, {})).toThrow(/buyer wallet/);
    expect(() => assertRole("accept_award", BUYER_ROLE_ADDRESS, {})).toThrow(/supplier wallet/);
    expect(() => assertRole("accept_award", SUPPLIER_ROLE_ADDRESS, {})).not.toThrow();
  });

  it("rejects wrong network and disconnected wallets before signing", async () => {
    const provider = { request: vi.fn(async ({ method }: { method: string }) => method === "eth_chainId" ? "0x1" : []) };
    await expect(assertStudionetWallet(provider)).rejects.toThrow(`${LIVE_CHAIN_ID}`);
    const disconnected = { request: vi.fn(async ({ method }: { method: string }) => method === "eth_chainId" ? "0xf22f" : []) };
    await expect(assertStudionetWallet(disconnected)).rejects.toThrow("Wallet disconnected");
    const wrongWallet = { request: vi.fn(async ({ method }: { method: string }) => method === "eth_chainId" ? "0xf22f" : [SUPPLIER_ROLE_ADDRESS]) };
    await expect(assertStudionetWallet(wrongWallet, BUYER_ROLE_ADDRESS)).rejects.toThrow(/Wrong wallet/);
  });

  it("uses the installed stable SDK writer, its supported gas RPCs, and persists the exact wallet hash", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-1" }, { requestId: "stable-sdk-write" });
    const { client, provider, sentTransactions } = stableWalletForTest();
    const storage = new Map<string, string>();
    const storageLike = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } };
    const result = await executeLiveWrite({
      client, action, account: BUYER_ROLE_ADDRESS, signingProvider: provider,
      roleContext: { buyer: BUYER_ROLE_ADDRESS }, storage: storageLike,
      canonicalReadback: async () => ({ state: "FROZEN" }),
    });
    expect(result.hash).toBe(`0x${"11".repeat(32)}`);
    expect(result.receipt).toMatchObject({ statusName: "FINALIZED", resultName: "MAJORITY_AGREE" });
    expect(result.readback).toEqual({ state: "FROZEN" });
    expect(sentTransactions).toHaveLength(1);
    expect(sentTransactions[0]).toMatchObject({ to: expect.any(String), data: expect.any(String), gas: expect.any(String), gasPrice: expect.any(String), chainId: "0xf22f" });
    expect(loadPendingTransaction(action.requestId, storageLike)).toMatchObject({
      txHash: `0x${"11".repeat(32)}`, submissionHash: `0x${"11".repeat(32)}`, evmTxHash: `0x${"11".repeat(32)}`,
      finality: "FINALIZED", execution: "SUCCESS", address: LIVE_CONTRACT, account: BUYER_ROLE_ADDRESS,
    });
    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });

  it("denies a signer that differs from the wallet bound to the stable client", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-SIGNER" }, { requestId: "wrong-signer" });
    const { client, provider, sentTransactions } = stableWalletForTest();
    const otherProvider = { request: vi.fn(async ({ method }: { method: string }) => method === "eth_chainId" ? "0xf22f" : [BUYER_ROLE_ADDRESS]) };
    await expect(executeLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, signingProvider: otherProvider, canonicalReadback: async () => ({}) })).rejects.toThrow(/does not match the signer/);
    expect(provider).toBeDefined();
    expect(sentTransactions).toHaveLength(0);
  });

  it("refuses a second eth_sendTransaction if the stable SDK retries an uncertain request", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-DOUBLE" }, { requestId: "wallet-double-send" });
    const { client, provider, sentTransactions } = stableWalletForTest();
    const original = client.request.bind(client);
    const writeContract = vi.fn(async () => {
      const transaction = { from: BUYER_ROLE_ADDRESS, to: "0x0000000000000000000000000000000000000001", data: "0x", value: "0x0", gas: "0x30d40", gasPrice: "0x3b9aca00", chainId: "0xf22f" };
      const first = await original({ method: "eth_sendTransaction", params: [transaction] } as never);
      await expect(original({ method: "eth_sendTransaction", params: [transaction] } as never)).rejects.toThrow(/second wallet broadcast/);
      return first;
    });
    Object.defineProperty(client, "writeContract", { configurable: true, value: writeContract });
    const result = await executeLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, signingProvider: provider, canonicalReadback: async () => ({}) });
    expect(result.hash).toBe(`0x${"11".repeat(32)}`);
    expect(sentTransactions).toHaveLength(1);
  });

  it("blocks repeated equivalent writes by reconciling the first persisted hash", async () => {
    const firstAction = buildTypedAction("freeze_tender", { tender_id: "T-REPLAY" }, { requestId: "reconcile-first" });
    const secondAction = buildTypedAction("freeze_tender", { tender_id: "T-REPLAY" }, { requestId: "reconcile-second" });
    const { client, provider, sentTransactions, getTransaction } = stableWalletForTest({ hashes: [`0x${"11".repeat(32)}`] });
    const storage = new Map<string, string>();
    const storageLike = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } };
    await executeLiveWrite({ client, action: firstAction, account: BUYER_ROLE_ADDRESS, signingProvider: provider, storage: storageLike, canonicalReadback: async () => ({ state: "FROZEN" }) });
    const result = await executeLiveWrite({ client, action: secondAction, account: BUYER_ROLE_ADDRESS, signingProvider: provider, storage: storageLike, canonicalReadback: async () => ({ state: "FROZEN" }) });
    expect(result.hash).toBe(`0x${"11".repeat(32)}`);
    expect(sentTransactions).toHaveLength(1);
    expect(getTransaction).toHaveBeenCalledTimes(2);
  });

  it("does not treat finalized disagreement or execution errors as success", async () => {
    const failed = {
      statusName: "FINALIZED", resultName: "MAJORITY_DISAGREE", hash: `0x${"11".repeat(32)}`, txId: `0x${"11".repeat(32)}`,
      consensus_data: { leader_receipt: [{ execution_result: "ERROR", result: { status: "error" } }], validators: [{ execution_result: "ERROR", vote: "disagree" }] },
    };
    const action = buildTypedAction("freeze_tender", { tender_id: "T-FAIL" }, { requestId: "execution-fails" });
    const { client, provider } = stableWalletForTest({ transaction: async () => failed });
    const storage = new Map<string, string>();
    const storageLike = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } };
    await expect(executeLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, signingProvider: provider, storage: storageLike, canonicalReadback: async () => ({}) })).rejects.toThrow(/execution failed/);
    expect(loadPendingTransaction(action.requestId, storageLike)).toMatchObject({ finality: "FINALIZED", execution: "ERROR", consensusResult: "MAJORITY_DISAGREE" });
  });

  it("keeps tracking ACCEPTED transactions through a transient read timeout", async () => {
    vi.useFakeTimers();
    try {
      const hash = `0x${"ab".repeat(32)}` as `0x${string}` & { length: 66 };
      const finalized = { ...successfulStudionetTransaction, hash, txId: hash };
      const getTransaction = vi.fn()
        .mockResolvedValueOnce({ statusName: "ACCEPTED", resultName: "MAJORITY_AGREE" })
        .mockRejectedValueOnce(new Error("temporary RPC timeout"))
        .mockResolvedValue(finalized);
      const client = { getTransaction } as unknown as Parameters<typeof waitForStudionetFinalization>[0];
      const pending: Array<Record<string, unknown>> = [];
      const receipt = waitForStudionetFinalization(client, hash, (patch) => { pending.push(patch); });
      await vi.advanceTimersByTimeAsync(9_000);
      await expect(receipt).resolves.toMatchObject({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" });
      expect(getTransaction).toHaveBeenCalledTimes(3);
      expect(pending.some((entry) => entry.consensusStatus === "ACCEPTED" && entry.finality === "ACCEPTED")).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it("finalizes only a READY_TO_FINALIZE transaction and persists the finalizer hash", async () => {
    vi.useFakeTimers();
    try {
      const hash = `0x${"11".repeat(32)}`;
      const ready = { statusName: "READY_TO_FINALIZE", resultName: "MAJORITY_AGREE", txId: "0xparent", hash };
      const finalized = { ...successfulStudionetTransaction, hash, txId: "0xparent" };
      const transaction = vi.fn().mockResolvedValueOnce(ready).mockResolvedValue(finalized);
      const { client, provider } = stableWalletForTest({ transaction });
      const finalizeTransaction = vi.fn(async () => `0x${"22".repeat(32)}`);
      Object.defineProperty(client, "finalizeTransaction", { configurable: true, value: finalizeTransaction });
      const action = buildTypedAction("freeze_tender", { tender_id: "T-READY" }, { requestId: "ready-finalize-once" });
      const storage = new Map<string, string>();
      const storageLike = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } };
      const write = executeLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, signingProvider: provider, storage: storageLike, canonicalReadback: async () => ({ state: "FROZEN" }) });
      await vi.advanceTimersByTimeAsync(3000);
      await expect(write).resolves.toMatchObject({ hash });
      expect(finalizeTransaction).toHaveBeenCalledTimes(1);
      expect(finalizeTransaction).toHaveBeenCalledWith({ txId: "0xparent" });
      expect(loadPendingTransaction(action.requestId, storageLike)).toMatchObject({ finality: "FINALIZED", execution: "SUCCESS", finalizationPhase: "SUBMITTED", finalizationTxHash: `0x${"22".repeat(32)}` });
    } finally { vi.useRealTimers(); }
  });

  it("rejects validator execution disagreement even if the transaction says MAJORITY_AGREE", async () => {
    const hash = `0x${"ef".repeat(32)}` as `0x${string}` & { length: 66 };
    const receipt = await waitForStudionetFinalization({ getTransaction: async () => ({
      ...successfulStudionetTransaction, hash,
      consensus_data: { leader_receipt: [{ execution_result: "SUCCESS", result: { status: "return" } }], validators: [{ execution_result: "SUCCESS", vote: "agree" }, { execution_result: "SUCCESS", vote: "agree" }, { execution_result: "ERROR", vote: "disagree" }] },
    }) } as unknown as Parameters<typeof waitForStudionetFinalization>[0], hash);
    expect(receipt.txExecutionResultName).toBe("FINISHED_WITH_ERROR");
  });

  it("uses the verified V2.1.2 Studionet contract", () => expect(LIVE_CONTRACT).toBe("0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929"));
});
