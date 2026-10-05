# Economic model

GEN is received only through payable methods. `fund_tender` records the exact `gl.message.value` and creates escrow liability. `release_milestone`, `settle_award`, `refund_buyer`, and dispute resolution use the current external-message primitive `emit_transfer` to exit value.

The invariant is:

`escrow_liability = total_funded - total_supplier_payouts - total_buyer_refunds`.

Bond accounting is separate: posted, returned, and slashed totals are tracked independently. Settlement must not display “SETTLED” until finality and successful execution are reconciled.
# Gate 2 accounting hardening

Payout and refund exits now decrement the global `escrow_liability` before the
external transfer is emitted. Both paths reject underflow and share mutually
exclusive payout/refund replay guards. Payment milestones are parsed and
bounded against awarded price, and each milestone index is single-use.

Bond policy is frozen at award time through the tender policy string using the
canonical `NONE`, `FIXED:<amount>`, or `PERCENT:<0..100>` forms. Bond return and
slash are mutually exclusive and independently conserved.

Runtime balance proofs remain pending Local Studio qualification.
