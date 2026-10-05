import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white shadow-panel ${className}`}>{children}</section>;
}

export function PanelHeader({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{eyebrow}</div><h2 className="mt-1 text-base font-semibold text-ink">{title}</h2>{detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}</div>{action}</div>;
}
