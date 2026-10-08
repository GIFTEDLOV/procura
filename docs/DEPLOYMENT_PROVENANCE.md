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

## Message-fee recovery

The typed SDK recovery preserved hashes as Python strings. The corrected
create/requirement/freeze/fund path finalized on deployment #4. Funding proved
`1000000000000000` wei escrow and global liability. The first cancel/refund
write was finalized with `FINISHED_WITH_ERROR`:
`Mode1MessageFeesRequireGenVMPerEmissionSupport`. Its receipt had no
allocation tree and canonical readback proved no state mutation.

The exact required external allocation was derived with
`genlayer-py 0.19.0rc2`: message type `External`, `onAcceptance=false`, buyer
recipient, empty data, zero call key, gas limit `500000`, maximum gas price
`250000000`, and budget `125000000000000` wei. The one authorized same-case
retry was:

`0x84b76e6176349cd45189a01f99f7edc0a9eb7d94145e0a53eb14ff0f43396b59`

It finalized successfully and emitted exactly `1000000000000000` wei to the
buyer. The parent receipt returned no separate triggered transaction id,
consumed `125000000000000` wei of message budget, and settled primary protocol
fees of `126308750000823` wei. Buyer net delta was
`873691249999177` wei, exactly gross refund less settled protocol fees.
Contract balance, escrow/liability, and refund accounting each reconciled to
the gross `1000000000000000` wei.

No duplicate refund write was sent. The supplier signer is the already-unlocked
local `player2` account at `0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8`.

## Payout qualification stop

The controlled payout case `PROCURA-LIVE-PAYOUT-20261007T164514Z` finalized its
setup, supplier bid/evidence, and buyer evaluation-start writes. The exact raw
`gen_call type=write` preflight for `adjudicate_requirement` returned VM status
code `2` before any transaction was submitted:

`AttributeError: module 'genlayer.vm' has no attribute 'run_nondet_unsafe'`

This is a defect in the frozen deployed runtime/API compatibility boundary,
not a client serialization issue. The case is left canonically
`EVALUATING` with `1000000000000000` wei escrow and liability. No unsafe retry,
award, delivery, inspection, settlement, or payout transaction was sent. The
same symbol is used by delivery adjudication, so no alternate payout path was
attempted. The canonical contract remains frozen at the SHA above and no
redeployment was performed.

## 5jyc JSON semantic compatibility probe

The diagnostic probe confirmed the remaining failure was text transport, not
storage, transaction construction, or missing nondeterminism support. The
corrected probe used `run_nondet_default` and native JSON response mode on
both bounded semantic paths.

- Probe deployment: `0x631bc97d6e818d91c2485b109e17887a07a61c0454c52507cca1d19b72ffa631`
- Probe address: `0xAD920928752539Cf7f1f877B39BFEF6e4feEB342`
- Requirement probe: `0x1a20dce30e19f671a1d823927c303837f22fc7f76b6bbe43ec4889a58ba10a98`
- Delivery probe: `0x9853da45c06cb492d8d14342bbc77e62b21f419e2b7b46bdf549aa9c7a25ea52`
- Both: finalized, `MAJORITY_AGREE`, validator execution succeeded for the
  agreeing quorum, and strict payload readback was valid.

This probe did not alter the historical deployment or the locked payout case.
