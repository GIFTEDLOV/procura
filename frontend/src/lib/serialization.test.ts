import { describe, expect, it } from "vitest";
import {
  assertDeadlineOrder,
  buildAddBidEvidenceArgs,
  buildAddDeliveryEvidenceArgs,
  bidArgsSchema,
  buildCreateDeliveryArgs,
  buildCreateTenderArgs,
  buildEvidenceArgs,
  buildSubmitBidArgs,
  canonicalArgumentSerialization,
  commitmentHash,
  normalizeContractTimestamp,
  serializeBid,
  sha256File,
  sha256Hex,
} from "./serialization";

const validTimestamp = "2026-10-05T08:00:00.000Z";
const validHash = "a".repeat(64);

describe("contract serialization", () => {
  it("sends canonical timestamp strings and preserves frozen argument order", () => {
    const values = { bidId: "BID-1", tenderId: "TND-1", price: 100, currency: "USDC", deliveryCommitment: "30 days", requirementResponses: "frozen", submittedAt: validTimestamp, bidHash: validHash };
    expect(serializeBid(values)).toEqual(["BID-1", "TND-1", 100n, "USDC", "30 days", "frozen", validTimestamp, validHash]);
    expect(typeof serializeBid(values)[6]).toBe("string");
  });

  it("rejects invalid timestamp types and non-canonical timestamp strings", () => {
    expect(() => bidArgsSchema.parse({ bidId: "BID-1", tenderId: "TND-1", price: 100, currency: "USDC", deliveryCommitment: "30 days", requirementResponses: "frozen", submittedAt: 1700000000, bidHash: validHash })).toThrow();
    expect(() => bidArgsSchema.parse({ bidId: "BID-1", tenderId: "TND-1", price: 100, currency: "USDC", deliveryCommitment: "30 days", requirementResponses: "frozen", submittedAt: "2026-10-05T09:00:00+01:00", bidHash: validHash })).toThrow();
    expect(normalizeContractTimestamp("2026-10-05T09:00:00+01:00")).toBe(validTimestamp);
    expect(() => normalizeContractTimestamp("2026-02-30T09:00")).toThrow(/calendar/);
    expect(() => normalizeContractTimestamp("2026-02-30T09:00:00Z")).toThrow(/calendar/);
  });

  it("enforces the exact deployed u256 range without floating-point conversion", async () => {
    const maximum = (1n << 256n) - 1n;
    expect(await buildCreateTenderArgs({ tenderId: "T-MAX", title: "Maximum", description: "Range", category: "TEST", currencyLabel: "GEN", budgetCeiling: maximum, bidDeadline: "2026-10-05T09:00", evaluationDeadline: "2026-10-06T09:00", deliveryDeadline: "2026-10-07T09:00", equivalencePolicy: "STRICT", evaluationPolicy: "OBJECTIVE", paymentPolicy: "FULL", supplierBondPolicy: "NONE" })).toMatchObject({ budget_ceiling: maximum });
    await expect(buildCreateTenderArgs({ tenderId: "T-OVER", title: "Overflow", description: "Range", category: "TEST", currencyLabel: "GEN", budgetCeiling: maximum + 1n, bidDeadline: "2026-10-05T09:00", evaluationDeadline: "2026-10-06T09:00", deliveryDeadline: "2026-10-07T09:00", equivalencePolicy: "STRICT", evaluationPolicy: "OBJECTIVE", paymentPolicy: "FULL", supplierBondPolicy: "NONE" })).rejects.toThrow(/u256 maximum/);
  });

  it("uses lexicographically compatible UTC deadline ordering", () => {
    const bid = normalizeContractTimestamp("2026-10-05T09:00:00+01:00");
    const evaluation = normalizeContractTimestamp("2026-10-05T10:00:00+01:00");
    const delivery = normalizeContractTimestamp("2026-10-06T10:00:00+01:00");
    expect(bid < evaluation && evaluation < delivery).toBe(true);
    expect(() => assertDeadlineOrder(delivery, evaluation, bid)).toThrow();
  });

  it("computes deterministic lowercase SHA-256 digests", async () => {
    const first = await sha256Hex("procura");
    expect(first).toBe(await sha256Hex("procura"));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toMatch(/^0x/);
  });

  it("cannot silently drift its canonical commitment when object insertion order changes", async () => {
    const left = { tender_id: "T-1", title: "A", description: "B", category: "C", currency_label: "GEN", budget_ceiling: 10n, bid_deadline: validTimestamp, evaluation_deadline: "2026-10-06T08:00:00.000Z", delivery_deadline: "2026-10-07T08:00:00.000Z", equivalence_policy: "STRICT", evaluation_policy: "OBJECTIVE", payment_policy: "FULL", supplier_bond_policy: "NONE" };
    const right = { supplier_bond_policy: "NONE", payment_policy: "FULL", evaluation_policy: "OBJECTIVE", equivalence_policy: "STRICT", delivery_deadline: "2026-10-07T08:00:00.000Z", evaluation_deadline: "2026-10-06T08:00:00.000Z", bid_deadline: validTimestamp, budget_ceiling: 10n, currency_label: "GEN", category: "C", description: "B", title: "A", tender_id: "T-1" };
    expect(canonicalArgumentSerialization("create_tender", left, ["tender_hash"])).toBe(canonicalArgumentSerialization("create_tender", right, ["tender_hash"]));
    expect(await commitmentHash("create_tender", left, "tender_hash")).toBe(await commitmentHash("create_tender", right, "tender_hash"));
  });

  it("builds a real 14-argument tender commitment from form values", async () => {
    const args = await buildCreateTenderArgs({ tenderId: "T-1", title: "Solar storage", description: "100 units", category: "ENERGY", currencyLabel: "GEN", budgetCeiling: "1000000000000000", bidDeadline: "2026-10-05T09:00", evaluationDeadline: "2026-10-06T09:00", deliveryDeadline: "2026-10-20T09:00", equivalencePolicy: "STRICT", evaluationPolicy: "OBJECTIVE", paymentPolicy: "FULL", supplierBondPolicy: "NONE" });
    expect(Object.keys(args)).toHaveLength(14);
    expect(args.bid_deadline).toBe("2026-10-05T08:00:00.000Z");
    expect(args.budget_ceiling).toBe(1000000000000000n);
    expect(args.tender_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(args.tender_hash).not.toMatch(/^0x/);
  });

  it("builds a budget/currency/deadline-guarded bid with a real commitment", async () => {
    const args = await buildSubmitBidArgs({ bidId: "B-1", tenderId: "T-1", price: "42", currency: "GEN", deliveryCommitment: "30 days", requirementResponses: "{}", submittedAt: "2026-10-05T09:00", tenderCurrency: "GEN", tenderBudgetCeiling: "100", tenderBidDeadline: "2026-10-06T09:00" });
    expect(args.submitted_at).toBe("2026-10-05T08:00:00.000Z");
    expect(args.price).toBe(42n);
    expect(args.bid_hash).toMatch(/^[0-9a-f]{64}$/);
    await expect(buildSubmitBidArgs({ bidId: "B-1", tenderId: "T-1", price: "101", currency: "GEN", deliveryCommitment: "30 days", requirementResponses: "{}", submittedAt: "2026-10-05T09:00", tenderCurrency: "GEN", tenderBudgetCeiling: "100", tenderBidDeadline: "2026-10-06T09:00" })).rejects.toThrow(/budget/);
  });

  it("builds delivery and evidence arguments with exact u256 values", async () => {
    const delivery = await buildCreateDeliveryArgs({ deliveryId: "D-1", awardId: "A-1", deliveryReference: "GRN-1", deliveredItems: "one unit", quantity: "1", serialIdentifiers: "SN-1", submittedAt: "2026-10-05T09:00", awardDeliveryDeadline: "2026-10-06T09:00" });
    expect(delivery.quantity).toBe(1n);
    expect(Object.keys(delivery)).toHaveLength(7);
    const evidenceInput = { evidenceId: "E-1", entityId: "B-1", authority: "Buyer", sourceUrl: "https://example.test/evidence", contentSha256: validHash, contentByteLength: "4", observedAt: "2026-10-05T08:00", publishedAt: "2026-10-05T07:00", evidenceType: "receipt", entitySubmittedAt: "2026-10-05T09:00" };
    const evidence = buildAddBidEvidenceArgs(evidenceInput);
    expect(Object.keys(evidence)).toHaveLength(9);
    expect(evidence.content_byte_length).toBe(4n);
    expect(buildAddDeliveryEvidenceArgs({ ...evidenceInput, entityId: "D-1" })).toMatchObject({ delivery_id: "D-1" });
    expect(() => buildEvidenceArgs("add_bid_evidence", { ...evidenceInput, contentSha256: `0x${validHash}` })).toThrow();
  });

  it("hashes exact user-provided evidence bytes", async () => {
    const result = await sha256File({ arrayBuffer: async () => new Uint8Array([0, 1, 2, 255]).buffer } as unknown as Blob);
    expect(result.contentByteLength).toBe(4n);
    expect(result.contentSha256).toBe("3d1f57c984978ef98a18378c8166c1cb8ede02c03eeb6aee7e2f121dfeee3e56");
  });
});
