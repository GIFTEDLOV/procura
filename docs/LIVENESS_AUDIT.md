# Procura semantic evaluation liveness audit

## Result

Publication is blocked. The canonical Deployment #5 contract at
`0xE9f1319e98F25E301ee167aF41f82E25cC4f8770` remains unchanged at source SHA
`95f7cc706decbb3e38eb0a1f6f0014ffc2279ac6c3d07d883199b44cacc36fed`.

The audit classifies the defect as `CLASS_C_CONTRACT_LIVENESS_DEFECT`.

The reconstructed case was
`PROCURA-FINAL-PAYOUT-20261008T101500Z`. It is funded with
`1000000000000000` wei and remains `EVALUATING` with the full amount in
escrow. Its requirement adjudication transaction
`0x0014ef10018a59d15be3a0764b203600b278d3d9cb8b3f8a66f20cb28da7632c`
finalized without a committed contract result: lifecycle outcome
`UNDETERMINED`, consensus `MAJORITY_DISAGREE`, three `DISAGREE` votes and two
`IDLE` votes. Canonical readback showed no adjudication record, replay guard,
fingerprint, result, award, or state mutation.

## Why the canonical contract is stuck

- `begin_bid_evaluation` moves a funded tender to `EVALUATING` before semantic
  adjudication succeeds.
- `adjudicate_requirement` writes its adjudication only after the semantic
  call returns and the verdict is derived.
- `finalize_bid_evaluation` requires every adjudication record.
- `cancel_tender` permits only `FROZEN` and `FUNDED` states.
- There is no `expire_tender` or deterministic evaluation-failure recovery.
- No award exists, so award-level refund, dispute, and settlement paths are
  unreachable.

Therefore a failed or undetermined semantic execution can leave funded escrow
in `EVALUATING` with no legal exit. The same frozen requirement cannot be
adjudicated again on the canonical deployment because the deployed function
has no retry-safe adjudication guard or retry path.

## Smallest local fix

The local candidate moves the existing adjudication identity calculation before
the semantic call and rejects it only when the existing successful record is
already present. The record write remains after semantic success.

This gives the required behavior:

- failed, undetermined, or transport-failed execution commits no verdict and
  leaves the identity retryable;
- a successful `(bid_id, requirement_id)` record is immutable and blocks a
  second adjudication;
- the existing requirement version and evidence snapshot are stored in the
  successful record;
- no public method, storage field, ABI, payout path, refund path, or state
  transition was added;
- the canonical deployment was not modified or redeployed.

Candidate source SHA-256:
`30aa4e7b6cb8f3e7f1584d017f45398b13602acbb2623f3444d7eb9648888069`.

## Regression matrix

| Scenario | Expected result |
| --- | --- |
| Successful adjudication, then second call | Rejected by existing adjudication identity |
| Undetermined semantic call, then retry | Retry remains legal because no record was committed |
| Failed transport/runtime call | No semantic verdict or adjudication record |
| Changed requirement identity | Separate frozen requirement identity; no overwrite |
| Finalization before all records exist | Rejected |
| Buyer cancellation from `EVALUATING` | Rejected; no discretionary refund path |
| Payout/refund exclusivity | Unchanged |

The local fix is not a publication approval. A fresh deployment and complete
qualification are required before publication can be reconsidered.
