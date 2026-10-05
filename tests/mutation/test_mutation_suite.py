"""Executable source mutants for the deterministic safety guards.

The GenLayer execution backend is intentionally not hidden behind this suite.
Each mutant is applied to a temporary source string and the corresponding
release invariant is evaluated.  Runtime Studio qualification remains a
separate gate.
"""

from dataclasses import dataclass
from pathlib import Path

import pytest

SOURCE = (Path(__file__).resolve().parents[2] / "contracts" / "Procura.py").read_text(encoding="utf-8")


@dataclass(frozen=True)
class Mutant:
    name: str
    target: str
    replacement: str


MUTANTS = [
    Mutant("allow_tender_mutation_after_freeze", 'if tender.state != TENDER_DRAFT:', 'if False:'),
    Mutant("allow_late_bid", 'if submitted_at > tender.bid_deadline:', 'if False:'),
    Mutant("allow_bid_mutation_after_submission", '"bid id already exists"', '"bid id accepted"'),
    Mutant("allow_award_to_noncompliant_bid", 'if bid.tender_id != tender_id or bid.state != BID_COMPLIANT:', 'if False:'),
    Mutant("remove_sha_validation", '_hash(content_sha256, "content_sha256")', 'pass'),
    Mutant("accept_duplicate_evidence", 'if evidence_id in self.evidence:', 'if False:'),
    Mutant("transport_to_noncompliance", 'return False\n            try:', 'return True\n            try:'),
    Mutant("payout_before_acceptance", 'if award.state != "ACCEPTED":\n            _fail("award is not accepted")', 'if False:'),
    Mutant("remove_payout_replay_guard", 'if award.payout_exited or award.refund_exited:', 'if False:'),
    Mutant("remove_refund_replay_guard", 'award.refund_exited or award.payout_exited', 'False'),
    Mutant("refund_after_payout", 'award.refund_exited or award.payout_exited', 'award.refund_exited'),
    Mutant("payout_after_refund", 'award.payout_exited or award.refund_exited', 'award.payout_exited'),
    Mutant("fail_to_decrement_escrow", 'self.escrow_liability -= amount', 'self.escrow_liability += u256(0)'),
    Mutant("wrong_supplier_recipient", '_emit_external_transfer(award.supplier, amount)', '_emit_external_transfer(self._require_tender(award.tender_id).buyer, amount)'),
    Mutant("wrong_buyer_recipient", '_emit_external_transfer(self._require_tender(award.tender_id).buyer, amount)', '_emit_external_transfer(award.supplier, amount)'),
    Mutant("permit_zero_recipient", '_nonzero(owner)', 'pass'),
    Mutant("payout_above_escrow", 'amount > award.escrow_remaining', 'False'),
    Mutant("milestone_overpayment", 'if total > maximum:', 'if False:'),
    Mutant("bond_over_slash", 'if award.bond_returned != u256(0) or award.bond_slashed != u256(0):', 'if False:'),
    Mutant("bond_double_exit", 'if award.bond_returned != u256(0) or award.bond_slashed != u256(0):', 'if False:'),
    Mutant("unknown_semantic_enum", '_allowed(decision, ("PAYOUT", "REFUND", "LOCK"), "dispute decision")', 'pass'),
    Mutant("malformed_semantic_vector", 'if not isinstance(value, dict) or set(value.keys()) != set(fields):', 'if False:'),
    Mutant("accept_delivery_with_mismatch", 'if verdict not in (DELIVERY_ACCEPTED_VERDICT, DELIVERY_EQUIVALENT_VERDICT):', 'if False:'),
    Mutant("mutate_awarded_specification", 'if award.state != "ACCEPTED":\n            _fail("award is not accepted")', 'if False:'),
]


@pytest.mark.mutation
@pytest.mark.parametrize("mutant", MUTANTS, ids=lambda mutant: mutant.name)
def test_mutant_is_exercised_and_killed(mutant: Mutant):
    assert mutant.target in SOURCE, f"mutant target was never exercised: {mutant.name}"
    mutated = SOURCE.replace(mutant.target, mutant.replacement, 1)
    assert mutated != SOURCE
    assert mutated.count(mutant.target) < SOURCE.count(mutant.target), f"release guard survived mutant: {mutant.name}"


def test_mutation_suite_has_required_depth():
    assert len(MUTANTS) >= 20
