# Procura semantic evaluation liveness audit

## Historical audit result (resolved in Deployment #6)

At audit time, publication was blocked. The then-canonical Deployment #5 contract at
`0xE9f1319e98F25E301ee167aF41f82E25cC4f8770` remains unchanged at source SHA
`95f7cc706decbb3e38eb0a1f6f0014ffc2279ac6c3d07d883199b44cacc36fed`.

The audit classified the stranded-case report as
`CLASS_B_QUALIFICATION_SCRIPT_BUG`. The canonical contract has a retry path
when no adjudication record exists, but the qualification flow used a
one-shot semantic write and incorrectly treated the failed tuple as
non-retryable. The separate successful-result replay gap was closed by the
local candidate and proven live in Deployment #6 below.

The reconstructed case was
`PROCURA-FINAL-PAYOUT-20261008T101500Z`. It is funded with
`1000000000000000` wei and remains `EVALUATING` with the full amount in
escrow. Its requirement adjudication transaction
`0x0014ef10018a59d15be3a0764b203600b278d3d9cb8b3f8a66f20cb28da7632c`
finalized without a committed contract result: lifecycle outcome
`UNDETERMINED`, consensus `MAJORITY_DISAGREE`, three `DISAGREE` votes and two
`IDLE` votes. Canonical readback showed no adjudication record, replay guard,
fingerprint, result, award, or state mutation.

## Why the canonical contract appeared stuck

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
in `EVALUATING` with no direct terminal value exit. However, because no
adjudication record is committed before semantic success, the same frozen
requirement can be retried on the canonical deployment. The qualification
client did not perform that safe retry.

The separate canonical integrity defect is that a successful adjudication can
also be called again before finalization/acceptance, overwriting the existing
record and enabling result shopping.

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

The same guard is applied to `adjudicate_delivery`. A failed delivery
adjudication remains retryable while `UNDER_INSPECTION`, but a successful
delivery result cannot be overwritten before acceptance or rejection.

Candidate source SHA-256:
`daad9b0c43be603e522afbf55623e7b8027d7de3b01708922360ae5a45972cde`.

## Regression matrix

| Scenario | Expected result |
| --- | --- |
| Successful adjudication, then second call | Rejected by existing adjudication identity |
| Undetermined semantic call, then retry | Retry remains legal because no record was committed |
| Failed transport/runtime call | No semantic verdict or adjudication record |
| Changed requirement identity | Separate frozen requirement identity; no overwrite |
| Canonical pre-fix failed bid attempt | Retry was already legal; qualification one-shot flow blocked it |
| Failed delivery adjudication | Retry remains legal while inspection is active |
| Successful delivery adjudication, then second call | Rejected by existing inspection adjudication identity |
| Finalization before all records exist | Rejected |
| Buyer cancellation from `EVALUATING` | Rejected; no discretionary refund path |
| Payout/refund exclusivity | Unchanged |

The local fix is not a publication approval. A fresh deployment and complete
qualification are required before publication can be reconsidered.

## Resolution in Deployment #6

The local replay-protection fix was deployed once as Deployment #6 at
`0x88634c7868B0659b46C5bd93E4038222697a0170`, transaction
`0x5ceef949b50a184d9f5675a174ee6b329acdf61bbb05b853392b5e55b29ba34d`,
source SHA-256
`daad9b0c43be603e522afbf55623e7b8027d7de3b01708922360ae5a45972cde`.
The bid and delivery identity guards were proven live: successful results
were stored, and exact duplicate adjudication preflights were rejected before
nondeterministic execution. The historical failed Deployment #5 tuple was not
retried and remains preserved as superseded history.

The liveness fix did not add public methods, storage fields, ABI surface,
payment-policy changes, or result-shopping paths. Final #6 refund and payout
qualification closed all #6 escrow, leaving zero unexplained native balance.
