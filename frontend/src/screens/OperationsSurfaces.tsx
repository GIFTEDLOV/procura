import { useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, FileCheck2, FileText, PackageCheck, ShieldCheck } from "lucide-react";
import { Panel, PanelHeader } from "../components/Panel";
import { StatusBadge } from "../components/StatusBadge";
import type { DemoData } from "../types/procura";
import type { RouteKey } from "../components/Shell";

function StateFrame({ state, children }: { state: string; children: React.ReactNode }) {
  if (state === "loading") return <div data-state="loading" className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-slate-500">Loading canonical readback…</div>;
  if (state === "empty") return <div data-state="empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center"><div className="text-sm font-semibold">Nothing to review yet</div><p className="mt-2 text-sm text-slate-500">This surface will populate when the contract returns a canonical record.</p></div>;
  if (state === "error") return <div data-state="error" className="rounded-2xl border border-[#ecc4bf] bg-[#fff8f7] p-6"><div className="flex items-center gap-2 text-sm font-semibold text-rose"><CircleAlert size={16} />RPC readback unavailable</div><p className="mt-2 text-sm leading-6 text-slate-600">Procura is not inventing protocol state. Retry when the configured RPC is healthy.</p></div>;
  return <div data-state="populated">{children}</div>;
}

function Header({ eyebrow, title, detail, mode }: { eyebrow: string; title: string; detail: string; mode: DemoData["mode"] }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{detail}</p></div><StatusBadge label={mode} /></div>;
}

function Tenders({ data, onNavigate }: { data: DemoData; onNavigate: (route: RouteKey) => void }) {
  return <div className="space-y-6"><Header eyebrow="Operate" title="Tenders" detail="Track frozen requirements, commercial deadlines, and escrow readiness." mode={data.mode} /><Panel><PanelHeader eyebrow="Active procurement" title={data.tender.title} detail={`${data.tender.id} · ${data.tender.deadline}`} action={<button className="primary-button" onClick={() => onNavigate("tender-room")}>Open tender <ArrowRight size={15} /></button>} /><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-line text-xs uppercase tracking-[.12em] text-slate-400"><tr><th className="px-5 py-3">Tender</th><th className="px-5 py-3">State</th><th className="px-5 py-3">Requirements</th><th className="px-5 py-3">Escrow</th></tr></thead><tbody><tr><td className="px-5 py-4 font-semibold">{data.tender.title}</td><td className="px-5 py-4"><StatusBadge label="FROZEN" /></td><td className="px-5 py-4">{data.requirements.length} frozen</td><td className="px-5 py-4">{data.tender.funded.toLocaleString()} {data.tender.currency}</td></tr></tbody></table></div></Panel></div>;
}

function TenderRoom({ data }: { data: DemoData }) {
  return <div className="space-y-6"><Header eyebrow="Tender room · frozen" title="Tender Room" detail="The requirement set is versioned and immutable after freeze." mode={data.mode} /><Panel><PanelHeader eyebrow="PROCUREMENT_V1" title="Frozen requirements" detail="All supplier decisions reference these exact versions." /><div className="divide-y divide-line">{data.requirements.map((requirement) => <div key={requirement.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><div className="flex items-center gap-2 text-xs font-bold text-slate-400"><span>{requirement.id}</span><span>{requirement.type}</span>{requirement.mandatory && <span className="text-rose">MANDATORY</span>}</div><div className="mt-1 text-sm font-semibold">{requirement.title}</div><div className="mt-1 text-xs text-slate-500">{requirement.detail}</div></div><StatusBadge label="FROZEN" /></div>)}</div></Panel></div>;
}

function SupplierPortal({ data, onNavigate }: { data: DemoData; onNavigate: (route: RouteKey) => void }) {
  return <div className="space-y-6"><Header eyebrow="Evaluate · supplier view" title="Supplier Portal" detail="Review participation and authenticated bid evidence before evaluation." mode={data.mode} /><div className="grid gap-4 md:grid-cols-3">{data.suppliers.map((supplier, index) => <Panel key={supplier.id}><div className="p-5"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ef] text-moss"><ShieldCheck size={18} /></div><StatusBadge label={index === 0 ? "COMPLIANT" : index === 1 ? "NON_COMPLIANT" : "REVIEW"} /></div><div className="mt-5 text-sm font-semibold">{supplier.name}</div><div className="mt-2 text-xs text-slate-500">Authenticated evidence attached · bid readback available</div></div></Panel>)}</div><button className="primary-button" onClick={() => onNavigate("evaluation-room")}>Open evaluation room <ArrowRight size={15} /></button></div>;
}

function AwardDesk({ data, onNavigate }: { data: DemoData; onNavigate: (route: RouteKey) => void }) {
  return <div className="space-y-6"><Header eyebrow="Evaluate · deterministic selection" title="Award Desk" detail="Procura does not let the semantic layer choose the winner. Buyer selection is limited to eligible bids." mode={data.mode} /><Panel><PanelHeader eyebrow="Eligible bid" title="Supplier A · Solbridge Systems" detail="COMPLIANT under all mandatory frozen requirements" action={<StatusBadge label="ELIGIBLE" />} /><div className="grid gap-4 p-5 sm:grid-cols-3"><div><div className="label">Bid price</div><div className="mt-2 text-xl font-semibold">420,000 {data.tender.currency}</div></div><div><div className="label">Delivery</div><div className="mt-2 text-sm font-semibold">21 days</div></div><div><div className="label">Award state</div><div className="mt-2 text-sm font-semibold text-amber">Acceptance pending</div></div></div></Panel><button className="primary-button" onClick={() => onNavigate("delivery-workspace")}>Review award delivery <ArrowRight size={15} /></button></div>;
}

function DeliveryWorkspace({ data, onNavigate }: { data: DemoData; onNavigate: (route: RouteKey) => void }) {
  return <div className="space-y-6"><Header eyebrow="Fulfil · awarded delivery" title="Delivery Workspace" detail="Track the delivery reference, evidence identity, and inspection handoff." mode={data.mode} /><Panel><PanelHeader eyebrow="DEL-2026-001" title="Product substitution submitted" detail="100 industrial solar batteries · supplier evidence attached" action={<StatusBadge label="UNDER_INSPECTION" />} /><div className="grid gap-4 p-5 sm:grid-cols-3"><div><div className="label">Awarded</div><div className="mt-2 text-sm font-semibold">Product A · 10.24 kWh</div></div><div><div className="label">Delivered</div><div className="mt-2 text-sm font-semibold text-rose">Product B · 8.2 kWh</div></div><div><div className="label">Evidence</div><div className="mt-2 text-sm font-semibold">SHA-256 verified</div></div></div></Panel><button className="primary-button" onClick={() => onNavigate("inspection-room")}>Open inspection room <ArrowRight size={15} /></button></div>;
}

function Disputes({ data }: { data: DemoData }) {
  return <div className="space-y-6"><Header eyebrow="Fulfil · governed resolution" title="Disputes" detail="Dispute decisions are explicit deterministic paths; funds remain locked while inconclusive." mode={data.mode} /><Panel><PanelHeader eyebrow="Open case" title="Delivery mismatch · AW-2026-001" detail="The buyer may refund according to the frozen policy; supplier payout is blocked." action={<StatusBadge label="DISPUTED" />} /><div className="p-5"><div className="rounded-xl border border-[#ecc4bf] bg-[#fff8f7] p-4 text-sm leading-6 text-slate-700">{data.inspection.verdict} is the canonical inspection result. No raw semantic prose is used as a settlement instruction.</div></div></Panel></div>;
}

function ProofAudit({ data }: { data: DemoData }) {
  return <div className="space-y-6"><Header eyebrow="Observe · provenance" title="Proof & Audit" detail="Inspect evidence identity, frozen versions, adjudication provenance, and transaction state." mode={data.mode} /><Panel><PanelHeader eyebrow="Readback register" title="Evidence and audit anchors" detail="Controlled demo records are visibly separate from LIVE state." /><div className="divide-y divide-line">{["Tender hash · PROCUREMENT_V1 · frozen", "Requirement root · 7 versions · immutable", "Bid evidence · 64-char lowercase SHA-256", "Inspection root · INSP-2026-10-01", "Transaction · no live broadcast performed"].map((item) => <div key={item} className="flex items-center gap-3 px-5 py-4 text-sm"><FileCheck2 size={16} className="text-moss" />{item}</div>)}</div></Panel></div>;
}

export function OperationsSurface({ route, data, onNavigate }: { route: RouteKey; data: DemoData; onNavigate: (route: RouteKey) => void }) {
  const [state] = useState(() => new URLSearchParams(window.location.search).get("state") ?? "populated");
  const content = route === "tenders" ? <Tenders data={data} onNavigate={onNavigate} /> : route === "tender-room" ? <TenderRoom data={data} /> : route === "supplier-portal" ? <SupplierPortal data={data} onNavigate={onNavigate} /> : route === "award-desk" ? <AwardDesk data={data} onNavigate={onNavigate} /> : route === "delivery-workspace" ? <DeliveryWorkspace data={data} onNavigate={onNavigate} /> : route === "disputes" ? <Disputes data={data} /> : route === "proof-audit" ? <ProofAudit data={data} /> : <GenericSurface route={route} data={data} />;
  return <StateFrame state={state}>{content}</StateFrame>;
}

function GenericSurface({ route, data }: { route: RouteKey; data: DemoData }) {
  const title = route.replaceAll("-", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return <div className="space-y-6"><Header eyebrow="Procura workspace" title={title} detail="This surface is connected to the frozen contract boundary and controlled readback mode." mode={data.mode} /><Panel><PanelHeader eyebrow="Operational status" title="Ready for operator review" detail="No live state is being mixed with controlled demo data." /><div className="grid gap-4 p-5 sm:grid-cols-3"><div className="rounded-xl border border-line bg-[#fbfcfa] p-4"><FileText size={18} className="text-moss" /><div className="mt-4 text-sm font-semibold">Frozen schema</div><div className="mt-1 text-xs text-slate-500">PROCUREMENT_V1</div></div><div className="rounded-xl border border-line bg-[#fbfcfa] p-4"><PackageCheck size={18} className="text-moss" /><div className="mt-4 text-sm font-semibold">Controlled records</div><div className="mt-1 text-xs text-slate-500">{data.requirements.length} requirements · {data.suppliers.length} suppliers</div></div><div className="rounded-xl border border-line bg-[#fbfcfa] p-4"><CheckCircle2 size={18} className="text-moss" /><div className="mt-4 text-sm font-semibold">Readback mode</div><div className="mt-1 text-xs text-slate-500">{data.mode}</div></div></div></Panel></div>;
}
