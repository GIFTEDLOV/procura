import type { Address } from "viem";
export type { Address } from "viem";

export const LIVE_NETWORK = "studio-dev" as const;
export const LIVE_CHAIN_ID = 61997 as const;
export const LIVE_RPC = "https://studio-dev.genlayer.com/api" as const;
export const LIVE_CONTRACT = "0xE9f1319e98F25E301ee167aF41f82E25cC4f8770" as Address;
export const LIVE_CONTRACT_SHA256 = "95f7cc706decbb3e38eb0a1f6f0014ffc2279ac6c3d07d883199b44cacc36fed" as const;

export const BUYER_ROLE_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" as Address;
export const SUPPLIER_ROLE_ADDRESS = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8" as Address;

export const frontendModes = ["LIVE", "CONTROLLED DEMO", "HISTORICAL"] as const;
export type FrontendMode = (typeof frontendModes)[number];

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
