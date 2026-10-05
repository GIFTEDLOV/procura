# Economic model

GEN is received only through payable methods. `fund_tender` records the exact `gl.message.value` and creates escrow liability. `release_milestone`, `settle_award`, `refund_buyer`, and dispute resolution use the current external-message primitive `emit_transfer` to exit value.

The invariant is:

`escrow_liability = total_funded - total_supplier_payouts - total_buyer_refunds`.

Bond accounting is separate: posted, returned, and slashed totals are tracked independently. Settlement must not display “SETTLED” until finality and successful execution are reconciled.
