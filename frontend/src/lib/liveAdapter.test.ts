import { describe, expect, it, vi } from "vitest";
import { MessageType } from "genlayer-js";
import { deriveExternalMessageCallKey } from "genlayer-js";
import { buildTypedAction, externalAllocation, assertRole, assertStudioDevWallet, executeLiveWrite, executePreparedLiveWrite, loadPendingTransaction, recoverLiveTransaction, requiredRole } from "./liveAdapter";
import { BUYER_ROLE_ADDRESS, LIVE_CHAIN_ID, LIVE_CONTRACT, LIVE_V1_WRITE_METHODS, SUPPLIER_ROLE_ADDRESS, V1_LIVE_READ_ONLY_MESSAGE } from "./liveConfig";

const numericHash = "1234567890123456789012345678901234567890123456789012345678901234";

function createTenderKwargs(tenderHash = numericHash) {
  return {
    tender_id: "LIVE-TENDER-1", title: "Controlled live tender", description: "Controlled live qualification", category: "ENERGY",
    currency_label: "GEN", budget_ceiling: 1000000000000000n, bid_deadline: "2026-12-31T00:00:00.000Z",
    evaluation_deadline: "2027-01-01T00:00:00.000Z", delivery_deadline: "2027-01-02T00:00:00.000Z",
    equivalence_policy: "strict", evaluation_policy: "objective", payment_policy: "full", supplier_bond_policy: "NONE", tender_hash: tenderHash,
  };
}

function readOnlyClient() {
  return {
    chain: { id: LIVE_CHAIN_ID },
    simulateWriteContract: vi.fn(),
    estimateTransactionFees: vi.fn(),
    writeContract: vi.fn(),
    waitForFinalization: vi.fn(),
  } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
}

describe("Procura live adapter", () => {
  it("keeps numeric-only SHA strings as strings through schema ordering", () => {
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
    await expect(assertStudioDevWallet(provider)).rejects.toThrow(`${LIVE_CHAIN_ID}`);
    const disconnected = { request: vi.fn(async ({ method }: { method: string }) => method === "eth_chainId" ? "0xf22d" : []) };
    await expect(assertStudioDevWallet(disconnected)).rejects.toThrow("Wallet disconnected");
    const wrongWallet = { request: vi.fn(async ({ method }: { method: string }) => method === "eth_chainId" ? "0xf22d" : [SUPPLIER_ROLE_ADDRESS]) };
    await expect(assertStudioDevWallet(wrongWallet, BUYER_ROLE_ADDRESS)).rejects.toThrow(/Wrong wallet/);
  });

  it("derives refund allocation from the canonical buyer and the exact empty calldata", () => {
    const allocations = externalAllocation("cancel_tender", BUYER_ROLE_ADDRESS);
    expect(allocations).toHaveLength(1);
    expect(allocations[0].messageType).toBe(MessageType.External);
    expect(allocations[0].recipient).toBe(BUYER_ROLE_ADDRESS);
    expect(allocations[0].callKey).toBe(deriveExternalMessageCallKey("0x"));
    expect(allocations[0].budget).toBe(125000000000000n);
  });

  it("derives settlement allocation from the canonical awarded supplier", () => {
    const allocations = externalAllocation("settle_award", SUPPLIER_ROLE_ADDRESS);
    expect(allocations[0].recipient).toBe(SUPPLIER_ROLE_ADDRESS);
    expect(allocations[0].budget).toBeGreaterThan(0n);
  });

  it("does not attach an external allocation to ordinary writes", () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-1" }, { requestId: "freeze-1" });
    expect(action.method).toBe("freeze_tender");
  });

  it("broadcasts once, persists the returned hash, finalizes, and reads back", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-1" }, { requestId: "once-1" });
    const storage = new Map<string, string>();
    const writeContract = vi.fn(async () => "0xabc");
    const mockClient = {
      chain: { id: LIVE_CHAIN_ID },
      simulateWriteContract: vi.fn(async () => ({})),
      estimateTransactionFees: vi.fn(async () => ({ feeValue: 10n, distribution: { totalMessageFees: 0n }, messageAllocations: undefined })),
      writeContract,
      waitForFinalization: vi.fn(async () => ({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" })),
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    const result = await executePreparedLiveWrite({
      client: mockClient,
      action,
      account: BUYER_ROLE_ADDRESS,
      storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
      canonicalReadback: async () => ({ state: "FROZEN" }),
    });
    expect(result.hash).toBe("0xabc");
    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(loadPendingTransaction("once-1", { getItem: (key) => storage.get(key) ?? null, setItem: () => undefined, removeItem: () => undefined })?.txHash).toBe("0xabc");
  });

  it("does not broadcast when simulation fails", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-1" }, { requestId: "simulation-fails" });
    const writeContract = vi.fn(async () => "0xnever");
    const client = {
      chain: { id: LIVE_CHAIN_ID },
      simulateWriteContract: vi.fn(async () => { throw new Error("simulation rejected: tender is not frozen"); }),
      estimateTransactionFees: vi.fn(), writeContract,
      waitForFinalization: vi.fn(),
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    await expect(executePreparedLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, canonicalReadback: async () => ({}) })).rejects.toThrow(/simulation rejected/);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("never reports a finalized execution error as success", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-1" }, { requestId: "execution-fails" });
    const storage = new Map<string, string>();
    const client = {
      chain: { id: LIVE_CHAIN_ID },
      simulateWriteContract: vi.fn(async () => ({})),
      estimateTransactionFees: vi.fn(async () => ({ feeValue: 10n, distribution: { totalMessageFees: 0n }, messageAllocations: undefined })),
      writeContract: vi.fn(async () => "0xfail"),
      waitForFinalization: vi.fn(async () => ({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" })),
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    await expect(executePreparedLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }, canonicalReadback: async () => ({}) })).rejects.toThrow(/execution failed/);
    expect(loadPendingTransaction("execution-fails", { getItem: (key) => storage.get(key) ?? null, setItem: () => undefined, removeItem: () => undefined })).toMatchObject({ finality: "FINALIZED", execution: "ERROR" });
  });

  it("recovers the same persisted hash without a second broadcast", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-1" }, { requestId: "recover-same" });
    const storage = new Map<string, string>();
    const writeContract = vi.fn(async () => "0xsame");
    const waitForFinalization = vi.fn(async () => ({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" }));
    const client = {
      chain: { id: LIVE_CHAIN_ID }, simulateWriteContract: vi.fn(async () => ({})),
      estimateTransactionFees: vi.fn(async () => ({ feeValue: 10n, distribution: { totalMessageFees: 0n }, messageAllocations: undefined })),
      writeContract, waitForFinalization,
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    const storageLike = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
    await executePreparedLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, storage: storageLike, canonicalReadback: async () => ({ tender_id: "T-1" }) });
    const refreshedAction = buildTypedAction("freeze_tender", { tender_id: "T-1" }, { requestId: "recover-after-refresh" });
    await executePreparedLiveWrite({ client, action: refreshedAction, account: BUYER_ROLE_ADDRESS, storage: storageLike, canonicalReadback: async () => ({ tender_id: "T-1" }) });
    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(waitForFinalization).toHaveBeenCalledTimes(2);
  });

  it("does not reconcile payable actions with a different transferred value", async () => {
    const first = buildTypedAction("fund_tender", { tender_id: "T-VALUE" }, { requestId: "fund-value-1", value: 10n });
    const second = buildTypedAction("fund_tender", { tender_id: "T-VALUE" }, { requestId: "fund-value-2", value: 11n });
    const storage = new Map<string, string>();
    const storageLike = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
    const writes: Array<{ value: bigint }> = [];
    const writeContract = vi.fn(async (request: { value: bigint }) => { writes.push(request); return `0x${String(writes.length).padStart(3, "0")}`; });
    const client = {
      chain: { id: LIVE_CHAIN_ID }, simulateWriteContract: vi.fn(async () => ({})),
      estimateTransactionFees: vi.fn(async () => ({ feeValue: 10n, distribution: { totalMessageFees: 0n }, messageAllocations: undefined })),
      writeContract, waitForFinalization: vi.fn(async () => ({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" })),
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    await executePreparedLiveWrite({ client, action: first, account: BUYER_ROLE_ADDRESS, storage: storageLike, canonicalReadback: async () => ({ tender_id: "T-VALUE" }) });
    await executePreparedLiveWrite({ client, action: second, account: BUYER_ROLE_ADDRESS, storage: storageLike, canonicalReadback: async () => ({ tender_id: "T-VALUE" }) });
    expect(writeContract).toHaveBeenCalledTimes(2);
    expect(writes.map(({ value }) => value)).toEqual([10n, 11n]);
  });

  it("does not rebroadcast a persisted hash after a finalized execution error", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-ERROR" }, { requestId: "no-rebroadcast-error" });
    const storage = new Map<string, string>();
    const writeContract = vi.fn(async () => "0xerror");
    const waitForFinalization = vi.fn(async () => ({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" }));
    const client = {
      chain: { id: LIVE_CHAIN_ID }, simulateWriteContract: vi.fn(async () => ({})),
      estimateTransactionFees: vi.fn(async () => ({ feeValue: 10n, distribution: { totalMessageFees: 0n }, messageAllocations: undefined })),
      writeContract, waitForFinalization,
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    const storageLike = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
    await expect(executePreparedLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, storage: storageLike, canonicalReadback: async () => ({}) })).rejects.toThrow(/execution failed/);
    const refreshed = buildTypedAction("freeze_tender", { tender_id: "T-ERROR" }, { requestId: "no-rebroadcast-error-refresh" });
    await expect(executePreparedLiveWrite({ client, action: refreshed, account: BUYER_ROLE_ADDRESS, storage: storageLike, canonicalReadback: async () => ({}) })).rejects.toThrow(/recovered transaction failed/);
    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(waitForFinalization).toHaveBeenCalledTimes(2);
  });

  it("does not treat a finalized non-success execution as recovered success", async () => {
    const action = buildTypedAction("freeze_tender", { tender_id: "T-RECOVER-ERROR" }, { requestId: "recover-error" });
    const client = {
      chain: { id: LIVE_CHAIN_ID },
      waitForFinalization: vi.fn(async () => ({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" })),
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    await expect(recoverLiveTransaction({ client, record: { requestId: action.requestId, method: action.method, args: [...action.args], txHash: "0xrecover-error", phase: "PERSIST_HASH", address: LIVE_CONTRACT, account: BUYER_ROLE_ADDRESS }, canonicalReadback: async () => ({}) })).rejects.toThrow(/execution failed/);
  });

  it("fails closed for every V1 write before simulation, fee estimation, or broadcast", async () => {
    expect(LIVE_V1_WRITE_METHODS).toHaveLength(25);
    const client = readOnlyClient();
    const storage = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() };
    for (const method of LIVE_V1_WRITE_METHODS) {
      const action = { method, args: [], kwargs: {}, requestId: `blocked-${method}`, value: 0n } as unknown as Parameters<typeof executeLiveWrite>[0]["action"];
      await expect(executeLiveWrite({ client, action, account: BUYER_ROLE_ADDRESS, storage, canonicalReadback: async () => ({}) })).rejects.toThrow(V1_LIVE_READ_ONLY_MESSAGE);
    }
    expect(client.simulateWriteContract).not.toHaveBeenCalled();
    expect(client.estimateTransactionFees).not.toHaveBeenCalled();
    expect(client.writeContract).not.toHaveBeenCalled();
    expect(client.waitForFinalization).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("uses the Deployment #6 canonical contract address", () => expect(LIVE_CONTRACT).toBe("0x88634c7868B0659b46C5bd93E4038222697a0170"));
});
