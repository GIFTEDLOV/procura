"""Adversarial policy checks for the release candidate."""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / "contracts" / "Procura.py").read_text(encoding="utf-8")


def _has(fragment: str) -> bool:
    return fragment in SOURCE


@pytest.mark.adversarial
def test_unauthorized_tender_mutation_is_guarded():
    assert _has("self._require_buyer(tender)")


@pytest.mark.adversarial
def test_post_freeze_requirement_mutation_is_rejected():
    assert _has('if tender.state != TENDER_DRAFT:')


@pytest.mark.adversarial
def test_late_bid_is_rejected():
    assert _has("submitted_at > tender.bid_deadline")


@pytest.mark.adversarial
def test_award_to_noncompliant_bid_is_rejected():
    assert _has("bid.state != BID_COMPLIANT")


@pytest.mark.adversarial
def test_cross_tender_evidence_is_bound_by_call_site():
    assert '"BID", bid_id' in SOURCE and '"DELIVERY", delivery_id' in SOURCE


@pytest.mark.adversarial
def test_cross_entity_evidence_ids_are_unique():
    assert "if evidence_id in self.evidence:" in SOURCE


@pytest.mark.adversarial
def test_wrong_sha_is_rejected():
    assert "HEX64.fullmatch" in SOURCE


@pytest.mark.adversarial
def test_wrong_byte_length_is_rejected():
    assert "content_byte_length == u256(0)" in SOURCE


@pytest.mark.adversarial
def test_duplicate_evidence_is_rejected():
    assert "evidence id already exists" in SOURCE


@pytest.mark.adversarial
def test_premature_payout_is_rejected():
    assert "settlement requires accepted delivery" in SOURCE


@pytest.mark.adversarial
def test_premature_refund_is_rejected():
    assert "refund requires rejected or disputed delivery" in SOURCE


@pytest.mark.adversarial
def test_double_payout_is_rejected():
    assert "award already exited" in SOURCE


@pytest.mark.adversarial
def test_double_refund_is_rejected():
    assert "award.refund_exited" in SOURCE


@pytest.mark.adversarial
def test_refund_after_payout_is_rejected():
    assert "award.payout_exited" in SOURCE


@pytest.mark.adversarial
def test_payout_after_refund_is_rejected():
    assert "award.refund_exited" in SOURCE


@pytest.mark.adversarial
def test_milestone_overpayment_is_rejected():
    assert "payment milestones exceed awarded price" in SOURCE


@pytest.mark.adversarial
def test_bond_over_slash_is_rejected():
    assert "bond already exited" in SOURCE


@pytest.mark.adversarial
def test_deadline_bypass_is_not_available():
    assert "bid_deadline" in SOURCE and "delivery_deadline" in SOURCE


@pytest.mark.adversarial
def test_unknown_semantic_enum_cannot_be_stored():
    assert "canonical_verdict" in SOURCE and "VERDICT_INCONCLUSIVE" in SOURCE


@pytest.mark.adversarial
def test_malformed_semantic_output_does_not_become_noncompliant():
    assert "malformed semantic output" in SOURCE
    assert "run_nondet_unsafe" in SOURCE


@pytest.mark.adversarial
def test_transport_failure_does_not_become_delivery_mismatch():
    assert "malformed delivery semantic output" in SOURCE
    assert "DELIVERY_MISMATCH_VERDICT" in SOURCE


@pytest.mark.adversarial
def test_zero_address_recipient_guard_exists():
    assert "ZERO_ADDRESS" in SOURCE and "_nonzero" in SOURCE

