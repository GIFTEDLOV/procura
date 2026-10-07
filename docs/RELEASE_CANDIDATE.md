# Procura Release Candidate

This local commit is the frozen storage-remediation candidate for operator
review.

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

Release gate: NOT READY FOR PUBLICATION because supplier payout and final
accounting closure are not proven under the frozen deployment.

## Provenance

The corrected contract hash, interface manifest, toolchain, deployment history,
refund proof, fee policy, and blocker are recorded in
`docs/DEPLOYMENT_PROVENANCE.md`, `docs/STUDIO_DEV_QUALIFICATION.md`, and
`docs/FEE_POLICY.md`.
