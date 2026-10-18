# Procura V2.1.2 — independently reconciled Studionet state

Verified 2026-10-16 with an isolated cloud GenLayer SDK 1.1.8 client, RPC `https://studio.genlayer.com/api` (chain 61999).

- Contract: `0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929`
- Actual deployed source SHA-256: `a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac`.
- Deployed ABI contains each steward method: `create_tender`, `submit_bid`, `create_delivery`, `add_bid_evidence`, `add_delivery_evidence`.
- Current canonical tender IDs: `PROCURA-CLOUD-REVIEWER-20261016`, `PROCURA-CLOUD-REVIEWER-20261016-B`, `PROCURA-CLOUD-REVIEWER-20261016-C`.
- The original cloud reviewer tender is `FUNDED`, tender B is `DRAFT`, tender C is `EVALUATING`. These are **not** completed adjudication/award/delivery proofs.
- Canonical audit events confirm tender creation, requirement definition, freeze, funding, bid submission and bid evidence for the original qualification attempt. Do not count an audit event as proof of successful subsequent delivery.
- Contract-wide account readback: `total_funded=200000000000000`, `escrow_liability=200000000000000` wei-equivalent GEN units (0.0002 GEN), no payouts/refunds.
- New cloud qualification writes occurred since the earlier report. These were **not** submitted by this assistant session. Reconcile signer/nonces and transaction finality before any additional writes; do not duplicate pending/finalized operations.
- The default GitHub `main` at `2bd4399e73e97bee46151629d083213920342d1c` predates the unpublished local V2.1.2 source. Do not merge or deploy its old contract/frontend as though qualified.

**Steward closure remains unverified** until authentic successful adjudication, award, acceptance, `create_delivery` and `add_delivery_evidence` have verified FINALIZED successful transactions and canonical readbacks. All five methods must be wired through the same versioned shared schema. No new deployment is justified from these observations.

This document is read-only third-party reconciliation and does not authorize or imply any transaction, UI cutover, or Portal resubmission.
