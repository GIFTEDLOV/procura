# Economic model

GEN is received only through payable methods. `fund_tender` records the exact
`gl.message.value` and creates escrow liability. `release_milestone`,
`settle_award`, `refund_buyer`, and cancellation refund paths use the current
external-message primitive `emit_transfer` to exit value.

The invariant is:

`escrow_liability = total_funded - total_supplier_payouts - total_buyer_refunds`.

Bond accounting is separate: posted, returned, and slashed totals are tracked
independently. Settlement must not display `SETTLED` until finality and
successful execution are reconciled.

## Accounting hardening

Payout and refund exits decrement global `escrow_liability` before the external
transfer is emitted. Both paths reject underflow and share mutually exclusive
payout/refund replay guards. Payment milestones are parsed and bounded against
awarded price, and each milestone index is single-use.

Bond policy is frozen at award time through the tender policy string using the
canonical `NONE`, `FIXED:<amount>`, or `PERCENT:<0..100>` forms. Bond return and
slash are mutually exclusive and independently conserved.

## Studio-dev native refund proof

The canonical deployment refund case was funded with `1000000000000000` wei
and cancelled using the contract's own external native-GEN transfer path. The
successful parent receipt emitted exactly that amount to the frozen buyer.
Contract balance, escrow liability, and the refund accounting total reconciled
to the same gross amount. The buyer's net wallet increase was lower by the
settled protocol fee of `126308750000823` wei because the buyer submitted the
cancel transaction. The supplier signer was later confirmed available as the
unlocked `player2` account, but the controlled payout case stopped at semantic
adjudication because the frozen deployment calls missing
`gl.vm.run_nondet_unsafe`. No payout value exit occurred, so no payout or final
accounting closure is claimed.
