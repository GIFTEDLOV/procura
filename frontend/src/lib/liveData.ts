import { createLiveReadClient } from "./liveAdapter";
import type { RoleContext, TypedAction } from "./liveAdapter";
import { LIVE_CONTRACT, LIVE_CONTRACT_SHA256, LIVE_CHAIN_ID, LIVE_NETWORK, type Address } from "./liveConfig";
import { parseU256 } from "./serialization";

export type LiveReadStatus = "ready" | "empty" | "partial";

export type LiveSnapshot = {
  mode: "LIVE";
  fetchedAt: string;
  status: LiveReadStatus;
  protocolInfo: unknown;
  tenderIds: string[];
  tenders: Array<{ id: string; state: unknown; requirements: unknown; bids: unknown }>;
  accounting: unknown;
  auditEvents: unknown;
  errors: string[];
  network: typeof LIVE_NETWORK;
  chainId: typeof LIVE_CHAIN_ID;
  contract: typeof LIVE_CONTRACT;
  sourceSha: typeof LIVE_CONTRACT_SHA256;
};

export type CanonicalTenderTerms = { currencyLabel: string; budgetCeiling: string | bigint | number; bidDeadline: string };

type ReadClient = { readContract: (args: { address: typeof LIVE_CONTRACT; functionName: string; args?: never[] }) => Promise<unknown> };

function field(record: unknown, name: string): unknown {
  if (!record || typeof record !== "object") return undefined;
  return (record as Record<string, unknown>)[name];
}

function recordId(record: unknown, name: string): string | null {
  const value = field(record, name);
  return typeof value === "string" ? value : null;
}

function addressText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { as_hex?: unknown }).as_hex === "string") return (value as { as_hex: string }).as_hex;
  throw new Error("canonical record did not contain an address");
}

function stateText(record: unknown): string {
  const value = field(record, "state");
  return typeof value === "string" ? value : "";
}

export function canonicalTenderTerms(tender: LiveSnapshot["tenders"][number] | undefined): CanonicalTenderTerms | null {
  const canonical = tender?.state;
  const currencyLabel = field(canonical, "currency_label");
  const budgetCeiling = field(canonical, "budget_ceiling");
  const bidDeadline = field(canonical, "bid_deadline");
  if (typeof currencyLabel !== "string" || (typeof budgetCeiling !== "string" && typeof budgetCeiling !== "bigint" && typeof budgetCeiling !== "number") || typeof bidDeadline !== "string") return null;
  return { currencyLabel, budgetCeiling, bidDeadline };
}

async function read(client: ReadClient, functionName: string, args: unknown[] = []): Promise<unknown> {
  return client.readContract({ address: LIVE_CONTRACT, functionName, args: args as never[] });
}

async function canonicalBid(client: ReadClient, bidId: string): Promise<unknown> {
  const tenderIds = ids(await read(client, "get_tender_ids"));
  for (const tenderId of tenderIds) {
    const bids = await read(client, "get_bids", [tenderId]);
    if (Array.isArray(bids)) {
      const found = bids.find((candidate) => recordId(candidate, "bid_id") === bidId);
      if (found) return found;
    }
  }
  throw new Error(`canonical bid ${bidId} was not found`);
}

export async function readActionPrecondition(client: ReadClient, action: TypedAction): Promise<RoleContext> {
  const { method, kwargs } = action;
  if (method === "create_tender") return {};
  if (method === "submit_bid") {
    const tender = await read(client, "get_tender", [kwargs.tender_id]);
    if (recordId(tender, "tender_id") !== kwargs.tender_id) throw new Error("canonical readback returned the wrong tender for bid submission");
    if (!["FROZEN", "FUNDED"].includes(stateText(tender))) throw new Error("canonical tender is not accepting bids");
    if (field(tender, "currency_label") !== kwargs.currency) throw new Error("bid currency does not match the canonical tender");
    if (parseU256(kwargs.price as bigint, "price") > parseU256(field(tender, "budget_ceiling") as string | bigint | number, "canonical budget_ceiling")) throw new Error("bid price exceeds the canonical tender budget ceiling");
    if (typeof field(tender, "bid_deadline") !== "string" || String(kwargs.submitted_at) > String(field(tender, "bid_deadline"))) throw new Error("bid timestamp is after the canonical tender deadline");
    const bids = await read(client, "get_bids", [kwargs.tender_id]);
    if (Array.isArray(bids) && bids.some((candidate) => recordId(candidate, "bid_id") === kwargs.bid_id)) throw new Error("bid id already exists in canonical state");
    return {};
  }
  if (method === "create_delivery") {
    const award = await read(client, "get_award", [kwargs.award_id]);
    if (recordId(award, "award_id") !== kwargs.award_id) throw new Error("canonical readback returned the wrong award for delivery submission");
    if (stateText(award) !== "ACCEPTED") throw new Error("delivery requires a canonical accepted award");
    const deliveryDeadline = field(award, "delivery_deadline");
    if (typeof deliveryDeadline !== "string") throw new Error("canonical award has no valid delivery deadline");
    if (String(kwargs.submitted_at) > deliveryDeadline) throw new Error("delivery timestamp is after the canonical award deadline");
    // The deployed view exposes no delivery-id index and reports both a
    // missing key and some runtime failures as the same RPC execution error.
    // Do not guess that an unavailable read means the ID is free: the shared
    // simulation below is the authoritative duplicate guard before broadcast.
    return { supplier: addressText(field(award, "supplier")) as Address };
  }
  if (method === "add_bid_evidence") {
    const bid = await canonicalBid(client, String(kwargs.bid_id));
    const bidSubmittedAt = field(bid, "submitted_at");
    if (typeof bidSubmittedAt !== "string") throw new Error("canonical bid has no valid submitted_at timestamp");
    if (String(kwargs.observed_at) > bidSubmittedAt) throw new Error("bid evidence timestamp is after the canonical bid timestamp");
    const evidence = await read(client, "get_evidence", ["BID", kwargs.bid_id]);
    if (Array.isArray(evidence) && evidence.some((candidate) => recordId(candidate, "evidence_id") === kwargs.evidence_id)) throw new Error("evidence id already exists in canonical state");
    return { supplier: addressText(field(bid, "supplier")) as Address };
  }
  if (method === "add_delivery_evidence") {
    const delivery = await read(client, "get_delivery", [kwargs.delivery_id]);
    if (recordId(delivery, "delivery_id") !== kwargs.delivery_id) throw new Error("canonical readback returned the wrong delivery for evidence");
    const deliverySubmittedAt = field(delivery, "submitted_at");
    if (typeof deliverySubmittedAt !== "string") throw new Error("canonical delivery has no valid submitted_at timestamp");
    if (String(kwargs.observed_at) > deliverySubmittedAt) throw new Error("delivery evidence timestamp is after the canonical delivery timestamp");
    const evidence = await read(client, "get_evidence", ["DELIVERY", kwargs.delivery_id]);
    if (Array.isArray(evidence) && evidence.some((candidate) => recordId(candidate, "evidence_id") === kwargs.evidence_id)) throw new Error("evidence id already exists in canonical state");
    return { supplier: addressText(field(delivery, "supplier")) as Address };
  }
  return {};
}

export async function readActionReadback(client: ReadClient, action: TypedAction): Promise<unknown> {
  if (action.method === "create_tender") {
    const tender = await read(client, "get_tender", [action.kwargs.tender_id]);
    if (recordId(tender, "tender_id") !== action.kwargs.tender_id) throw new Error("canonical readback returned the wrong tender");
    return tender;
  }
  if (action.method === "submit_bid") {
    const bids = await read(client, "get_bids", [action.kwargs.tender_id]);
    const bid = Array.isArray(bids) ? bids.find((candidate) => recordId(candidate, "bid_id") === action.kwargs.bid_id) : undefined;
    if (!bid) throw new Error("canonical readback did not contain the submitted bid");
    return bid;
  }
  if (action.method === "create_delivery") {
    const delivery = await read(client, "get_delivery", [action.kwargs.delivery_id]);
    if (recordId(delivery, "delivery_id") !== action.kwargs.delivery_id) throw new Error("canonical readback returned the wrong delivery");
    return delivery;
  }
  if (action.method === "add_bid_evidence" || action.method === "add_delivery_evidence") {
    const entityType = action.method === "add_bid_evidence" ? "BID" : "DELIVERY";
    const evidence = await read(client, "get_evidence", [entityType, action.kwargs[entityType === "BID" ? "bid_id" : "delivery_id"]]);
    const item = Array.isArray(evidence) ? evidence.find((candidate) => recordId(candidate, "evidence_id") === action.kwargs.evidence_id) : undefined;
    if (!item) throw new Error(`canonical readback did not contain evidence ${action.kwargs.evidence_id}`);
    return item;
  }
  throw new Error(`no canonical readback verifier exists for ${action.method}`);
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  try { return JSON.stringify(value); } catch { return String(value); }
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

export async function readLiveSnapshot(): Promise<LiveSnapshot> {
  const client = createLiveReadClient();
  const errors: string[] = [];
  const read = async (functionName: string, args: unknown[] = []) => client.readContract({ address: LIVE_CONTRACT, functionName, args: args as never[] });
  const settled = await Promise.allSettled([
    read("get_protocol_info"),
    read("get_tender_ids"),
    read("get_accounting"),
    read("get_audit_events"),
  ]);
  const [protocolInfoResult, tenderIdsResult, accountingResult, auditResult] = settled;
  const value = <T,>(result: PromiseSettledResult<T>, label: string): T | null => {
    if (result.status === "fulfilled") return result.value;
    errors.push(`${label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    return null;
  };
  const protocolInfo = value(protocolInfoResult, "get_protocol_info");
  const rawIds = value(tenderIdsResult, "get_tender_ids");
  const accounting = value(accountingResult, "get_accounting");
  const auditEvents = value(auditResult, "get_audit_events");
  const tenderIds = ids(rawIds);
  const tenders = await Promise.all(tenderIds.map(async (id) => {
    const [state, requirements, bids] = await Promise.allSettled([read("get_tender", [id]), read("get_requirements", [id]), read("get_bids", [id])]);
    return {
      id,
      state: value(state, `get_tender(${id})`),
      requirements: value(requirements, `get_requirements(${id})`),
      bids: value(bids, `get_bids(${id})`),
    };
  }));
  const baseAvailable = protocolInfo !== null || rawIds !== null || accounting !== null || auditEvents !== null;
  return {
    mode: "LIVE",
    fetchedAt: new Date().toISOString(),
    status: !baseAvailable ? "partial" : tenderIds.length === 0 ? "empty" : errors.length ? "partial" : "ready",
    protocolInfo,
    tenderIds,
    tenders,
    accounting,
    auditEvents,
    errors,
    network: LIVE_NETWORK,
    chainId: LIVE_CHAIN_ID,
    contract: LIVE_CONTRACT,
    sourceSha: LIVE_CONTRACT_SHA256,
  };
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2); } catch { return String(value); }
}
