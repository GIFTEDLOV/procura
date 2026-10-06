# Procura Release Candidate

This local commit is the frozen storage-remediation candidate for operator review.

## Included

- hardened Procurement contract accounting and frozen bond/milestone policy;
- Procurement schema and frontend interface manifest;
- typed frontend action builder and transaction recovery helpers;
- operational core route surfaces and explicit readback states;
- contract-policy, adversarial, property, mutation, frontend, integration, and browser coverage;
- Studio-dev schema/deploy proof and deployment provenance;
- flagship screenshots in `evidence/screenshots/`.

## Release limits

No GitHub push, Vercel deployment, or Portal submission was performed. The
Studio-dev deployment #4 succeeded and finalized at
`0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA`. Live native GEN qualification
did not complete: create, requirement, freeze, and funding finalized, but the
single cancel/refund write failed with
`Mode1MessageFeesRequireGenVMPerEmissionSupport` because the fee-bearing
message lacked an allocation tree. No retry or payout write followed.

## Provenance

The corrected contract hash, interface manifest, test commands, toolchain,
deployments, funding proof, and blocker are recorded in
`docs/DEPLOYMENT_PROVENANCE.md` and
`docs/STUDIO_DEV_QUALIFICATION.md`.

Release gate: NOT READY FOR PUBLICATION.

## Qualification-client recovery status

The failed CLI write is not being worked around in the contract. The new
qualification helper uses `genlayer-py 0.19.0rc2` typed SDK writes and the
numeric-hash regression test passes. The required raw `gen_call` type=`write`
preflight reaches the corrected contract and returns `00`. The subsequent
value-exit write exposed the separate Studio-dev message-allocation-tree
requirement; the qualification pass is stopped and remains NOT READY FOR
PUBLICATION.
