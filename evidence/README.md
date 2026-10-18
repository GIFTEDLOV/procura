# Evidence map

- `release-provenance.json`: current Studionet deployment, source/schema/ABI/interface hashes, complete transaction status, canonical readbacks, and accounting.
- `qualification/current/procura-v2-studionet-v2-1-2-live.json`: resumable qualification journal with all 13 operations, hashes, signers, nonces, consensus, execution, EVM receipts, fee/debit records, and canonical reads.
- `qualification/current/PROCURA_STUDIONET_FINAL_COMPLETION.md`: durable completion checkpoint.
- `qualification/current/procura-v2-studionet-v2-1-2-*.json`: the matching authorization, preflight, deployment reconciliation, and final read-only reconciliation records.
- `qualification/fixtures/genlayer-js-1b7f50a3-package.json`: exact public package manifest bytes submitted as genuine qualification evidence.
- `qualification/historical/`: superseded Studio-dev provenance and older qualification records. They do not represent current Studionet state.
- `controlled/`: explicitly controlled fixtures for demo and tests.
- `runtime-probes/`: SDK and runtime diagnostics, distinct from the current business qualification.
- `raw/`: retained original generated artifacts where normalized evidence is also supplied.

Current public transaction links and the canonical case summary are in
[`docs/LIVE_PROOFS.md`](../docs/LIVE_PROOFS.md). The same source, schema, and
accounting claims are checked in CI against the machine-readable provenance.
