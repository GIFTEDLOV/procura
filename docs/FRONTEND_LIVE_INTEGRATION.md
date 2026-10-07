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

Current qualification status: adapter tests and frontend build pass. The live
supplier payout remains blocked by the frozen deployed contract's missing
`gl.vm.run_nondet_unsafe` runtime symbol during semantic adjudication.
