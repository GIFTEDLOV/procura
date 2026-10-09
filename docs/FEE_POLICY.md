# Studio-dev v0.6 fee policy

The qualification and frontend fee layer stores resource requirements, not a
live `feeValue`. Current Studio-dev prices and caps are obtained from the
matching `genlayer-py 0.19.0rc2` SDK at signing time.

The canonical measured profile is
`evidence/studio-dev-fee-profile.json` for Studio-dev chain 61997. Ordinary
Procura writes use zero message fees. Methods that can emit a native GEN
external message must additionally supply an explicit allocation tree.

For the native buyer refund path (`cancel_tender`) and supplier settlement
path (`settle_award`), the current measured allocation is:

- message type: `External`
- finalization phase: `onAcceptance=false`
- data: `0x`
- call key: derived from the exact empty data by the installed SDK
- gas limit: `500000`
- maximum gas price: `250000000`
- message budget: `125000000000000` wei

The recipient is dynamic and must be the frozen buyer for cancellation or the
frozen supplier for settlement. The allocation is passed to
`estimate_transaction_fees` and to the exact `write_contract` call. A missing
allocation is invalid for these message-emitting methods, even when
`totalMessageFees` is nonzero.

The first cancel attempt demonstrated the failure mode:
`Mode1MessageFeesRequireGenVMPerEmissionSupport`. The successful same-case
retry used the allocation above, consumed the full message budget, and
finalized the buyer's gross refund.

The frontend adapter consumes the same resource profile through
`frontend/src/lib/feeProfile.ts`. It derives the external allocation recipient
from the frozen buyer or awarded supplier context, never from a caller-entered
address, and obtains the current `feeValue` from the SDK at signing time. The
supplier payout allocation was not consumed on-chain because the frozen
contract stopped at semantic adjudication before settlement preflight.

The corrected JSON semantic compatibility probe used no native value exit and
therefore did not change the refund or settlement allocation profile. The
completed Deployment #5 qualification used a fresh nonzero fee quote at
signing time and reused the already-proven external message allocation shape
for refund and payout.

## Deployment #5 measured exits

Deployment #5 used a fresh nonzero deployment fee quote of
`100000000000010352` wei. The final refund and final supplier settlement both
used the pinned external allocation shape above and exact recipient derivation.
The refund receipt emitted one buyer message for the gross
`1000000000000000` wei; the payout receipt emitted one supplier message for
the same gross amount. Protocol fees are reconciled separately from gross
contract accounting, so buyer wallet deltas are not treated as gross refund
proofs.

## Deployment #6 measured exits

Deployment #6 used a fresh nonzero deployment fee quote of
`100000000000010352` wei. The final refund transaction
`0x2b71e96260acc5b07f82ee4eabdfccf85e079575a24795339d6baf62cb46a536` and
the final settlement transaction
`0x46c000b3ac9d5034d74b54a20a96f1a8b1299ca8c15929d5e168aac4b7b4ff18`
used the same SDK-derived external allocation profile with recipients derived
from canonical state. Both gross exits were exactly
`1000000000000000` wei. The buyer's wallet delta is net of protocol fees;
contract balance, escrow, liability, and accounting proofs use gross values.
