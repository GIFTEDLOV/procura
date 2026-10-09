import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell, legacyRoute, routeFromPath, type RouteKey } from "./components/Shell";
import { demoData } from "./lib/demoData";
import { createLiveWalletClient, executeLiveWrite, buildTypedAction, assertStudioDevWallet, loadPendingTransaction, recoverLiveTransaction, type StoredLiveTransaction } from "./lib/liveAdapter";
import { LIVE_CONTRACT, type FrontendMode } from "./lib/liveConfig";
import { readLiveSnapshot, type LiveSnapshot } from "./lib/liveData";
import { browserProvider, connectWallet, readWallet, type WalletState } from "./lib/wallet";
import { ProductScreens, LandingPage, NotFound } from "./screens/ProductScreens";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } } });
const modeKey = "procura:workspace-mode";

function initialMode(): FrontendMode { if (typeof window === "undefined") return "CONTROLLED DEMO"; const saved = window.localStorage.getItem(modeKey); return saved === "LIVE" || saved === "HISTORICAL" || saved === "CONTROLLED DEMO" ? saved : "CONTROLLED DEMO"; }
function storedTransactions(): unknown[] { if (typeof window === "undefined") return []; return Object.keys(window.localStorage).filter((key) => key.startsWith("procura:live-tx:")).map((key) => { try { return JSON.parse(window.localStorage.getItem(key) ?? "null"); } catch { return null; } }).filter(Boolean); }

function Application() {
  const queryClient = useQueryClient();
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));
  const [mode, setMode] = useState<FrontendMode>(initialMode);
  const [wallet, setWallet] = useState<WalletState>(() => ({ provider: browserProvider(), address: null, chainId: null, role: "disconnected", error: null }));
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [transactions, setTransactions] = useState<unknown[]>(storedTransactions);
  const liveQuery = useQuery<LiveSnapshot>({ queryKey: ["procura", "live", LIVE_CONTRACT], queryFn: readLiveSnapshot, enabled: mode === "LIVE" });

  useEffect(() => { window.localStorage.setItem(modeKey, mode); }, [mode]);
  useEffect(() => {
    const provider = browserProvider();
    if (!provider) return;
    void readWallet(provider).then(setWallet);
    const onAccounts = () => void readWallet(provider).then(setWallet);
    const onChain = () => void readWallet(provider).then(setWallet);
    provider.request({ method: "eth_accounts" }).catch(() => undefined);
    (provider as BrowserEvents).on?.("accountsChanged", onAccounts);
    (provider as BrowserEvents).on?.("chainChanged", onChain);
    return () => { (provider as BrowserEvents).removeListener?.("accountsChanged", onAccounts); (provider as BrowserEvents).removeListener?.("chainChanged", onChain); };
  }, []);
  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    const legacy = legacyRoute(window.location.pathname);
    if (legacy && !window.location.pathname.startsWith("/app/")) { window.history.replaceState({}, "", `/app/${legacy}${window.location.search}`); setRoute(legacy); }
    if (window.location.pathname === "/app") { window.history.replaceState({}, "", `/app/command-center${window.location.search}`); setRoute("command-center"); }
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (next: RouteKey) => { window.history.pushState({}, "", `/app/${next}`); setRoute(next); };
  const openApp = () => { window.history.pushState({}, "", "/app/command-center"); setRoute("command-center"); };
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["procura", "live", LIVE_CONTRACT] });
  const onConnect = async () => { setWallet(await connectWallet()); };
  const runAction = async (method: string, kwargs: Record<string, unknown>, value?: bigint | number | string) => {
    const provider = wallet.provider ?? browserProvider();
    if (!provider) throw new Error("Connect a browser wallet before submitting a LIVE write.");
    const account = await assertStudioDevWallet(provider);
    const action = buildTypedAction(method, kwargs, { requestId: crypto.randomUUID(), value });
    const client = createLiveWalletClient(account, provider);
    await executeLiveWrite({ client, action, account, storage: window.localStorage, canonicalReadback: async () => { const snapshot = await readLiveSnapshot(); queryClient.setQueryData(["procura", "live", LIVE_CONTRACT], snapshot); return snapshot; } });
    setTransactions(storedTransactions());
  };
  const recoverTransaction = async (requestId: string) => {
    const provider = wallet.provider ?? browserProvider();
    if (!provider) throw new Error("Connect the originating wallet before recovering this hash.");
    const account = await assertStudioDevWallet(provider);
    const record = loadPendingTransaction(requestId, window.localStorage);
    if (!record) throw new Error("No persisted transaction record was found.");
    const result = await recoverLiveTransaction({ client: createLiveWalletClient(account, provider), record, canonicalReadback: async () => { const snapshot = await readLiveSnapshot(); queryClient.setQueryData(["procura", "live", LIVE_CONTRACT], snapshot); return snapshot; } });
    void result;
    setTransactions(storedTransactions());
  };
  if (route === "landing") return <LandingPage onOpenApp={openApp} />;
  if (route === "not-found") return <NotFound onOpenApp={openApp} />;
  const state = new URLSearchParams(window.location.search).get("state");
  const forcedState = state === "loading" || state === "empty" || state === "error" ? state : null;
  const demoState = forcedState ? <ReadbackState state={forcedState} /> : null;
  const content = mode === "LIVE" && liveQuery.error ? <LiveError error={liveQuery.error} onRetry={refresh} /> : demoState ?? <ProductScreens route={route as RouteKey} mode={mode} demo={demoData} live={liveQuery.data ?? null} wallet={wallet} onNavigate={navigate} onRefresh={refresh} runAction={runAction} />;
  return <><Shell route={route as RouteKey} mode={mode} onNavigate={navigate} onModeChange={setMode} wallet={wallet} onConnect={onConnect} transactionCount={transactions.length} onOpenTransactions={() => { setTransactions(storedTransactions()); setTransactionsOpen(true); }}>{content}</Shell>{transactionsOpen && <TransactionDrawer transactions={transactions} onRecover={recoverTransaction} onClose={() => setTransactionsOpen(false)} />}</>;
}

type BrowserEvents = { on?: (event: string, callback: () => void) => void; removeListener?: (event: string, callback: () => void) => void };
function ReadbackState({ state }: { state: "loading" | "empty" | "error" }) { if (state === "loading") return <div data-state="loading" className="state-card"><div className="skeleton mx-auto h-4 w-44" /><p className="mt-4 text-sm text-slate-500">Loading canonical readback…</p></div>; if (state === "empty") return <div data-state="empty" className="state-card"><div className="text-sm font-semibold">Nothing to review yet</div><p className="mt-2 text-sm text-slate-500">This surface will populate when the selected mode returns a canonical record.</p></div>; return <div data-state="error" className="state-card state-error"><div className="text-sm font-semibold text-rose">RPC readback unavailable</div><p className="mt-2 text-sm leading-6 text-slate-600">Procura is not inventing protocol state. Retry when the configured RPC is healthy.</p></div>; }
function LiveError({ error, onRetry }: { error: unknown; onRetry: () => void }) { return <div className="space-y-6"><div className="eyebrow">LIVE · read error</div><h1 className="page-title">Canonical state is unavailable.</h1><div className="state-card state-error"><p className="text-sm leading-6 text-slate-600">The application received no trustworthy readback. Demo data is not being substituted.</p><code className="mt-4 block break-words rounded-xl bg-white p-3 text-xs text-rose">{error instanceof Error ? error.message : String(error)}</code><button className="secondary-button mt-5" onClick={onRetry}>Retry canonical reads</button></div></div>; }
function TransactionDrawer({ transactions, onRecover, onClose }: { transactions: unknown[]; onRecover: (requestId: string) => Promise<void>; onClose: () => void }) { return <div className="fixed inset-0 z-50 bg-ink/20" role="presentation" onClick={onClose}><aside role="dialog" aria-label="Transaction activity" onClick={(event) => event.stopPropagation()} className="ml-auto h-full w-full max-w-[500px] overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><div className="eyebrow">Activity center</div><h2 className="mt-1 text-xl font-semibold">Transaction recovery</h2></div><button className="secondary-button" onClick={onClose}>Close</button></div><p className="mt-3 text-sm leading-6 text-slate-500">Hashes are persisted before finality. Recovery reconciles the same hash and never rebroadcasts.</p><div className="mt-6 space-y-3">{transactions.length ? transactions.map((transaction, index) => { const record = transaction as Partial<StoredLiveTransaction>; return <div key={index} className="rounded-xl border border-line p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{record.method ?? "Transaction"}</span><button className="secondary-button px-2 py-1" onClick={() => void onRecover(String(record.requestId))}>Recover same hash</button></div><pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-ink p-3 text-[10px] leading-5 text-[#d8e5dd]">{JSON.stringify(transaction, null, 2)}</pre></div>; }) : <div className="rounded-xl border border-dashed border-line p-6 text-sm text-slate-500">No persisted transactions on this browser.</div>}</div></aside></div>; }

export default function App() { return <QueryClientProvider client={queryClient}><Application /></QueryClientProvider>; }
