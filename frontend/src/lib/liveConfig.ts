import type { Address } from "viem";
export type { Address } from "viem";

export const LIVE_NETWORK = "studio-dev" as const;
export const LIVE_CHAIN_ID = 61997 as const;
export const LIVE_RPC = "https://studio-dev.genlayer.com/api" as const;
export const LIVE_CONTRACT = "0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA" as Address;
export const LIVE_CONTRACT_SHA256 = "81708da07492a1d0b6fd26ee804479d9cd371861bf3de4ed62283d65dceb4143" as const;

export const BUYER_ROLE_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" as Address;
export const SUPPLIER_ROLE_ADDRESS = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8" as Address;

export const frontendModes = ["LIVE", "CONTROLLED DEMO", "HISTORICAL"] as const;
export type FrontendMode = (typeof frontendModes)[number];

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
