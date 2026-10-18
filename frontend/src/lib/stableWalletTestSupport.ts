import { createLiveWalletClient, type BrowserProvider, type LiveClient } from "./liveAdapter";
import { BUYER_ROLE_ADDRESS, LIVE_CONTRACT, SUPPLIER_ROLE_ADDRESS, type Address } from "./liveConfig";
import { vi } from "vitest";

export const successfulStudionetTransaction = {
  statusName: "FINALIZED",
  resultName: "MAJORITY_AGREE",
  hash: `0x${"ab".repeat(32)}`,
  txId: `0x${"ab".repeat(32)}`,
  consensus_data: {
    leader_receipt: [{ execution_result: "SUCCESS", result: { status: "return" } }],
    validators: [
      { execution_result: "SUCCESS", vote: "agree" },
      { execution_result: "SUCCESS", vote: "agree" },
    ],
  },
};

export function mockStudionetRpc() {
  const requests: Array<{ method: string; params?: unknown[] }> = [];
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { id?: number; method?: string; params?: unknown[] };
    const method = body.method ?? "";
    requests.push({ method, params: body.params });
    let result: unknown = "0x0";
    if (method === "eth_getTransactionCount") result = "0x0";
    if (method === "eth_estimateGas") result = "0x30d40";
    if (method === "eth_gasPrice") result = "0x3b9aca00";
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, requests };
}

export function stableWalletForTest(options: {
  account?: Address;
  hashes?: string[];
  transaction?: () => Promise<Record<string, unknown>>;
} = {}): {
  client: LiveClient;
  provider: BrowserProvider;
  providerRequests: Array<{ method: string; params?: readonly unknown[] }>;
  sentTransactions: unknown[];
  getTransaction: ReturnType<typeof vi.fn>;
} {
  const account = options.account ?? BUYER_ROLE_ADDRESS;
  const hashes = [...(options.hashes ?? [`0x${"11".repeat(32)}`])];
  const providerRequests: Array<{ method: string; params?: readonly unknown[] }> = [];
  const sentTransactions: unknown[] = [];
  const provider: BrowserProvider = {
    request: async ({ method, params }) => {
      providerRequests.push({ method, params });
      if (method === "eth_chainId") return "0xf22f";
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [account];
      if (method === "eth_sendTransaction") {
        sentTransactions.push(params?.[0]);
        return hashes.shift() ?? `0x${"ff".repeat(32)}`;
      }
      throw new Error(`unexpected test wallet request: ${method}`);
    },
  };
  const client = createLiveWalletClient(account, provider);
  const getTransaction = vi.fn(options.transaction ?? (async () => ({ ...successfulStudionetTransaction, hash: `0x${"11".repeat(32)}`, txId: `0x${"11".repeat(32)}` })));
  Object.defineProperty(client, "getTransaction", {
    configurable: true,
    value: getTransaction,
  });
  if (client.chain.id !== 61999 || LIVE_CONTRACT !== "0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929" || ![BUYER_ROLE_ADDRESS, SUPPLIER_ROLE_ADDRESS].includes(account)) {
    throw new Error("test wallet configuration does not match the verified Studionet fixture");
  }
  return { client, provider, providerRequests, sentTransactions, getTransaction };
}
