from hypothesis import given, strategies as st


@given(
    funded=st.integers(min_value=0, max_value=10**18),
    payout=st.integers(min_value=0, max_value=10**18),
    refund=st.integers(min_value=0, max_value=10**18),
)
def test_liability_conservation_is_never_negative(funded, payout, refund):
    payout = min(payout, funded)
    refund = min(refund, funded - payout)
    assert funded - payout - refund >= 0


@given(st.lists(st.sampled_from(["COMPLIANT", "MATERIALLY_NON_COMPLIANT", "EQUIVALENT_ACCEPTABLE", "INSUFFICIENT_EVIDENCE", "INCONCLUSIVE"]), min_size=1, max_size=20))
def test_all_generated_semantic_results_are_canonical(values):
    allowed = {"COMPLIANT", "MATERIALLY_NON_COMPLIANT", "EQUIVALENT_ACCEPTABLE", "INSUFFICIENT_EVIDENCE", "INCONCLUSIVE"}
    assert set(values) <= allowed
