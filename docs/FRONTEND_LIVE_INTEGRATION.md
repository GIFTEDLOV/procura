# Frontend LIVE integration

The public app targets Procura V2.1.2 on Studionet (`61999`) at
`0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929`. `frontend/src/lib/liveConfig.ts`
holds the chain, RPC, contract, and source hash. The typed
`contracts/schema.v2.evidence.json` is the shared action manifest used by the
adapter, serializers, schema tests, and release parity check.

The frontend pins stable `genlayer-js@1.1.8` as `genlayer-stable`. The
release-candidate SDK is not a frontend dependency. Public reads use the stable
client at the Studionet RPC. Loading, empty, partial, and RPC error states are
shown distinctly; LIVE data does not fall back to demo fixtures.

## Wallet and LIVE write path

The wallet must report chain `61999` and the same account that was attached to
the stable SDK client. Method roles are checked against canonical precondition
reads. The current LIVE controls submit these schema-mapped operations:

- `create_tender`
- `submit_bid`
- `add_bid_evidence`
- `create_delivery`
- `add_delivery_evidence`

Each write follows this path:

1. Build arguments from the shared schema and normalize contract timestamps to
   UTC strings and SHA-256 fields to lowercase 64-character strings.
2. Read canonical prerequisites and check the wallet's chain, address, and
   method role.
3. Let stable SDK `writeContract` encode the call, request `eth_estimateGas`
   for its calldata, request `eth_gasPrice`, and open the connected wallet's
   transaction confirmation.
4. Persist the returned wallet transaction hash at the EIP-1193 transport
   boundary. A per-attempt guard rejects a second `eth_sendTransaction`.
5. Track that same hash through consensus finality. `ACCEPTED` is still
   pending; finalization is not success until the leader and validators have
   successful execution and the canonical transaction result agrees.
6. Read the canonical entity back from the submitted contract and update the
   displayed LIVE state.

On a timeout or browser interruption, the transaction journal resumes the
existing hash. The adapter never sends a replacement because polling failed.
Only a positive `READY_TO_FINALIZE` state permits a finalization call. The
finalized transaction still needs successful consensus, execution, and
readback.

External-message payout methods remain unavailable in the current frontend
until their Studionet fee allocation profile is measured and reviewed. The
completed qualification does not include a payout.

## Reviewer proof

All 13 writes in the qualification lifecycle are linked in [LIVE proofs](LIVE_PROOFS.md).
The full journal, actual receipt outcomes, evidence identifiers, canonical
readbacks, and escrow reconciliation are in
[`evidence/release-provenance.json`](../evidence/release-provenance.json).
The deployed schema is also covered by the shared mapping tests and the
`build/provenance` CI job.

The older V1/Studio-dev UI and fee records are retained as historical evidence
and are not used for current LIVE state.
