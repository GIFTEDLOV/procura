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

## Deployment #5: corrected 5jyc candidate

- Network: Studio-dev, chain 61997
- Transaction: `0x8fa58c5e6e956831f56eb402d38d0fefdb6e16b625e875fcd85ce1086a289154`
- Address: `0xE9f1319e98F25E301ee167aF41f82E25cC4f8770`
- Fee value: `100000000000010352` wei
- Source SHA-256: `95f7cc706decbb3e38eb0a1f6f0014ffc2279ac6c3d07d883199b44cacc36fed`
- Finality: YES; execution: `FINISHED_WITH_RETURN` / `SUCCESS`
- Schema: 39 methods; ABI parity PASS

The temporary JSON probe requirement transaction was
`0x1a20dce30e19f671a1d823927c303837f22fc7f76b6bbe43ec4889a58ba10a98` and
the delivery transaction was
`0x9853da45c06cb492d8d14342bbc77e62b21f419e2b7b46bdf549aa9c7a25ea52`.
Both reached finalized `MAJORITY_AGREE` with valid strict parsed payloads.

### Deployment #5 live qualification

- One-wei requirement smoke: `PROCURA-LIVE-SEMANTIC-SMOKE-20261008T094107Z`,
  adjudication `0xb72cbaa77b9426e52179f998291feb007b14b39ec84c588151e7f1d00c1b764d`,
  `EQUIVALENT_ACCEPTABLE`, consensus PASS.
- One-wei delivery smoke: `PROCURA-LIVE-DELIVERY-SMOKE-20261008T095540Z`,
  requirement adjudication `0x7154e4789d53fde09c3c2ebb8323da1ad320eeb9a6a1f3953be4bf046500b2c8`,
  delivery adjudication `0xc4d53ffa98e31af12088b106700a3f5590523ce0831cd5fa13a7859da387e9f7`,
  `DELIVERY_ACCEPTED`, consensus PASS. Its canonical delivery acceptance was
  `0x3aa118d35114f918a01a5b2b8c8de34c632c999fb44b485bb313d6809b057069` and
  its one-wei settlement was
  `0x2251b89c4eddbc13064fc445df7f80ea3a9b7bb8428bd13e417984eff5ad0944`.
- Final refund case: `PROCURA-FINAL-REFUND-20261008T100900Z`, refund
  transaction `0xc7f643ce085e0294e31664d91e9426b74a4b0f3672790b4f723408b8550d97f9`.
  Gross buyer exit, escrow, liability, and refund accounting each reconciled
  to `1000000000000000` wei; the buyer's net wallet delta correctly excluded
  settled protocol fees.
- Diagnostic payout tuple `PROCURA-FINAL-PAYOUT-20261008T101500Z` reached
  `MAJORITY_DISAGREE` on requirement adjudication
  `0x0014ef10018a59d15be3a0764b203600b278d3d9cb8b3f8a66f20cb28da7632c`.
  It was not retried and remains a funded escrow liability.
- Final awardable payout case:
  `PROCURA-FINAL-PAYOUT-20261008T103200Z`.
  Fund transaction: `0x35779dd2a195154182646398cfa16d5c7f9b02d7cdeec2dbf7b7234054c368b5`.
  Requirement adjudication: `0x10e76d7559cb901bf45b0f09e3f580ad26c9dcb0935186ea0a99fe65ec0ce8f5`,
  `EQUIVALENT_ACCEPTABLE`, `MAJORITY_AGREE`. Delivery adjudication:
  `0x7c73f59c9de0f1a852c6cf950e8f71d3bcfe5a6a71c782ae3f2ef064296b557b`,
  `DELIVERY_ACCEPTED`, `MAJORITY_AGREE`. Settlement transaction:
  `0x78e78e48787ae4e19f9c358d4af182e78e9880e81a94fa412079999b4d50c696`.
  Gross supplier exit was exactly `1000000000000000` wei.

Final Deployment #5 accounting readback:

- `total_funded = 3000000000000002`
- `total_supplier_payouts = 1000000000000001`
- `total_buyer_refunds = 1000000000000000`
- `escrow_liability = 1000000000000001`
- `bond_liability = 0`
- contract native balance = `1000000000000001`
- unexplained native balance = `0`

The remaining liability is exactly 1 wei in
`PROCURA-LIVE-SEMANTIC-SMOKE-20261008T094107Z` plus
`1000000000000000` wei in `PROCURA-FINAL-PAYOUT-20261008T101500Z`.
Both are intentional outstanding qualification liabilities: each is currently
`EVALUATING`, neither has a legal terminal action from its current state, and
no duplicate semantic adjudication or synthetic recovery path was attempted.

The historical #4 address `0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA` and
locked case `PROCURA-LIVE-PAYOUT-20261007T164514Z` remain preserved and are
excluded from Deployment #5 accounting.

## Final liveness audit blocker

The final canonical contract was audited read-only after reconciliation. Case
`PROCURA-FINAL-PAYOUT-20261008T101500Z` is funded with
`1000000000000000` wei and remains `EVALUATING`. Its semantic transaction
`0x0014ef10018a59d15be3a0764b203600b278d3d9cb8b3f8a66f20cb28da7632c`
finished with lifecycle outcome `UNDETERMINED` and consensus result
`MAJORITY_DISAGREE`; no adjudication record or state mutation was committed.

Source inspection proved that `begin_bid_evaluation` enters `EVALUATING`,
`finalize_bid_evaluation` requires a stored adjudication, `cancel_tender` does
not accept `EVALUATING`, and no expiry/recovery method exists. The case has no
direct terminal value exit, but the canonical pre-fix adjudication function
writes no identity until semantic success, so the same tuple is retryable.
The one-shot qualification flow blocked that retry. This is
`CLASS_B_QUALIFICATION_SCRIPT_BUG` for liveness; publication remains blocked
by the separate successful-result replay gap.

The local, undeployed candidate adds pre-semantic-call guards on the existing
requirement and delivery adjudication identities. Failed or undetermined
semantic transactions commit no record and remain retryable; once a successful
record exists, a second call is rejected. Candidate SHA-256 is recorded in the
provenance manifest.
