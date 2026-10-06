# Studio-dev qualification

## Network

- Network: Studio-dev
- Chain ID: 61997
- RPC: `https://studio-dev.genlayer.com/api`
- Deployer/buyer: `0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`
- Supplier: `0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8`

## Deployment

The one authorized deployment (#3) was broadcast once and finalized:

- Transaction: `0x667b1718273e82c76a091d8cccbe8d5c848be13cbfec0385f432275d2d8791f3`
- Contract: `0x25cDb9C8Bf6A647Cf964dA999d82fD802057f835`
- Fee deposit: `100000000000010352` wei
- Finality: `FINALIZED`
- Execution: `FINISHED_WITH_RETURN` / result `1`
- Deployed code: 45,202 bytes; SHA-256 matches the frozen migrated source
- Schema: 39 public methods

## Live qualification blocker

The controlled refund case was started once with case ID
`PROCURA-LIVE-REFUND-20261006T1552Z`. Its first write was broadcast once:

- `create_tender`: `0x1eaf2b52c33e79f5e8b9aabf092dc5a6aa45bec601ffde9170906809a48d13ec`

The transaction finalized with consensus accepted but GenVM
`FINISHED_WITH_ERROR`; canonical `get_tender_ids` and `get_accounting` then
confirmed no tender or value state was created. The exact decoded calldata
shows the 64-character all-numeric `tender_hash` was serialized as an integer
by the CLI argument parser. Procura's existing `_hash` guard correctly
rejected it because the public argument must be a string. The validator error
was `tender_hash must be exactly 64 lowercase hexadecimal characters`. No
retry was sent.

The direct pre-award cancellation path was therefore not reached. No funding,
refund, payout, supplier settlement, or live balance-delta proof exists. The
payout case was not started.

One separate zero-value diagnostic transaction was accidentally sent while a
temporary wrapper routed `get_accounting` through the write path:
`0x47da157a0dfde3678f931dc1b8bf268100fd871ac540eedc91a9c899d836d112`.
It finalized accepted with no state mutation; it is retained in provenance
for transparency and was not rebroadcast.

Release status: NOT READY FOR PUBLICATION. The failed live setup must be
corrected and re-qualified; no deployment #4 is authorized by this pass.

## Typed SDK recovery attempt

The qualification client was replaced with the installed `genlayer-py
0.19.0rc2` high-level SDK in
`scripts/qualification/studio_live_qualification.py`. It validates the
deployed `create_tender` schema, keeps `tender_hash` as Python `str`, lowers
named values to the schema's positional order (`kwparams: {}`), and uses the
raw Studio-dev `gen_call` RPC with `type: "write"` as the non-transactional
preflight. It journals a submitted hash before reconciliation and has no retry
path.

The focused regression test passes for numeric-only, all-zero, and mixed-case
64-character SHA-256-compatible strings. The exact new refund-case
`create_tender` raw `gen_call` preflight was then run with fresh candidate ID
`PROCURA-LIVE-REFUND-20261007T000000Z`. The SDK calldata path preserved the
hash as a string. Studio-dev returned RPC `-32000`, with an embedded GenVM
`execution_result: ERROR` and normalized runtime status code `2`. The exact
GenVM stderr was:

`TypeError: this class can't be instantiated by user` at
`gl.storage.DynArray[str]()` in the frozen `create_tender` implementation.

Because the authoritative raw preflight failed, no fee profile was applied,
no `estimate_transaction_fees` quote was used, and no live write was
broadcast. Canonical readback remained empty: no tender, funding, refund,
payout, or settlement state exists. The blocker is now a concrete frozen
contract/runtime incompatibility; this pass does not modify the contract.
