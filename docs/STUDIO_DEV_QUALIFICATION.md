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
The local GenLayer CLI account list and Windows credential manager both prove
that account `player2` is already unlocked for supplier
`0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8`; no password prompt or unlock
operation was needed. The buyer path used account `deployer` explicitly.

## Payout qualification attempt

The controlled payout case was created as
`PROCURA-LIVE-PAYOUT-20261007T164514Z`. These writes finalized successfully:

- `create_tender`: `0x2cfef235cfee7649f5ad5d38f235a5303c6c4545f5485c984d4b2dd3e1c7717d`
- `add_requirement`: `0xdbe44789e4a574d09d7e64fd16c76a37e5ac0a65a782339e8f0af2b608854b6f`
- `freeze_tender`: `0xeba58231622a43405a3e653612acb7ed30aa0c5890ca8cebffbb45d2a0a6e7e7`
- `fund_tender`: `0x69996f864e44f23912be2fa9f827d5b8c7f2c618e72317e823a5b46ade754556`
- `submit_bid` from `player2`: `0xeff4b2928f4825967d4d641b3c4c6cab7eee104fde1c1f42d8836ef8f57cfbe8`
- `add_bid_evidence` from `player2`: `0x0f1c8cec94e2444463654b5f5fa4f717d6e5f38fda135acabea1f6f877be1db2`
- `begin_bid_evaluation` from `deployer`: `0x31e4766a2cdd1b0947480a1e29711ceff29eb9369388774e10e81475ac5ab11d`

The first real adjudication preflight was intentionally stopped before
broadcast. Studio-dev returned VM status code `2` with:

`AttributeError: module 'genlayer.vm' has no attribute 'run_nondet_unsafe'. Did you mean: 'run_nondet_default'?`

The error originates in the frozen deployed contract's semantic bid vector.
The case remains `EVALUATING`, with `1000000000000000` wei escrow and global
liability. No award, acceptance, delivery, inspection, settlement, or duplicate
adjudication transaction was sent. The delivery adjudication path contains the
same frozen runtime symbol and is therefore not a safe alternative.

The frozen contract and deployment were not modified or redeployed. Payout
qualification and final global accounting remain BLOCKED by this deployed
runtime/API incompatibility. That #4 checkpoint was NOT READY FOR
PUBLICATION; the corrected Deployment #5 qualification is recorded below.

## Corrected 5jyc semantic probe

The runner source and official JSON fixture at
`acb37c7bf7b1e6d9fbfe004414a93fb6306135c0` verify that
`response_format="json"` returns a parsed dictionary through
`_decode_nondet_json`. Procura now uses that native mode in both semantic
calls and uses `gl.vm.run_nondet_default`.

One temporary probe deployment was used:
`0xAD920928752539Cf7f1f877B39BFEF6e4feEB342`. Requirement transaction
`0x1a20dce30e19f671a1d823927c303837f22fc7f76b6bbe43ec4889a58ba10a98` and
delivery transaction
`0x9853da45c06cb492d8d14342bbc77e62b21f419e2b7b46bdf549aa9c7a25ea52` both
finalized with consensus and valid strict dictionary payloads. This proves
runtime compatibility; semantic business outcomes remain evidence-dependent.

## Final Deployment #5 qualification record

Deployment #5 is the corrected source at
`0xE9f1319e98F25E301ee167aF41f82E25cC4f8770`, source SHA-256
`95f7cc706decbb3e38eb0a1f6f0014ffc2279ac6c3d07d883199b44cacc36fed`.
The deployment transaction
`0x8fa58c5e6e956831f56eb402d38d0fefdb6e16b625e875fcd85ce1086a289154`
finalized successfully and its schema contains 39 methods.

The JSON semantic probe passed requirement and delivery consensus with parsed
dictionary payloads and strict validation. One-wei live requirement and
delivery smoke cases also passed real consensus. The fresh awardable payout
case was `PROCURA-FINAL-PAYOUT-20261008T103200Z`; its requirement adjudication
`0x10e76d7559cb901bf45b0f09e3f580ad26c9dcb0935186ea0a99fe65ec0ce8f5`
returned `EQUIVALENT_ACCEPTABLE` with `MAJORITY_AGREE`, and delivery
adjudication `0x7c73f59c9de0f1a852c6cf950e8f71d3bcfe5a6a71c782ae3f2ef064296b557b`
returned `DELIVERY_ACCEPTED` with `MAJORITY_AGREE`. Settlement
`0x78e78e48787ae4e19f9c358d4af182e78e9880e81a94fa412079999b4d50c696`
paid the exact gross `1000000000000000` wei to supplier
`0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8`.

The earlier fresh diagnostic payout tuple reached `MAJORITY_DISAGREE` at
requirement adjudication. It was not retried; its escrow remains visible in
the final liability. This is a business-consensus/evidence outcome, not a
runtime compatibility failure and not a reason to redeploy.

Final accounting is conserved:
`3000000000000002 - 1000000000000001 - 1000000000000000 = 1000000000000001`,
matching both on-chain escrow liability and contract native balance. Bond
liability is zero. The one-wei delivery smoke was legally closed through
acceptance `0x3aa118d35114f918a01a5b2b8c8de34c632c999fb44b485bb313d6809b057069`
and settlement `0x2251b89c4eddbc13064fc445df7f80ea3a9b7bb8428bd13e417984eff5ad0944`.
Double-refund, payout-after-refund, double-payout, and refund-after-payout
guards all returned nonzero preflight failures without broadcasting. The
remaining one-wei requirement smoke and one failed payout tuple are explicitly
intentional outstanding qualification liabilities.

## Post-qualification liveness audit

The final payout tuple was audited read-only after the above qualification.
Although its `MAJORITY_DISAGREE` result is a legitimate failed semantic
execution outcome, it did not commit an adjudication record. The tender is
still `EVALUATING`, `finalize_bid_evaluation` cannot proceed, `cancel_tender`
does not permit that state, and no expiry/recovery method exists. It is
therefore a `CLASS_C_CONTRACT_LIVENESS_DEFECT`, not merely an evidence-quality
liability, and publication is blocked.

The canonical Deployment #5 remains unchanged. The local candidate adds only a
pre-semantic-call guards on the existing requirement and delivery adjudication
identities, leaving failed/undetermined attempts retryable while rejecting a
second call after a committed successful record. Its source SHA-256 is
recorded in the provenance manifest; it was not deployed.
