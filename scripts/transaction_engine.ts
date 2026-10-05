export type TransactionPhase =
  | "READ_PRECONDITION"
  | "BUILD_CANONICAL_ARGS"
  | "BROADCAST_ONCE"
  | "PERSIST_HASH"
  | "RECONCILE_SAME_HASH"
  | "FINALITY"
  | "EXECUTION_STATUS"
  | "CANONICAL_READBACK"
  | "UI_UPDATE";

export type TransactionRecord = {
  clientRequestId: string;
  method: string;
  canonicalArgs: unknown[];
  txHash?: string;
  phase: TransactionPhase;
  finality?: "PENDING" | "FINALIZED" | "UNDETERMINED";
  execution?: "SUCCESS" | "ERROR" | "UNKNOWN";
  readback?: unknown;
};

export const TRANSACTION_PHASES: readonly TransactionPhase[] = [
  "READ_PRECONDITION",
  "BUILD_CANONICAL_ARGS",
  "BROADCAST_ONCE",
  "PERSIST_HASH",
  "RECONCILE_SAME_HASH",
  "FINALITY",
  "EXECUTION_STATUS",
  "CANONICAL_READBACK",
  "UI_UPDATE",
];

export function reconcileReturnedHash(
  existing: TransactionRecord | undefined,
  returnedHash: string,
): TransactionRecord {
  if (existing?.txHash && existing.txHash !== returnedHash) {
    throw new Error("transaction hash changed during recovery");
  }
  return { ...(existing ?? ({} as TransactionRecord)), txHash: returnedHash, phase: "PERSIST_HASH" };
}

export function canDisplaySettled(record: TransactionRecord): boolean {
  return record.finality === "FINALIZED" && record.execution === "SUCCESS";
}
