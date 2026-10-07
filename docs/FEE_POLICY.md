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
