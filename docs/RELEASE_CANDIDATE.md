# Procura Release Candidate

This local commit is the Gate 2 recovery release candidate for operator review.

## Included

- hardened Procurement contract accounting and frozen bond/milestone policy;
- Procurement schema and frontend interface manifest;
- typed frontend action builder and transaction recovery helpers;
- operational core route surfaces and explicit readback states;
- contract-policy, adversarial, property, mutation, frontend, integration, and browser coverage;
- Local Studio qualification driver and runtime blocker record;
- flagship screenshots in `evidence/screenshots/`.

## Release limits

No GitHub push, Studio-dev deployment, Vercel project, or live irreversible
write was performed. Native GEN value exits remain a required next-gate
qualification because the local JSON-RPC web GenVM module is not healthy.

## Provenance

The contract hash, interface manifest, test commands, toolchain, and commit are
recorded in `evidence/release-provenance.json`.
