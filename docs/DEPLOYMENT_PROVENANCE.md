# Deployment provenance

## Frozen artifact

- Migration commit: `20cad7f76d6dd01342879b6276d03d3d993540da`
- Storage fix commit: `c51aa2ae578ed84b3d681a15610010af45a1e6e1`
- Contract file: `contracts/Procura.py`
- SHA-256: `81708da07492a1d0b6fd26ee804479d9cd371861bf3de4ed62283d65dceb4143`
- Runner: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
- Interface: 39 methods; schema parity PASS

## Historical attempts

1. Deployment #1: zero protocol fee; no contract.
2. Deployment #2: legacy runner/API incompatibility; terminal
   `FINISHED_WITH_ERROR`; unusable receipt address.
3. Deployment #3: successful and finalized, then superseded as runtime-incompatible.
4. Deployment #4: corrected storage-allocation source; canonical deployment.

## Deployment #3 (superseded)

- Network: Studio-dev, chain 61997
- RPC: `https://studio-dev.genlayer.com/api`
- Transaction: `0x667b1718273e82c76a091d8cccbe8d5c848be13cbfec0385f432275d2d8791f3`
- Address: `0x25cDb9C8Bf6A647Cf964dA999d82fD802057f835`
- Fee value: `100000000000010352` wei
- Source SHA match: YES
- Finality: YES
- Execution success: YES

Runtime status: `SUPERSEDED_RUNTIME_INCOMPATIBLE`; `create_tender` failed on
`gl.storage.DynArray[str]()`.

## Deployment #4 (canonical)

- Network: Studio-dev, chain 61997
- RPC: `https://studio-dev.genlayer.com/api`
- Transaction: `0xf74cee6667f2c57282df15976e661fc78c31cf6ab7b034df4e4856c4c17107fd`
- Address: `0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA`
- Fee value: `100000000000010352` wei
- Source SHA match: YES
- Finality: YES
- Execution: `FINISHED_WITH_RETURN` / result `1`
- Schema: 39 methods; ABI parity PASS

## Qualification boundary

The typed SDK recovery preserved hashes as Python strings. The corrected
create/requirement/freeze/fund path finalized on deployment #4. Funding proved
`1000000000000000` wei escrow and global liability. The single cancel/refund
write finalized with `FINISHED_WITH_ERROR` because Studio-dev required a
message allocation tree for the fee-bearing external transfer. No retry and no
payout write were sent.

The recovery pass added a type-safe `genlayer-py 0.19.0rc2` qualification
helper and a regression test proving numeric-only 64-character hash strings
remain strings through the SDK calldata encoder. The corrected raw
`gen_call type=write` create preflight returned `00`; the later blocker is the
separate message-allocation-tree requirement above.
