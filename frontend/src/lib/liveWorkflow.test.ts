import { describe, expect, it, vi } from "vitest";
import { buildTypedAction, executeLiveWrite } from "./liveAdapter";
import { LIVE_CHAIN_ID, LIVE_CONTRACT, BUYER_ROLE_ADDRESS, SUPPLIER_ROLE_ADDRESS } from "./liveConfig";
import { readActionPrecondition, readActionReadback } from "./liveData";
import { manifestMethod } from "./interfaceManifest";
import { buildAddBidEvidenceArgs, buildAddDeliveryEvidenceArgs, buildCreateDeliveryArgs, buildCreateTenderArgs, buildSubmitBidArgs, sha256File, type EvidenceForm } from "./serialization";

vi.mock("./liveConfig", async () => ({
  ...(await vi.importActual<typeof import("./liveConfig")>("./liveConfig")),
  liveV1WriteBlockReason: () => null,
}));

const timestamp = "2026-10-05T08:00:00.000Z";
function readClientFor(values: Record<string, unknown>) {
  return { readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
    const key = `${functionName}:${JSON.stringify(args ?? [])}`;
    if (!(key in values)) throw new Error(`missing canonical test read ${key}`);
    const value = values[key];
    if (value instanceof Error) throw value;
    return value;
  }) };
}

function queuedReadClientFor(values: Record<string, unknown[]>) {
  return { readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
    const key = `${functionName}:${JSON.stringify(args ?? [])}`;
    const queue = values[key];
    if (!queue?.length) throw new Error(`missing queued canonical test read ${key}`);
    const value = queue.shift();
    if (value instanceof Error) throw value;
    return value;
  }) };
}

function sdkClient() {
  let sequence = 0;
  const writeContract = vi.fn(async (_request: { functionName: string; args: unknown[] }) => `0x${String(++sequence).padStart(64, "0")}`);
  const client = {
    chain: { id: LIVE_CHAIN_ID },
    simulateWriteContract: vi.fn(async () => ({})),
    estimateTransactionFees: vi.fn(async () => ({ feeValue: 10n, distribution: { totalMessageFees: 0n }, messageAllocations: undefined })),
    writeContract,
    waitForFinalization: vi.fn(async () => ({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" })),
  } as unknown as Parameters<typeof executeLiveWrite>[0]["client"];
  return { client, writeContract };
}

async function runAction(method: string, kwargs: Record<string, unknown>, account: `0x${string}`, readClient: ReturnType<typeof readClientFor>, roleContext?: { buyer?: `0x${string}`; supplier?: `0x${string}` }) {
  const action = buildTypedAction(method, kwargs, { requestId: `live-workflow-${method}` });
  const { client, writeContract } = sdkClient();
  const result = await executeLiveWrite({
    client,
    action,
    account,
    roleContext,
    readPrecondition: () => readActionPrecondition(readClient, action),
    canonicalReadback: () => readActionReadback(readClient, action),
  });
  expect(result.readback).toBeTruthy();
  expect(writeContract).toHaveBeenCalledOnce();
  const call = writeContract.mock.calls[0][0] as { functionName: string; args: unknown[] };
  expect(call.functionName).toBe(method);
  expect(call.args).toEqual(manifestMethod(method).arguments.map((name) => kwargs[name]));
}

describe("LIVE workflow action runner", () => {
  it("executes all five steward workflows through schema args, canonical preconditions, and entity readback", async () => {
    const tender = await buildCreateTenderArgs({ tenderId: "T-LIVE", title: "Live tender", description: "Canonical tender", category: "ENERGY", currencyLabel: "GEN", budgetCeiling: "100", bidDeadline: timestamp, evaluationDeadline: "2026-10-06T08:00:00.000Z", deliveryDeadline: "2026-10-07T08:00:00.000Z", equivalencePolicy: "STRICT", evaluationPolicy: "OBJECTIVE", paymentPolicy: "FULL", supplierBondPolicy: "NONE" });
    await runAction("create_tender", tender, BUYER_ROLE_ADDRESS, readClientFor({ "get_tender:[\"T-LIVE\"]": { tender_id: "T-LIVE" } }), { buyer: BUYER_ROLE_ADDRESS });

    const bid = await buildSubmitBidArgs({ bidId: "B-LIVE", tenderId: "T-LIVE", price: "42", currency: "GEN", deliveryCommitment: "30 days", requirementResponses: "{}", submittedAt: timestamp, tenderCurrency: "GEN", tenderBudgetCeiling: "100", tenderBidDeadline: "2026-10-06T08:00:00.000Z" });
    const tenderRead = { tender_id: "T-LIVE", state: "FUNDED", currency_label: "GEN", budget_ceiling: 100n, bid_deadline: "2026-10-06T08:00:00Z" };
    const bidRead = { bid_id: "B-LIVE", tender_id: "T-LIVE", supplier: SUPPLIER_ROLE_ADDRESS, submitted_at: timestamp };
    await runAction("submit_bid", bid, SUPPLIER_ROLE_ADDRESS, queuedReadClientFor({ "get_tender:[\"T-LIVE\"]": [tenderRead], "get_bids:[\"T-LIVE\"]": [[], [bidRead]] }), { supplier: SUPPLIER_ROLE_ADDRESS });

    const delivery = await buildCreateDeliveryArgs({ deliveryId: "D-LIVE", awardId: "A-LIVE", deliveryReference: "GRN-LIVE", deliveredItems: "one unit", quantity: "1", serialIdentifiers: "SN-LIVE", submittedAt: timestamp, awardDeliveryDeadline: "2026-10-07T08:00:00.000Z" });
    const awardRead = { award_id: "A-LIVE", state: "ACCEPTED", supplier: SUPPLIER_ROLE_ADDRESS, delivery_deadline: "2026-10-07T08:00:00Z" };
    await runAction("create_delivery", delivery, SUPPLIER_ROLE_ADDRESS, readClientFor({ "get_award:[\"A-LIVE\"]": awardRead, "get_delivery:[\"D-LIVE\"]": { delivery_id: "D-LIVE" } }), { supplier: SUPPLIER_ROLE_ADDRESS });

    const file = { arrayBuffer: async () => new TextEncoder().encode("evidence bytes").buffer } as unknown as Blob;
    const digest = await sha256File(file);
    const evidenceBase: Omit<EvidenceForm, "entityId"> = { evidenceId: "E-LIVE", authority: "Authority", sourceUrl: "https://example.test/evidence", contentSha256: digest.contentSha256, contentByteLength: digest.contentByteLength, observedAt: "2026-10-05T07:00:00.000Z", publishedAt: "2026-10-05T06:00:00.000Z", evidenceType: "receipt", entitySubmittedAt: timestamp };
    const bidEvidence = buildAddBidEvidenceArgs({ ...evidenceBase, entityId: "B-LIVE" });
    await runAction("add_bid_evidence", bidEvidence, SUPPLIER_ROLE_ADDRESS, queuedReadClientFor({ "get_tender_ids:[]": [["T-LIVE"]], "get_bids:[\"T-LIVE\"]": [ [bidRead] ], "get_evidence:[\"BID\",\"B-LIVE\"]": [[], [{ evidence_id: "E-LIVE" }]] }), { supplier: SUPPLIER_ROLE_ADDRESS });

    const deliveryEvidence = buildAddDeliveryEvidenceArgs({ ...evidenceBase, entityId: "D-LIVE", evidenceId: "E-DELIVERY" });
    const deliveryRead = { delivery_id: "D-LIVE", supplier: SUPPLIER_ROLE_ADDRESS, submitted_at: timestamp };
    await runAction("add_delivery_evidence", deliveryEvidence, SUPPLIER_ROLE_ADDRESS, queuedReadClientFor({ "get_delivery:[\"D-LIVE\"]": [deliveryRead], "get_evidence:[\"DELIVERY\",\"D-LIVE\"]": [[], [{ evidence_id: "E-DELIVERY" }]] }), { supplier: SUPPLIER_ROLE_ADDRESS });
  });

});
