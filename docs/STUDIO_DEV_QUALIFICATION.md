# Studio-dev qualification

## Network

- Network: Studio-dev
- Chain ID: 61997
- RPC: `https://studio-dev.genlayer.com/api`
- Deployer/buyer: `0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`
- Supplier: `0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8`

## Deployments

Deployment #3 is superseded and must not be used:

- Transaction: `0x667b1718273e82c76a091d8cccbe8d5c848be13cbfec0385f432275d2d8791f3`
- Contract: `0x25cDb9C8Bf6A647Cf964dA999d82fD802057f835`
- Status: finalized/source-parity PASS, but runtime-broken by direct generic
  storage construction in `create_tender`.

Deployment #4 is the corrected canonical deployment:

- Transaction: `0xf74cee6667f2c57282df15976e661fc78c31cf6ab7b034df4e4856c4c17107fd`
- Contract: `0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA`
- Fee deposit: `100000000000010352` wei
- Finality: `FINALIZED`
- Execution: `FINISHED_WITH_RETURN` / result `1`
- Source SHA-256: `81708da07492a1d0b6fd26ee804479d9cd371861bf3de4ed62283d65dceb4143`
- Schema: 39 public methods; deployed parity PASS

## Live qualification blocker

The typed SDK recovery was run against deployment #4 using case
`PROCURA-LIVE-REFUND-20261007T000100Z`. These writes finalized successfully:

- `create_tender`: `0x8eb9a4f3a0a9ba41a45bfee25c8a0187148068f39a395e532537419096eef273`
- `add_requirement`: `0x50db734406794d7e925f09f1968aff1e7629b7a22bbb2c632bb6327e0d8571ce`
- `freeze_tender`: `0x0beecb37aa15a9e0af77fb6473ae3bbf9acd646526eece8c17b997167a8d3da0`
- `fund_tender`: `0x1f02d10e7bbca4ebde25f875190638984a124ddff77e07cb3b90601b87b550c1`

Funding used `1000000000000000` wei and canonical readback proved matching
escrow and global liability increases. The one `cancel_tender` refund-exit
write was broadcast once:

- `cancel_tender`: `0x17afb3ef3cd14c90960f5ea0e19534325a4bf6702d4f357cf9da3567790cf321`
- Final result: `FINISHED_WITH_ERROR`
- Exact GenVM error:
  `Mode1MessageFeesRequireGenVMPerEmissionSupport: fee-bearing GenVM messages
  require a message allocation tree`
- External message count: `0`

The fee profile supplied `totalMessageFees`, but Studio-dev v0.6 also requires
an explicit message allocation tree for a fee-bearing external transfer. The
transaction was not retried. No refund recipient delta was claimed, and the
payout case was not started.

Release status: NOT READY FOR PUBLICATION. No additional deployment or live
write is authorized by this stopped pass.

## Typed SDK and storage recovery

The qualification client uses the installed `genlayer-py 0.19.0rc2` high-level
SDK in `scripts/qualification/studio_live_qualification.py`. It validates the
deployed schema, keeps hashes as Python `str`, lowers named values to schema
order, uses raw Studio-dev `gen_call` with `type: "write"` as the
non-transactional preflight, journals hashes before reconciliation, and has no
blind retry path.

The focused hash-string regression test passes for numeric-only, all-zero, and
ordinary lowercase 64-character SHA-256 strings. The corrected raw
`create_tender` preflight returned `00`, proving the storage remediation removed
the historical `gl.storage.DynArray[str]()` failure. The later blocker is a
separate Studio-dev message-allocation-tree requirement for fee-bearing
external transfers; the contract source was not changed.
