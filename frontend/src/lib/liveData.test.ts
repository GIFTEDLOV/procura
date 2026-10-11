import { describe, expect, it, vi } from "vitest";
import { buildTypedAction } from "./liveAdapter";
import { canonicalTenderTerms, readActionPrecondition, readActionReadback } from "./liveData";

const hash = "c".repeat(64);
const bidAction = buildTypedAction("submit_bid", { bid_id: "B-NEW", tender_id: "T-1", price: 10n, currency: "GEN", delivery_commitment: "30 days", requirement_responses: "{}", submitted_at: "2026-10-05T08:00:00.000Z", bid_hash: hash }, { requestId: "precondition-bid" });
const evidenceAction = buildTypedAction("add_bid_evidence", { bid_id: "B-1", evidence_id: "E-NEW", authority: "Authority", source_url: "https://example.test/evidence", content_sha256: hash, content_byte_length: 4n, observed_at: "2026-10-05T07:00:00.000Z", published_at: "2026-10-05T06:00:00.000Z", evidence_type: "receipt" }, { requestId: "precondition-evidence" });

function clientFor(values: Record<string, unknown>) {
  return { readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
    const key = `${functionName}:${JSON.stringify(args ?? [])}`;
    if (!(key in values)) throw new Error(`unknown read ${key}`);
    const result = values[key];
    if (result instanceof Error) throw result;
    return result;
  }) };
}

describe("canonical LIVE preconditions and readback", () => {
  it("extracts bid terms from the canonical tender state inside a LIVE snapshot", () => {
    expect(canonicalTenderTerms({ id: "T-1", state: { currency_label: "GEN", budget_ceiling: 100n, bid_deadline: "2026-10-06T08:00:00Z" }, requirements: [], bids: [] })).toEqual({ currencyLabel: "GEN", budgetCeiling: 100n, bidDeadline: "2026-10-06T08:00:00Z" });
    expect(canonicalTenderTerms({ id: "T-1", state: "unavailable", requirements: [], bids: [] })).toBeNull();
  });

  it("submits only against a canonical accepting tender and its frozen commercial terms", async () => {
    const client = clientFor({
      "get_tender:[\"T-1\"]": { tender_id: "T-1", state: "FUNDED", currency_label: "GEN", budget_ceiling: 100n, bid_deadline: "2026-10-06T08:00:00.000Z" },
      "get_bids:[\"T-1\"]": [],
    });
    await expect(readActionPrecondition(client, bidAction)).resolves.toEqual({});
    const wrongState = clientFor({ "get_tender:[\"T-1\"]": { tender_id: "T-1", state: "AWARDED", currency_label: "GEN", budget_ceiling: 100n, bid_deadline: "2026-10-06T08:00:00.000Z" } });
    await expect(readActionPrecondition(wrongState, bidAction)).rejects.toThrow(/not accepting/);
  });

  it("derives supplier authorization from canonical award, bid, and delivery records", async () => {
    const supplier = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8";
    const deliveryAction = buildTypedAction("create_delivery", { delivery_id: "D-1", award_id: "A-1", delivery_reference: "GRN-1", delivered_items: "one", quantity: 1n, serial_identifiers: "SN-1", submitted_at: "2026-10-05T08:00:00.000Z" }, { requestId: "precondition-delivery" });
    const deliveryClient = clientFor({ "get_award:[\"A-1\"]": { award_id: "A-1", state: "ACCEPTED", supplier, delivery_deadline: "2026-10-06T08:00:00.000Z" } });
    await expect(readActionPrecondition(deliveryClient, deliveryAction)).resolves.toEqual({ supplier });
    const evidenceClient = clientFor({ "get_tender_ids:[]": ["T-1"], "get_bids:[\"T-1\"]": [{ bid_id: "B-1", supplier, submitted_at: "2026-10-05T08:00:00.000Z" }], "get_evidence:[\"BID\",\"B-1\"]": [] });
    await expect(readActionPrecondition(evidenceClient, evidenceAction)).resolves.toEqual({ supplier });
  });

  it("fails closed when the canonical award read is unavailable", async () => {
    const deliveryAction = buildTypedAction("create_delivery", { delivery_id: "D-RPC", award_id: "A-1", delivery_reference: "GRN-1", delivered_items: "one", quantity: 1n, serial_identifiers: "SN-1", submitted_at: "2026-10-05T08:00:00.000Z" }, { requestId: "precondition-delivery-rpc" });
    const client = clientFor({ "get_award:[\"A-1\"]": new Error("RPC unavailable") });
    await expect(readActionPrecondition(client, deliveryAction)).rejects.toThrow(/RPC unavailable/);
  });

  it("verifies the specific created entity in canonical readback", async () => {
    const client = clientFor({ "get_bids:[\"T-1\"]": [{ bid_id: "B-NEW", tender_id: "T-1", state: "SUBMITTED" }] });
    await expect(readActionReadback(client, bidAction)).resolves.toMatchObject({ bid_id: "B-NEW" });
    const missing = clientFor({ "get_bids:[\"T-1\"]": [] });
    await expect(readActionReadback(missing, bidAction)).rejects.toThrow(/did not contain/);
  });
});
