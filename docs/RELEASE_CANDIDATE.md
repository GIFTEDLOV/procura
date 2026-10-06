# Procura Release Candidate

This local commit is the frozen API-migration candidate for operator review.

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
authorized Studio-dev deployment #3 succeeded and finalized. Live native GEN
qualification did not complete: the first refund-case setup write failed
because its all-numeric hash argument was CLI-serialized as an integer. No
funding, refund, payout, or settlement write followed.

## Provenance

The contract hash, interface manifest, test commands, toolchain, deployment,
and blocker are recorded in `docs/DEPLOYMENT_PROVENANCE.md` and
`docs/STUDIO_DEV_QUALIFICATION.md`.

Release gate: NOT READY FOR PUBLICATION.
