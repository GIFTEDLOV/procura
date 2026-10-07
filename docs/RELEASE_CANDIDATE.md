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

Payout qualification has not been attempted because the supplier signer for
`0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8` is not available in the current
workspace. No contract source or ABI change is involved, and no new refund case
was created.

Release gate: NOT READY FOR PUBLICATION.

## Provenance

The corrected contract hash, interface manifest, toolchain, deployment history,
refund proof, fee policy, and blocker are recorded in
`docs/DEPLOYMENT_PROVENANCE.md`, `docs/STUDIO_DEV_QUALIFICATION.md`, and
`docs/FEE_POLICY.md`.
