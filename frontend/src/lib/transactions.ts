export type TransactionPhase = "READ_PRECONDITION" | "BUILD_CANONICAL_ARGS" | "BROADCAST_ONCE" | "PERSIST_HASH" | "RECONCILE_SAME_HASH" | "FINALITY" | "READY_TO_FINALIZE" | "EXECUTION_STATUS" | "CANONICAL_READBACK" | "UI_UPDATE";
export type TransactionFinality = "UNINITIALIZED" | "PENDING" | "PROPOSING" | "COMMITTING" | "REVEALING" | "ACCEPTED" | "UNDETERMINED" | "READY_TO_FINALIZE" | "APPEAL_REVEALING" | "APPEAL_COMMITTING" | "FINALIZED" | "CANCELED" | "VALIDATORS_TIMEOUT" | "LEADER_TIMEOUT";
export type TransactionRecord = { requestId: string; method: string; args: unknown[]; txHash?: string; phase: TransactionPhase; finality?: TransactionFinality; execution?: "SUCCESS" | "ERROR" | "UNKNOWN" };

export const phases: TransactionPhase[] = ["READ_PRECONDITION", "BUILD_CANONICAL_ARGS", "BROADCAST_ONCE", "PERSIST_HASH", "RECONCILE_SAME_HASH", "FINALITY", "READY_TO_FINALIZE", "EXECUTION_STATUS", "CANONICAL_READBACK", "UI_UPDATE"];

export function reconcileHash(record: TransactionRecord, returnedHash: string): TransactionRecord {
  if (record.txHash && record.txHash !== returnedHash) throw new Error("Returned hash differs from persisted hash");
  return { ...record, txHash: returnedHash, phase: "RECONCILE_SAME_HASH" };
}

export function isSuccessfulSettlement(record: TransactionRecord): boolean {
  return record.finality === "FINALIZED" && record.execution === "SUCCESS";
}

export function persistHash(record: TransactionRecord, txHash: string): TransactionRecord {
  if (record.txHash) return reconcileHash(record, txHash);
  return { ...record, txHash, phase: "PERSIST_HASH" };
}

export function markExecution(record: TransactionRecord, execution: "SUCCESS" | "ERROR" | "UNKNOWN"): TransactionRecord {
  if (record.finality !== "FINALIZED") throw new Error("execution status requires finality");
  return { ...record, execution, phase: "EXECUTION_STATUS" };
}

export function recoverAfterRefresh(record: TransactionRecord): TransactionRecord {
  if (!record.txHash) throw new Error("cannot recover a transaction without a hash");
  return { ...record, phase: "RECONCILE_SAME_HASH" };
}
