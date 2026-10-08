# Procura frontend live integration

The production transaction boundary is implemented in:

- `frontend/src/lib/liveConfig.ts` — Studio-dev 61997, canonical contract, and
  explicit LIVE / CONTROLLED DEMO / HISTORICAL modes;
- `frontend/src/lib/liveAdapter.ts` — schema-ordered typed actions, role and
  network guards, SDK preflight, current fee estimation, one-shot broadcast,
  persisted-hash recovery, finality/execution checks, and canonical readback;
- `frontend/src/lib/feeProfile.ts` — resource requirements and external-message
  allocations derived from `evidence/studio-dev-fee-profile.json`.

React components do not construct calldata or call low-level write RPCs. The
Bid Builder now prepares a typed contract action at the adapter boundary; in
CONTROLLED DEMO mode it does not broadcast. A future LIVE wallet session must
provide an EIP-1193 provider and use the same `executeLiveWrite` engine.

Role enforcement is frozen to contract semantics: buyer-only methods require
the canonical buyer, supplier-only methods require the canonical awarded
supplier, and party methods require one of those two canonical parties.
`cancel_tender`/`refund_buyer` allocations derive the frozen buyer recipient;
`settle_award` derives the awarded supplier recipient. Both use the SDK's
empty-calldata external call-key derivation and require a positive message
budget. Ordinary writes receive no external allocation.

The adapter persists the returned transaction hash immediately, never
rebroadcasts after a hash exists, waits for finalized execution success, and
requires a caller-supplied canonical readback before reporting success. Wrong
chain, disconnected wallet, wrong role, failed execution, and canonical
readback mismatch remain explicit failure states.

At the earlier #4 qualification checkpoint, the live supplier payout remained
blocked by the frozen deployed contract's missing
`gl.vm.run_nondet_unsafe` runtime symbol during semantic adjudication.

The contract-side compatibility fix is now isolated and verified by the
corrected 5jyc JSON semantic probe. Deployment #5 now supplies the canonical
address and source hash below, followed by the existing browser and adapter
regression suite.

## Deployment #5 canonical configuration

The live adapter now points to Deployment #5:

- Contract: `0xE9f1319e98F25E301ee167aF41f82E25cC4f8770`
- Source SHA-256: `95f7cc706decbb3e38eb0a1f6f0014ffc2279ac6c3d07d883199b44cacc36fed`
- Network: Studio-dev, chain 61997

The adapter regression suite remains green: 54 Vitest tests, typecheck, build,
and 16 Playwright browser tests. No Vercel deployment or public live-wallet
session was performed.
