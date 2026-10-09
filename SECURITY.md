# Security policy

Procura is a public release candidate on Studio-dev. The contract source and live deployment are frozen; please do not attempt to use the public application to test value-moving paths without authorization.

## Reporting

Report suspected vulnerabilities privately to the repository owner through GitHub security contact or a private maintainer channel. Include reproduction steps, affected surface, network, transaction hashes (if any), and whether the issue affects LIVE, CONTROLLED DEMO, or HISTORICAL PROOF mode. Do not publish exploit details or private keys.

## Scope

In scope: contract-boundary misuse, wallet/role spoofing, transaction replay or rebroadcast, live/demo state confusion, evidence-authentication bypass, unsafe external URL handling, and release/provenance integrity.

Out of scope: controlled-demo fixture behavior clearly labelled as demo, known tooling-only E014 findings, and speculative issues without a reproducible impact.
