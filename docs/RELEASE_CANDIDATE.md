# Procura Release Candidate

This local commit is the frozen storage-remediation candidate for operator
review.

## Publication blocker: semantic evaluation liveness

The final liveness audit found a real contract defect in the canonical
Deployment #5: a funded tender can enter `EVALUATING`, receive an undetermined
semantic transaction with no committed adjudication, and have no legal retry,
cancel, expiry, refund, or settlement path. Classification:
`CLASS_C_CONTRACT_LIVENESS_DEFECT`.

Publication is therefore `NOT READY`. The canonical contract and its deployed
source SHA remain untouched. A local candidate adds only the existing
`(bid_id, requirement_id)` success-record guard before the semantic call, so a
failed/undetermined call does not consume the identity while a successful
record remains immutable. The same guard also closes delivery-result
overwrites before acceptance/rejection. Candidate source SHA is recorded in
the provenance manifest.
No redeployment, GitHub push, Vercel deployment, or Portal submission was
performed.

## Included

- hardened Procurement contract accounting and frozen bond/milestone policy;
- Procurement schema and frontend interface manifest;
- typed frontend action builder and transaction recovery helpers;
- operational core route surfaces and explicit readback states;
- contract-policy, adversarial, property, mutation, frontend, integration, and
  browser coverage;
- Studio-dev schema/deploy proof, storage remediation, and deployment
  provenance;
- typed v0.6 external-message fee allocation tooling and regression tests.

## Qualification status

No GitHub push, Vercel deployment, or Portal submission was performed. Studio-dev
deployment #4 succeeded and finalized at
`0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA`.

The initial cancel/refund write failed with
`Mode1MessageFeesRequireGenVMPerEmissionSupport` because its fee-bearing
external message had no allocation tree. The one authorized same-case retry
used the exact SDK-derived buyer allocation and finalized successfully. Gross
refund, escrow, liability, and accounting proofs passed; buyer net balance was
reconciled after settled protocol fees.

The supplier signer is available as the already-unlocked local account
`player2`, and was used for the controlled payout bid/evidence writes. The
controlled payout case reached `EVALUATING`, but the first adjudication
preflight failed with the frozen deployed contract error
`gl.vm.run_nondet_unsafe` missing from `gl.vm`. No adjudication transaction was
broadcast after that error, and no contract source or ABI change is involved.

The frontend now has a typed `genlayer-js` live-write boundary with explicit
Studio-dev network/role checks, message allocations, one-shot broadcast, hash
persistence/recovery, finality/execution checks, and canonical-readback hooks.
The existing screens remain visibly CONTROLLED DEMO until a wallet is attached;
they do not invent LIVE state.

At the earlier #4 checkpoint, release was NOT READY FOR PUBLICATION because
supplier payout and final accounting closure were not proven under the frozen
deployment.

The corrected local contract fix now requests native JSON responses for both
bounded semantic calls and uses `gl.vm.run_nondet_default`. The one temporary
5jyc probe reached finalized consensus on requirement and delivery semantic
transactions with strict payload readback. Deployment #5 and fresh production
refund/payout qualification remain separate final gates.

## Provenance

The corrected contract hash, interface manifest, toolchain, deployment history,
refund proof, fee policy, and blocker are recorded in
`docs/DEPLOYMENT_PROVENANCE.md`, `docs/STUDIO_DEV_QUALIFICATION.md`, and
`docs/FEE_POLICY.md`.

## Corrected final local qualification

The minimal contract fix is committed locally as
`db4e4b3d6a4a07a9e7f118afc5efe02d030216a9`
(`fix(contract): use 5jyc JSON semantic responses and default nondet API`).
It changes only native JSON response mode at the two semantic paths and
`run_nondet_default` at the two nondeterminism sites. Strict payload
validation, prompts, business rules, payment policy, state machine, storage,
and ABI are unchanged.

Deployment #5 finalized at
`0xE9f1319e98F25E301ee167aF41f82E25cC4f8770`, with 39/39 schema parity and
source SHA-256
`95f7cc706decbb3e38eb0a1f6f0014ffc2279ac6c3d07d883199b44cacc36fed`.
The JSON semantic probe, one-wei semantic smokes, final refund, and fresh
awardable payout all passed their required runtime/value proofs. The failed
diagnostic payout tuple remains accounted escrow and was not retried.

The one-wei delivery smoke was subsequently closed through its already
accepted delivery and settled once; its acceptance and settlement hashes are
recorded in the provenance manifest. The only remaining contract liability is
the explicitly attributed one-wei requirement smoke plus the failed payout
tuple's funded escrow.

Final local gates: Python contract/qualification suite `154 passed, 1
skipped`, frontend unit `54 passed`, Playwright `16 passed`, typecheck PASS,
build PASS, schema/interface parity PASS, transaction recovery PASS, and
secret scan PASS. The one direct-runner skip is the documented Windows/Python
3.14 GenVM v0.6 message-context `DecodingError`; the stale E014 storage-linter
findings remain documented tooling false positives.

Local qualification is complete. Public publication remains intentionally
withheld. The liveness audit supersedes that qualification state for release
purposes until the local retry-safe candidate is separately deployed and
requalified. No GitHub push, Vercel deployment, or Portal submission was
performed.
