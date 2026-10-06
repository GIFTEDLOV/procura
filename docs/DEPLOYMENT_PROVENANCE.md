# Deployment provenance

## Frozen artifact

- Migration commit: `20cad7f76d6dd01342879b6276d03d3d993540da`
- Contract file: `contracts/Procura.py`
- SHA-256: `2db6fb65105b9dd330fd4dedec8c8995ee904cc54597465144e2e4695214efb4`
- Runner: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
- Interface: 39 methods; schema parity PASS

## Historical attempts

1. Deployment #1: zero protocol fee; no contract.
2. Deployment #2: legacy runner/API incompatibility; terminal
   `FINISHED_WITH_ERROR`; unusable receipt address.
3. Deployment #3: successful and finalized as recorded below.

## Deployment #3

- Network: Studio-dev, chain 61997
- RPC: `https://studio-dev.genlayer.com/api`
- Transaction: `0x667b1718273e82c76a091d8cccbe8d5c848be13cbfec0385f432275d2d8791f3`
- Address: `0x25cDb9C8Bf6A647Cf964dA999d82fD802057f835`
- Fee value: `100000000000010352` wei
- Source SHA match: YES
- Finality: YES
- Execution success: YES

## Qualification boundary

No funding, refund, payout, or settlement proof was completed. The only live
case setup write failed because the CLI treated an all-numeric hash argument as
an integer. The contract remained unchanged by that failed call. No further
live write was sent after the failure.

The recovery pass added a type-safe `genlayer-py 0.19.0rc2` qualification
helper and a regression test proving numeric-only 64-character hash strings
remain strings through the SDK calldata encoder. The exact new `create_tender`
write was preflighted with schema-ordered typed arguments through raw
Studio-dev `gen_call` with `type: "write"`. Studio-dev returned RPC
`-32000`; the embedded GenVM result was `execution_result: ERROR`, with
`TypeError: this class can't be instantiated by user` at
`gl.storage.DynArray[str]()` in `create_tender`. The normalized runtime
classification is status code `2`. The helper stopped before broadcast, so no
fee quote or live value qualification was performed. The frozen contract and
deployment remain unchanged.
