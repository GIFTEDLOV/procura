import type { CellStatus } from "../types/procura";

type Status = CellStatus | "LIVE" | "CONTROLLED DEMO" | "HISTORICAL" | "BLOCKED" | "ACTIVE" | "FROZEN" | "COMPLIANT" | "NON_COMPLIANT" | "ELIGIBLE" | "UNDER_INSPECTION" | "DISPUTED";

const styles: Record<Status, string> = {
  PASS: "bg-[#e5f1eb] text-[#2f6b57] border-[#c6dfd1]",
  FAIL: "bg-[#fae9e7] text-[#a9453e] border-[#ecc4bf]",
  REVIEW: "bg-[#fff3df] text-[#9b641e] border-[#f0d4a3]",
  EQUIVALENT: "bg-[#e7eff4] text-[#346c8a] border-[#c7dae7]",
  MISSING: "bg-[#f0f1ef] text-[#68736e] border-[#dfe3df]",
  LIVE: "bg-[#e5f1eb] text-[#2f6b57] border-[#c6dfd1]",
  "CONTROLLED DEMO": "bg-[#fff3df] text-[#9b641e] border-[#f0d4a3]",
  HISTORICAL: "bg-[#e7eff4] text-[#346c8a] border-[#c7dae7]",
  BLOCKED: "bg-[#fae9e7] text-[#a9453e] border-[#ecc4bf]",
  ACTIVE: "bg-[#e7eff4] text-[#346c8a] border-[#c7dae7]",
  FROZEN: "bg-[#e7eff4] text-[#346c8a] border-[#c7dae7]",
  COMPLIANT: "bg-[#e5f1eb] text-[#2f6b57] border-[#c6dfd1]",
  NON_COMPLIANT: "bg-[#fae9e7] text-[#a9453e] border-[#ecc4bf]",
  ELIGIBLE: "bg-[#e5f1eb] text-[#2f6b57] border-[#c6dfd1]",
  UNDER_INSPECTION: "bg-[#fff3df] text-[#9b641e] border-[#f0d4a3]",
  DISPUTED: "bg-[#fff3df] text-[#9b641e] border-[#f0d4a3]"
};

export function StatusBadge({ label }: { label: Status }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[.08em] ${styles[label]}`}>{label}</span>;
}
