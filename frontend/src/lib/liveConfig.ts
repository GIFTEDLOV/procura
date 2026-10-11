import type { Address } from "viem";
export type { Address } from "viem";

export const LIVE_NETWORK = "studio-dev" as const;
export const LIVE_CHAIN_ID = 61997 as const;
export const LIVE_RPC = "https://studio-dev.genlayer.com/api" as const;
export const LIVE_CONTRACT = "0x88634c7868B0659b46C5bd93E4038222697a0170" as Address;
export const LIVE_CONTRACT_SHA256 = "daad9b0c43be603e522afbf55623e7b8027d7de3b01708922360ae5a45972cde" as const;

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
export function liveV1WriteBlockReason(method: string): string | null {
  return (LIVE_V1_WRITE_METHODS as readonly string[]).includes(method) ? V1_LIVE_READ_ONLY_MESSAGE : null;
}

export const BUYER_ROLE_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" as Address;
export const SUPPLIER_ROLE_ADDRESS = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8" as Address;

export const frontendModes = ["LIVE", "CONTROLLED DEMO", "HISTORICAL"] as const;
export type FrontendMode = (typeof frontendModes)[number];

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
