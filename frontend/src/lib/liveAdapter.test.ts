import { describe, expect, it, vi } from "vitest";
import { MessageType } from "genlayer-js";
import { deriveExternalMessageCallKey } from "genlayer-js";
import { buildTypedAction, externalAllocation, assertRole, assertStudioDevWallet, executeLiveWrite, loadPendingTransaction, requiredRole } from "./liveAdapter";
import { BUYER_ROLE_ADDRESS, LIVE_CHAIN_ID, LIVE_CONTRACT, SUPPLIER_ROLE_ADDRESS } from "./liveConfig";

const numericHash = "1234567890123456789012345678901234567890123456789012345678901234";

function createTenderKwargs(tenderHash = numericHash) {
  return {
    tender_id: "LIVE-TENDER-1", title: "Controlled live tender", description: "Controlled live qualification", category: "ENERGY",
    currency_label: "GEN", budget_ceiling: 1000000000000000n, bid_deadline: "2026-12-31T00:00:00+00:00",
    evaluation_deadline: "2026-12-31T00:00:00+00:00", delivery_deadline: "2026-12-31T00:00:00+00:00",
    equivalence_policy: "strict", evaluation_policy: "objective", payment_policy: "full", supplier_bond_policy: "NONE", tender_hash: tenderHash,
  };
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
      waitForFinalization: vi.fn(async () => ({ txExecutionResultName: "FINISHED_WITH_RETURN" })),
    } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
    const result = await executeLiveWrite({
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

  it("uses the frozen canonical contract address", () => expect(LIVE_CONTRACT).toBe("0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA"));
});
