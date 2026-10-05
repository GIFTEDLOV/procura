import { hashSchema } from "./serialization";
import { manifestMethod } from "./interfaceManifest";

export const methodSpecs = {
  create_tender: { args: 14, payable: false },
  add_requirement: { args: 13, payable: false },
  add_certification_requirement: { args: 5, payable: false },
  freeze_tender: { args: 1, payable: false },
  fund_tender: { args: 1, payable: true },
  cancel_tender: { args: 1, payable: false },
  submit_bid: { args: 8, payable: false },
  add_bid_evidence: { args: 9, payable: false },
  begin_bid_evaluation: { args: 1, payable: false },
  adjudicate_requirement: { args: 3, payable: false },
  finalize_bid_evaluation: { args: 1, payable: false },
  award_bid: { args: 7, payable: false },
  accept_award: { args: 1, payable: false },
  post_supplier_bond: { args: 2, payable: true },
  create_delivery: { args: 7, payable: false },
  add_delivery_evidence: { args: 9, payable: false },
  begin_inspection: { args: 1, payable: false },
  adjudicate_delivery: { args: 2, payable: false },
  accept_delivery: { args: 1, payable: false },
  reject_delivery: { args: 1, payable: false },
  release_milestone: { args: 2, payable: false },
  settle_award: { args: 1, payable: false },
  refund_buyer: { args: 1, payable: false },
  open_dispute: { args: 2, payable: false },
  resolve_dispute: { args: 2, payable: false },
  get_tender: { args: 1, payable: false },
  get_requirements: { args: 1, payable: false },
  get_bids: { args: 1, payable: false },
  get_evidence: { args: 2, payable: false },
  get_adjudication: { args: 2, payable: false },
  get_award: { args: 1, payable: false },
  get_delivery: { args: 1, payable: false },
  get_delivery_adjudication: { args: 1, payable: false },
  get_payments: { args: 1, payable: false },
  get_refunds: { args: 1, payable: false },
  get_audit_events: { args: 0, payable: false },
  get_accounting: { args: 0, payable: false },
  get_protocol_info: { args: 0, payable: false },
  get_tender_ids: { args: 0, payable: false },
} as const;

export type ContractMethod = string;
export type WriteAction = { method: ContractMethod; args: readonly unknown[]; value?: bigint; requestId: string };

export function normalizeHash(value: string): string {
  return hashSchema.parse(value);
}

export function normalizeU256(value: number | string | bigint): bigint {
  const normalized = typeof value === "bigint" ? value : BigInt(value);
  if (normalized < 0n) throw new Error("u256 cannot be negative");
  return normalized;
}

export function buildAction<M extends ContractMethod>(
  method: M,
  args: readonly unknown[],
  options: { requestId: string; value?: number | string | bigint } = { requestId: crypto.randomUUID() },
): WriteAction {
  const spec = methodSpecs[method as keyof typeof methodSpecs];
  const manifest = manifestMethod(method);
  if (!spec || manifest.kind !== "write") throw new Error(`${method} is not a writable Procurement_V1 method`);
  if (args.length !== spec.args) throw new Error(`${method} expects ${spec.args} arguments`);
  if (spec.payable === false && options.value !== undefined) throw new Error(`${method} is not payable`);
  if (spec.payable && options.value === undefined) throw new Error(`${method} requires a value`);
  return { method, args: [...args], value: options.value === undefined ? undefined : normalizeU256(options.value), requestId: options.requestId };
}

export function settlementState(accounting: { buyerFunded: number; supplierPaid: number; buyerRefunded: number }) {
  const remainingLiability = accounting.buyerFunded - accounting.supplierPaid - accounting.buyerRefunded;
  return { ...accounting, remainingLiability, conserved: remainingLiability >= 0 };
}

export function semanticCellTone(verdict: string): "PASS" | "FAIL" | "REVIEW" {
  if (verdict === "COMPLIANT" || verdict === "DELIVERY_ACCEPTED") return "PASS";
  if (verdict === "MATERIALLY_NON_COMPLIANT" || verdict === "MATERIAL_DELIVERY_MISMATCH") return "FAIL";
  return "REVIEW";
}
