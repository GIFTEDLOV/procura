import { describe, expect, it } from "vitest";
import { isSuccessfulSettlement, reconcileHash } from "./transactions";

describe("transaction recovery", () => {
  it("reconciles the same returned hash without rebroadcast", () => {
    const record = { requestId: "req-1", method: "settle_award", args: [], txHash: "0xabc", phase: "PERSIST_HASH" as const };
    expect(reconcileHash(record, "0xabc").phase).toBe("RECONCILE_SAME_HASH");
    expect(() => reconcileHash(record, "0xdef")).toThrow();
  });
  it("does not call finality alone successful execution", () => {
    expect(isSuccessfulSettlement({ requestId: "req-1", method: "settle_award", args: [], phase: "FINALITY", finality: "FINALIZED", execution: "UNKNOWN" })).toBe(false);
    expect(isSuccessfulSettlement({ requestId: "req-1", method: "settle_award", args: [], phase: "UI_UPDATE", finality: "FINALIZED", execution: "SUCCESS" })).toBe(true);
  });
});
