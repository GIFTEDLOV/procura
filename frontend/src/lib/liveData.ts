import { createLiveReadClient } from "./liveAdapter";
import { LIVE_CONTRACT, LIVE_CONTRACT_SHA256, LIVE_CHAIN_ID, LIVE_NETWORK } from "./liveConfig";

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
