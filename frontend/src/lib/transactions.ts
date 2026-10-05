export type TransactionPhase = "READ_PRECONDITION" | "BUILD_CANONICAL_ARGS" | "BROADCAST_ONCE" | "PERSIST_HASH" | "RECONCILE_SAME_HASH" | "FINALITY" | "EXECUTION_STATUS" | "CANONICAL_READBACK" | "UI_UPDATE";
export type TransactionRecord = { requestId: string; method: string; args: unknown[]; txHash?: string; phase: TransactionPhase; finality?: "PENDING" | "FINALIZED" | "UNDETERMINED"; execution?: "SUCCESS" | "ERROR" | "UNKNOWN" };

export const phases: TransactionPhase[] = ["READ_PRECONDITION", "BUILD_CANONICAL_ARGS", "BROADCAST_ONCE", "PERSIST_HASH", "RECONCILE_SAME_HASH", "FINALITY", "EXECUTION_STATUS", "CANONICAL_READBACK", "UI_UPDATE"];

export function reconcileHash(record: TransactionRecord, returnedHash: string): TransactionRecord {
  if (record.txHash && record.txHash !== returnedHash) throw new Error("Returned hash differs from persisted hash");
  return { ...record, txHash: returnedHash, phase: "RECONCILE_SAME_HASH" };
}

export function isSuccessfulSettlement(record: TransactionRecord): boolean {
  return record.finality === "FINALIZED" && record.execution === "SUCCESS";
}
