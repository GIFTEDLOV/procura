import { describe, expect, it } from "vitest";
import schema from "../../../contracts/schema.json";
import iface from "../../../contracts/interface.json";
import { buildTypedAction } from "./liveAdapter";
import { manifestMethod } from "./interfaceManifest";
import { sharedWorkflowMethods } from "./serialization";

const timestamp = "2026-10-05T08:00:00.000Z";
const hash = "b".repeat(64);
const workflowArgs: Record<string, Record<string, unknown>> = {
  create_tender: { tender_id: "T-1", title: "Title", description: "Description", category: "ENERGY", currency_label: "GEN", budget_ceiling: 100n, bid_deadline: timestamp, evaluation_deadline: "2026-10-06T08:00:00.000Z", delivery_deadline: "2026-10-07T08:00:00.000Z", equivalence_policy: "STRICT", evaluation_policy: "OBJECTIVE", payment_policy: "FULL", supplier_bond_policy: "NONE", tender_hash: hash },
  submit_bid: { bid_id: "B-1", tender_id: "T-1", price: 10n, currency: "GEN", delivery_commitment: "30 days", requirement_responses: "{}", submitted_at: timestamp, bid_hash: hash },
  create_delivery: { delivery_id: "D-1", award_id: "A-1", delivery_reference: "GRN-1", delivered_items: "one", quantity: 1n, serial_identifiers: "SN-1", submitted_at: timestamp },
  add_bid_evidence: { bid_id: "B-1", evidence_id: "E-1", authority: "Authority", source_url: "https://example.test/bid", content_sha256: hash, content_byte_length: 4n, observed_at: timestamp, published_at: timestamp, evidence_type: "receipt" },
  add_delivery_evidence: { delivery_id: "D-1", evidence_id: "E-2", authority: "Authority", source_url: "https://example.test/delivery", content_sha256: hash, content_byte_length: 4n, observed_at: timestamp, published_at: timestamp, evidence_type: "receipt" },
};

describe("shared schema action boundary", () => {
  it("uses the same five workflow names and argument order as contracts/schema.json", () => {
    expect([...sharedWorkflowMethods].sort()).toEqual(["add_bid_evidence", "add_delivery_evidence", "create_delivery", "create_tender", "submit_bid"]);
    for (const method of sharedWorkflowMethods) expect(manifestMethod(method).arguments).toEqual(Object.keys(workflowArgs[method]));
  });

  it("maps each workflow to ordered SDK args with runtime types", () => {
    for (const method of sharedWorkflowMethods) {
      const action = buildTypedAction(method, workflowArgs[method], { requestId: `schema-${method}` });
      expect(action.args).toEqual(manifestMethod(method).arguments.map((name) => workflowArgs[method][name]));
      expect(action.args.filter((value) => typeof value === "bigint").length).toBeGreaterThan(0);
    }
  });

  it("fails closed for missing, extra, malformed, and out-of-order arguments", () => {
    const base = workflowArgs.create_tender;
    const { title: _title, ...missing } = base;
    expect(() => buildTypedAction("create_tender", missing, { requestId: "missing" })).toThrow(/missing=title/);
    expect(() => buildTypedAction("create_tender", { ...base, extra: "nope" }, { requestId: "extra" })).toThrow(/extra=extra/);
    expect(() => buildTypedAction("create_tender", { ...base, bid_deadline: 1700000000 }, { requestId: "type" })).toThrow();
    expect(() => buildTypedAction("create_tender", { ...base, bid_deadline: "2026-10-08T08:00:00.000Z" }, { requestId: "order" })).toThrow(/deadlines/);
    expect(() => buildTypedAction("submit_bid", { ...workflowArgs.submit_bid, bid_hash: `0x${hash}` }, { requestId: "hash" })).toThrow();
  });

  it("keeps the checked-in schema and interface manifest at parity", () => {
    const schemaNames = schema.methods.map((method) => method.name);
    expect(schema.schemaVersion).toBe(iface.schemaVersion);
    expect(schemaNames).toEqual(iface.methods);
    expect(new Set(schemaNames).size).toBe(schemaNames.length);
  });
});
