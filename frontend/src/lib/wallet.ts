import { BUYER_ROLE_ADDRESS, LIVE_CHAIN_ID, LIVE_NETWORK, sameAddress, SUPPLIER_ROLE_ADDRESS } from "./liveConfig";
import type { BrowserProvider } from "./liveAdapter";
import type { Address } from "viem";

export type WalletRole = "buyer" | "supplier" | "observer" | "disconnected";
export type WalletState = { provider: BrowserProvider | null; address: Address | null; chainId: number | null; role: WalletRole; error: string | null };

export function browserProvider(): BrowserProvider | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { ethereum?: BrowserProvider }).ethereum;
  return candidate ?? null;
}

export function roleForAddress(address: string | null): WalletRole {
  if (!address) return "disconnected";
  if (sameAddress(address, BUYER_ROLE_ADDRESS)) return "buyer";
  if (sameAddress(address, SUPPLIER_ROLE_ADDRESS)) return "supplier";
  return "observer";
}

export async function readWallet(provider: BrowserProvider | null): Promise<WalletState> {
  if (!provider) return { provider: null, address: null, chainId: null, role: "disconnected", error: null };
  try {
    const chain = await provider.request({ method: "eth_chainId" });
    const chainId = typeof chain === "string" ? Number.parseInt(chain, 16) : Number(chain);
    const accounts = await provider.request({ method: "eth_accounts" });
    const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] as Address : null;
    return { provider, address, chainId, role: roleForAddress(address), error: chainId === LIVE_CHAIN_ID ? null : `Wrong network: switch to ${LIVE_NETWORK} (${LIVE_CHAIN_ID}).` };
  } catch (error) {
    return { provider, address: null, chainId: null, role: "disconnected", error: error instanceof Error ? error.message : String(error) };
  }
}

export async function connectWallet(): Promise<WalletState> {
  const provider = browserProvider();
  if (!provider) return { provider: null, address: null, chainId: null, role: "disconnected", error: "No browser wallet detected. Public reads remain available." };
  await provider.request({ method: "eth_requestAccounts" });
  return readWallet(provider);
}

export function shortAddress(address: string | null): string { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"; }
