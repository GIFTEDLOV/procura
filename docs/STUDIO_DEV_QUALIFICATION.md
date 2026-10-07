# Studio-dev qualification

## Network

- Network: Studio-dev
- Chain ID: 61997
- RPC: `https://studio-dev.genlayer.com/api`
- Buyer/deployer: `0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`
- Supplier: `0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8`

## Frozen deployment

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

## Live refund qualification

The typed SDK recovery used case `PROCURA-LIVE-REFUND-20261007T000100Z`.
These setup writes finalized successfully:

- `create_tender`: `0x8eb9a4f3a0a9ba41a45bfee25c8a0187148068f39a395e532537419096eef273`
- `add_requirement`: `0x50db734406794d7e925f09f1968aff1e7629b7a22bbb2c632bb6327e0d8571ce`
- `freeze_tender`: `0x0beecb37aa15a9e0af77fb6473ae3bbf9acd646526eece8c17b997167a8d3da0`
- `fund_tender`: `0x1f02d10e7bbca4ebde25f875190638984a124ddff77e07cb3b90601b87b550c1`

Funding proved `1000000000000000` wei in case escrow and global liability.

The first `cancel_tender` write was:

- Transaction: `0x17afb3ef3cd14c90960f5ea0e19534325a4bf6702d4f357cf9da3567790cf321`
- Result: `FINISHED_WITH_ERROR`
- Exact GenVM error: `Mode1MessageFeesRequireGenVMPerEmissionSupport`
- Decoded reason: `fee-bearing GenVM messages require a message allocation tree`
- Allocations: none; message budget: `125000000000000` wei
- State mutation: none; the case remained `FUNDED` with escrow and liability
  of `1000000000000000` wei.

The one authorized retry used the same case and an SDK-derived allocation:

- Message type: `External` (`0`)
- Finalization phase: `onAcceptance=false`
- Recipient: buyer `0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`
- Value: `1000000000000000` wei
- Data: `0x`
- Call key: `0x0000000000000000000000000000000000000000000000000000000000000000`
- Gas limit: `500000`
- Maximum gas price: `250000000`
- Allocation budget: `125000000000000` wei

The retry was:

`0x84b76e6176349cd45189a01f99f7edc0a9eb7d94145e0a53eb14ff0f43396b59`

Its raw `gen_call type=write` preflight returned `00`; the transaction
finalized with successful execution. The parent receipt emitted exactly one
buyer message for `1000000000000000` wei and returned no separate triggered
transaction id. Message budget and consumption were each
`125000000000000` wei. Settled primary protocol fee was
`126308750000823` wei.

The refund proof is gross, not net-wallet-only. Buyer balance was
`75561255089164823331041` before and `75561255962856073330218` after, for a
net increase of `873691249999177` wei. That equals the gross refund less the
settled protocol fee. Contract balance, case escrow, and global liability each
decreased by exactly `1000000000000000` wei, and `total_buyer_refunds` rose by
the same amount.

Canonical readback is terminal `CANCELLED`. A second cancel preflight was not
broadcast and returned `tender cannot be cancelled in current state`, proving
the double-refund guard. Payout for these refunded funds is unavailable from
the terminal state.

## Qualification tooling and remaining blocker

The qualification client uses `genlayer-py 0.19.0rc2` typed SDK writes. It
validates the deployed schema, keeps hashes as Python strings, uses raw
Studio-dev `gen_call` with `type: "write"` as the non-transactional preflight,
journals hashes before reconciliation, and does not blind-retry submitted
transactions. The client derives external message call keys and passes the
matching allocation tree for message-emitting writes. It never hardcodes a
live `feeValue`.

The numeric-hash, storage-allocation, and fee-allocation regression tests pass.
Payout qualification has not been attempted: the supplier-authorized signer
for `0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8` is not available in the
workspace. No supplier key was guessed or printed, and no payout case or
payout transaction was created.

Release status: NOT READY FOR PUBLICATION until supplier payout and global
accounting are proven.
