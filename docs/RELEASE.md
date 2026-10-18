# Procura v1.0.2 - Studionet steward remediation

## Release target

- Network: GenLayer Studionet, chain `61999`
- Contract: `0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929`
- Contract source SHA-256: `a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac`
- Existing deployment transaction: `0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33`
- Schema SHA-256: `21a63012d333ccb2e29c4cd799034c42b2183f7831f64e61157e75d85bbd1127`
- ABI SHA-256: `97015697a9252c5c2b86f4e72d76a926775eca14ec7add6c743ece0609edd800`
- Typed interface SHA-256: `b32e4393d90962f366a34bfcf6a7e373f324776ba7c95fb6c61a601cf9cdd01f`
- Frontend SDK: pinned stable `genlayer-js@1.1.8`

The release reuses the verified contract. No deployment was made for the qualification. Its exact transaction and state evidence is in [LIVE proofs](LIVE_PROOFS.md) and [machine-readable provenance](../evidence/release-provenance.json).

## Acceptance evidence

- All 13 qualification writes finalized with successful execution and successful EVM receipts.
- The reviewer-required five methods each have a transaction hash and canonical readback.
- Adjudication consensus: `MAJORITY_AGREE`; verdict: `COMPLIANT`; `evidence_sufficient: true`.
- Award state: `ACCEPTED`.
- Delivery state: `DELIVERED`; delivery evidence is canonically recorded.
- New case escrow: `0.0001 GEN`; actual recorded transaction fees: `0 GEN`.
- Candidate contract liability: `0.0003 GEN`, including `0.0002 GEN` predating this case.
- Historical deployment escrow balances are unchanged.

## Frontend and release checks

The application connects to the same Studionet contract and typed schema. The stable SDK route uses actual calldata gas estimation and wallet confirmation, persists the returned hash immediately, prevents duplicate sends, tracks finality and execution separately, and reads canonical state after success. See [frontend integration](FRONTEND_LIVE_INTEGRATION.md).

Exact-head CI and production deployment results are recorded in GitHub Actions and Vercel after publication. The final Portal submission remains for the user.

Earlier `v1.0.0` and `v1.0.1` Studio-dev records are preserved under [`docs/history/`](history/README.md) and `evidence/qualification/historical/`.
