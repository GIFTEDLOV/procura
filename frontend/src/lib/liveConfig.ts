import type { Address } from "viem";
export type { Address } from "viem";

export const LIVE_NETWORK = "studionet" as const;
export const LIVE_CHAIN_ID = 61999 as const;
export const STUDIONET_RPC = "https://studio.genlayer.com/api" as const;
// Studionet omits browser CORS headers, so Vite and Vercel proxy this same-origin path to the canonical RPC.
export const STUDIONET_RPC_PROXY_PATH = "/_genlayer/studionet" as const;
export function liveRpcEndpoint(origin: string): string {
  return new URL(STUDIONET_RPC_PROXY_PATH, origin).toString();
}
export const LIVE_RPC = liveRpcEndpoint(typeof window === "undefined" ? "http://localhost" : window.location.origin);
export const LIVE_CONTRACT = "0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929" as Address;
export const LIVE_CONTRACT_SHA256 = "a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac" as const;
const VERIFIED_V2_STUDIONET_CONTRACT = "0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929";

export const V1_LIVE_READ_ONLY_MESSAGE = "Procura V1 is operating in read-only safety mode. Transaction functionality will resume after V2 qualification.";
export const LIVE_V1_WRITE_METHODS = [
  "create_tender",
  "add_requirement",
  "add_certification_requirement",
  "freeze_tender",
  "fund_tender",
  "cancel_tender",
  "submit_bid",
  "add_bid_evidence",
  "begin_bid_evaluation",
  "adjudicate_requirement",
  "finalize_bid_evaluation",
  "award_bid",
  "accept_award",
  "post_supplier_bond",
  "create_delivery",
  "add_delivery_evidence",
  "begin_inspection",
  "adjudicate_delivery",
  "accept_delivery",
  "reject_delivery",
  "release_milestone",
  "settle_award",
  "refund_buyer",
  "open_dispute",
  "resolve_dispute",
] as const;

/** V1 is immutable and has unsafe caller-controlled timestamp write paths. */
export function legacyV1WriteBlockReason(method: string): string | null {
  return (LIVE_V1_WRITE_METHODS as readonly string[]).includes(method) ? V1_LIVE_READ_ONLY_MESSAGE : null;
}

/** Keep V1 fail-closed if a caller targets a legacy deployment; the pinned V2 target stays writable. */
export function liveV1WriteBlockReason(method: string, target: string = LIVE_CONTRACT): string | null {
  if (Number(LIVE_CHAIN_ID) === 61999 && sameAddress(target, VERIFIED_V2_STUDIONET_CONTRACT)) return null;
  return legacyV1WriteBlockReason(method);
}

export const BUYER_ROLE_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" as Address;
export const SUPPLIER_ROLE_ADDRESS = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8" as Address;

export const frontendModes = ["LIVE", "CONTROLLED DEMO", "HISTORICAL"] as const;
export type FrontendMode = (typeof frontendModes)[number];

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
