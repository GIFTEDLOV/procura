import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Shell, routeFromPath, type RouteKey } from "./components/Shell";
import { demoData } from "./lib/demoData";
import { EvaluationRoom } from "./screens/EvaluationRoom";
import { InspectionRoom } from "./screens/InspectionRoom";
import { SettlementLedger } from "./screens/SettlementLedger";
import { Workspace } from "./screens/Workspace";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });

function Application() {
  const [route, setRoute] = useState<RouteKey>(() => routeFromPath(window.location.pathname));
  const { data } = useQuery({ queryKey: ["procura", "controlled-demo"], queryFn: async () => demoData });
  useEffect(() => { const handler = () => setRoute(routeFromPath(window.location.pathname)); window.addEventListener("popstate", handler); return () => window.removeEventListener("popstate", handler); }, []);
  const navigate = (next: RouteKey) => { window.history.pushState({}, "", `/${next}`); setRoute(next); };
  if (!data) return null;
  const state = new URLSearchParams(window.location.search).get("state");
  if (state === "loading" || state === "empty" || state === "error") return <Shell route={route} mode={data.mode} onNavigate={navigate}><ReadbackState state={state} /></Shell>;
  const content = route === "evaluation-room" ? <EvaluationRoom data={data} /> : route === "inspection-room" ? <InspectionRoom data={data} /> : route === "payments" ? <SettlementLedger data={data} /> : <Workspace route={route} data={data} onNavigate={navigate} />;
  return <Shell route={route} mode={data.mode} onNavigate={navigate}>{content}</Shell>;
}

export default function App() { return <QueryClientProvider client={queryClient}><Application /></QueryClientProvider>; }

function ReadbackState({ state }: { state: "loading" | "empty" | "error" }) {
  if (state === "loading") return <div data-state="loading" className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-slate-500">Loading canonical readback…</div>;
  if (state === "empty") return <div data-state="empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center"><div className="text-sm font-semibold">Nothing to review yet</div><p className="mt-2 text-sm text-slate-500">This surface will populate when the contract returns a canonical record.</p></div>;
  return <div data-state="error" className="rounded-2xl border border-[#ecc4bf] bg-[#fff8f7] p-6"><div className="text-sm font-semibold text-rose">RPC readback unavailable</div><p className="mt-2 text-sm leading-6 text-slate-600">Procura is not inventing protocol state. Retry when the configured RPC is healthy.</p></div>;
}
