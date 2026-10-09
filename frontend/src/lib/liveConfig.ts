import type { Address } from "viem";
export type { Address } from "viem";

export const LIVE_NETWORK = "studio-dev" as const;
export const LIVE_CHAIN_ID = 61997 as const;
export const LIVE_RPC = "https://studio-dev.genlayer.com/api" as const;
export const LIVE_CONTRACT = "0x88634c7868B0659b46C5bd93E4038222697a0170" as Address;
export const LIVE_CONTRACT_SHA256 = "daad9b0c43be603e522afbf55623e7b8027d7de3b01708922360ae5a45972cde" as const;

export const BUYER_ROLE_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" as Address;
export const SUPPLIER_ROLE_ADDRESS = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8" as Address;

export const frontendModes = ["LIVE", "CONTROLLED DEMO", "HISTORICAL"] as const;
export type FrontendMode = (typeof frontendModes)[number];

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
