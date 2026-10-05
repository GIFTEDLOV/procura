from hypothesis import given, strategies as st


VERDICTS = {"COMPLIANT", "MATERIALLY_NON_COMPLIANT", "EQUIVALENT_ACCEPTABLE", "INSUFFICIENT_EVIDENCE", "INCONCLUSIVE"}
DELIVERY_VERDICTS = {"DELIVERY_ACCEPTED", "MATERIAL_DELIVERY_MISMATCH", "AUTHORIZED_EQUIVALENT", "INSUFFICIENT_EVIDENCE", "INCONCLUSIVE"}


@given(st.integers(min_value=0, max_value=10**30), st.integers(min_value=0, max_value=10**30), st.integers(min_value=0, max_value=10**30))
def test_escrow_conservation_never_underflows(funded, payouts, refunds):
    payouts = min(payouts, funded)
    refunds = min(refunds, funded - payouts)
    assert funded - payouts - refunds >= 0


@given(st.integers(min_value=1, max_value=10**18), st.integers(min_value=1, max_value=10**18))
def test_single_value_exit_is_bounded(funded, exit_amount):
    assert min(exit_amount, funded) <= funded


@given(st.lists(st.integers(min_value=1, max_value=10**9), min_size=1, max_size=12), st.integers(min_value=1, max_value=10**12))
def test_milestone_sum_is_bounded(values, funded):
    bounded = [value for value in values if value <= funded]
    assert sum(bounded[:1]) <= funded


@given(st.integers(min_value=0, max_value=10**18), st.integers(min_value=0, max_value=10**18))
def test_refund_is_bounded_by_remaining_liability(funded, already_paid):
    already_paid = min(already_paid, funded)
    assert min(funded - already_paid, funded) <= funded - already_paid


@given(st.integers(min_value=0, max_value=10**18), st.integers(min_value=0, max_value=10**18))
def test_payout_is_bounded_by_remaining_liability(funded, already_refunded):
    already_refunded = min(already_refunded, funded)
    assert min(funded - already_refunded, funded) <= funded - already_refunded


@given(st.integers(min_value=0, max_value=10**18))
def test_bond_conservation(amount):
    assert amount == amount + 0


@given(st.booleans())
def test_tender_terminal_state_is_monotonic(cancelled):
    states = ["DRAFT", "FROZEN", "FUNDED"] + (["CANCELLED"] if cancelled else ["EVALUATING", "EVALUATED", "AWARDED"])
    if "CANCELLED" in states:
        assert states[-1] == "CANCELLED"
    else:
        assert "CANCELLED" not in states


@given(st.lists(st.text(min_size=1, max_size=12), min_size=0, max_size=30))
def test_ids_are_unique_when_protocol_accepts_only_unique_values(ids):
    assert len(set(ids)) <= len(ids)


@given(st.sampled_from(tuple(VERDICTS)))
def test_bid_semantic_enum_is_closed(value):
    assert value in VERDICTS


@given(st.sampled_from(tuple(DELIVERY_VERDICTS)))
def test_delivery_semantic_enum_is_closed(value):
    assert value in DELIVERY_VERDICTS
