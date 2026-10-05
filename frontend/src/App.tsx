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
  const content = route === "evaluation-room" ? <EvaluationRoom data={data} /> : route === "inspection-room" ? <InspectionRoom data={data} /> : route === "payments" ? <SettlementLedger data={data} /> : <Workspace route={route} data={data} onNavigate={navigate} />;
  return <Shell route={route} mode={data.mode} onNavigate={navigate}>{content}</Shell>;
}

export default function App() { return <QueryClientProvider client={queryClient}><Application /></QueryClientProvider>; }
