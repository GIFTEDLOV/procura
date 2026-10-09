# Frontend live integration

The released frontend exposes three explicit data modes:

- **LIVE** reads the canonical Procura deployment on Studio-dev / 61997 and never falls back to fixtures when reads fail or return no records.
- **CONTROLLED DEMO** uses the Northstar Energy Procurement fixture for guided product review. It is visibly labelled and does not masquerade as canonical state.
- **HISTORICAL PROOF** renders frozen deployment/provenance records read-only and is visibly separated from current contract state.

## Canonical configuration

- Contract: `0x88634c7868B0659b46C5bd93E4038222697a0170`
- Source SHA-256: `daad9b0c43be603e522afbf55623e7b8027d7de3b01708922360ae5a45972cde`
- Network: `studio-dev`
- Chain: `61997`

## Public LIVE reads

`frontend/src/lib/liveData.ts` reads protocol info, tender IDs, tender state, requirements, bids, accounting, and audit events through `genlayer-js`. TanStack Query uses finite freshness and refetch-on-focus. Loading, empty, partial, and RPC error states are distinct; missing state is not replaced by demo values.

## Wallet and role resolution

Public browsing does not require a wallet. The header exposes an EIP-1193 connection action and reports address, chain, and role. The application recognizes the frozen buyer, frozen supplier, and observer roles. Wrong chain and disconnected states are explicit, and a connected observer is not presented as a buyer or supplier.

## LIVE writes

Write surfaces use `buildTypedAction`, `assertStudioDevWallet`, `assertRole`, and `executeLiveWrite` from the existing adapter boundary. Components do not construct calldata. The engine performs:

1. canonical precondition read;
2. wallet confirmation and role/network checks;
3. SDK simulation and fee estimation;
4. exactly one broadcast;
5. immediate hash persistence;
6. finality and execution-result verification;
7. canonical readback.

The Bid Builder and Tender Builder expose the real typed-action path in LIVE mode. Controlled-demo actions remain local and clearly state that no broadcast occurred. Value exits keep gross value separate from protocol fees and use the established external-message allocation profile.

## Same-hash recovery

Persisted hashes are surfaced in the transaction activity center. Refreshing or reopening the application recovers finality from the same hash; it never rebroadcasts automatically. Finalized execution errors and canonical readback failures remain failure states.

## Evidence and semantic state

Evidence cards identify the authenticated source/hash boundary. The UI displays canonical semantic results and replay-guard state; it does not reinterpret prose, extract arbitrary JSON, or permit a finalized result to be adjudicated again. Failed or undetermined semantic attempts remain retryable only while no canonical adjudication record exists.

## Historical separation

Deployment #4 and #5 records remain in `docs/history/` and evidence history. Deployment #6 is the only current canonical deployment. Historical values are never used to populate LIVE mode or current accounting.
