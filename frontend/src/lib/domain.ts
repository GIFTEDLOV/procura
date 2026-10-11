import { hashSchema, parseU256 } from "./serialization";
import { frontendInterfaceManifest, manifestMethod } from "./interfaceManifest";

/**
 * Compatibility view for existing callers. The checked-in Procurement_V1
 * schema is the only source of method names, argument counts, and payable
 * flags; this is deliberately derived instead of maintained as a second ABI.
 */
export const methodSpecs = Object.fromEntries(
  frontendInterfaceManifest.methods.map((method) => [method.name, { args: method.arguments.length, payable: method.payable }]),
) as Record<string, { args: number; payable: boolean }>;

export type ContractMethod = string;
export type WriteAction = { method: ContractMethod; args: readonly unknown[]; value?: bigint; requestId: string };

export function normalizeHash(value: string): string {
  return hashSchema.parse(value);
}

export function normalizeU256(value: number | string | bigint): bigint {
  return parseU256(value, "u256");
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
