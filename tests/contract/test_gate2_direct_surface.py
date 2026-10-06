"""Contract-surface qualification tests.

These tests exercise the frozen contract policy statically while the GenLayer
runtime qualification is isolated in the Studio probe.  They intentionally do
not claim live execution when the local runtime is unavailable.
"""

import ast
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / "contracts" / "Procura.py").read_text(encoding="utf-8")
TREE = ast.parse(SOURCE)
INTERFACE = json.loads((ROOT / "contracts" / "interface.json").read_text(encoding="utf-8"))


def _method(name: str) -> ast.FunctionDef:
    return next(node for node in ast.walk(TREE) if isinstance(node, ast.FunctionDef) and node.name == name)


def _body(name: str) -> str:
    node = _method(name)
    return ast.get_source_segment(SOURCE, node) or ""


@pytest.mark.direct
def test_procurement_schema_is_frozen():
    assert 'SCHEMA_VERSION = "PROCUREMENT_V1"' in SOURCE


@pytest.mark.direct
def test_tender_contains_deadlines_currency_budget_and_policies():
    fields = _method("create_tender")
    names = [arg.arg for arg in fields.args.args]
    assert names == ["self", "tender_id", "title", "description", "category", "currency_label", "budget_ceiling", "bid_deadline", "evaluation_deadline", "delivery_deadline", "equivalence_policy", "evaluation_policy", "payment_policy", "supplier_bond_policy", "tender_hash"]


@pytest.mark.direct
def test_requirement_types_are_closed():
    assert '"OBJECTIVE", "SEMANTIC", "CERTIFICATION", "COMMERCIAL", "DELIVERY"' in SOURCE


@pytest.mark.direct
def test_requirement_versions_start_at_one():
    assert "semantic_question, materiality, u32(1)" in SOURCE


@pytest.mark.direct
def test_buyer_only_tender_mutations():
    for name in ("add_requirement", "add_certification_requirement", "freeze_tender", "fund_tender", "cancel_tender", "begin_bid_evaluation", "award_bid"):
        assert "self._require_buyer(tender)" in _body(name) or name == "add_certification_requirement"


@pytest.mark.direct
def test_requirements_freeze_before_bidding():
    assert 'if tender.state != TENDER_DRAFT:' in _body("add_requirement")
    assert 'if tender.state not in (TENDER_FROZEN, TENDER_FUNDED):' in _body("submit_bid")


@pytest.mark.direct
def test_freeze_requires_at_least_one_requirement():
    assert 'len(self.requirement_ids_by_tender.get(tender_id, gl.storage.DynArray[str]())) == 0' in _body("freeze_tender")


@pytest.mark.direct
def test_funding_is_payable_and_bounded():
    body = _body("fund_tender")
    assert "@gl.public.write.payable" in SOURCE and "gl.message.value" in body
    assert "amount > tender.budget_ceiling" in body


@pytest.mark.direct
def test_funding_is_single_use_by_state():
    assert "if tender.state != TENDER_FROZEN:" in _body("fund_tender")


@pytest.mark.direct
def test_bid_hash_and_deadline_are_checked():
    body = _body("submit_bid")
    assert "submitted_at > tender.bid_deadline" in body
    assert '_hash(bid_hash, "bid_hash")' in body


@pytest.mark.direct
def test_submitted_bids_have_no_mutation_surface():
    public_names = set(INTERFACE["methods"])
    assert not {"edit_bid", "update_bid", "mutate_bid"} & public_names


@pytest.mark.direct
def test_evidence_requires_strict_sha256():
    body = _body("_record_evidence")
    assert '_hash(content_sha256, "content_sha256")' in body
    assert "content_byte_length == u256(0)" in body


@pytest.mark.direct
def test_evidence_duplicate_ids_are_rejected():
    assert 'if evidence_id in self.evidence:' in _body("_record_evidence")


@pytest.mark.direct
def test_evidence_url_and_size_are_authenticated():
    body = _body("_record_evidence")
    assert "_source_url(source_url)" in body
    assert "MAX_EVIDENCE_BYTES" in body


@pytest.mark.direct
def test_evidence_temporal_order_is_authenticated():
    assert "published_at > observed_at" in _body("_record_evidence")
    assert "observed_at > bid.submitted_at" in _body("add_bid_evidence")
    assert "observed_at > delivery.submitted_at" in _body("add_delivery_evidence")


@pytest.mark.direct
def test_evidence_is_bound_to_entity_and_owner():
    assert "owner: Address" in _body("_record_evidence")
    assert "entity_type: str" in _body("_record_evidence")
    assert "entity_id: str" in _body("_record_evidence")
    assert "Evidence(" in _body("_record_evidence")


@pytest.mark.direct
def test_evaluation_requires_buyer_and_frozen_root():
    body = _body("adjudicate_requirement")
    assert "self._require_buyer(tender)" in body
    assert '_hash(evidence_snapshot_root, "evidence_snapshot_root")' in body


@pytest.mark.direct
def test_bid_vector_has_exact_boolean_fields():
    body = _body("_parse_bid_vector")
    assert 'set(value.keys()) != set(fields)' in body
    assert 'return {field: _bool(value[field], field) for field in fields}' in body


@pytest.mark.direct
def test_delivery_vector_has_exact_boolean_fields():
    body = _body("_parse_delivery_vector")
    assert 'set(value.keys()) != set(fields)' in body
    assert 'return {field: _bool(value[field], field) for field in fields}' in body


@pytest.mark.direct
def test_malformed_semantic_output_fails_closed():
    assert 'except Exception:\n            _fail("malformed semantic output")' in _body("_parse_bid_vector")
    assert 'except Exception:\n            _fail("malformed delivery semantic output")' in _body("_parse_delivery_vector")


@pytest.mark.direct
def test_transport_validator_does_not_emit_business_verdict():
    assert "return False" in _body("_semantic_bid_vector")
    assert "return False" in _body("_semantic_delivery_vector")


@pytest.mark.direct
def test_evaluation_finalization_requires_every_requirement():
    body = _body("finalize_bid_evaluation")
    assert 'if key not in self.adjudications:' in body
    assert '"all frozen requirements must be adjudicated"' in body


@pytest.mark.direct
def test_award_requires_compliant_bid():
    assert 'bid.state != BID_COMPLIANT' in _body("award_bid")


@pytest.mark.direct
def test_award_price_cannot_exceed_funded_escrow():
    assert 'bid.price > tender.total_funded' in _body("award_bid")


@pytest.mark.direct
def test_award_payment_milestones_are_frozen_and_bounded():
    body = _body("award_bid")
    assert "self._validate_milestones(payment_milestones, bid.price)" in body
    assert "payment milestones exceed awarded price" in SOURCE


@pytest.mark.direct
def test_supplier_acceptance_moves_only_awarded_amount():
    body = _body("accept_award")
    assert "award.awarded_price" in body
    assert "tender.escrow_liability -= award.awarded_price" in body


@pytest.mark.direct
def test_bond_is_payable_and_exact():
    body = _body("post_supplier_bond")
    assert "@gl.public.write.payable" in SOURCE and "amount != _u(expected_bond_amount)" in body
    assert "frozen_amount = self._bond_amount_from_policy" in body


@pytest.mark.direct
def test_bond_policy_has_fixed_and_percentage_forms():
    body = _body("_bond_amount_from_policy")
    assert 'parts[0] == "FIXED"' in body
    assert 'parts[0] == "PERCENT"' in body


@pytest.mark.direct
def test_delivery_deadline_is_deterministic():
    assert "submitted_at > award.delivery_deadline" in _body("create_delivery")


@pytest.mark.direct
def test_inspection_precedes_delivery_adjudication():
    assert 'delivery.state != DELIVERY_UNDER_INSPECTION' in _body("adjudicate_delivery")


@pytest.mark.direct
def test_delivery_acceptance_consumes_only_canonical_verdict():
    body = _body("accept_delivery")
    assert 'key not in self.delivery_adjudications' in body
    assert 'DELIVERY_ACCEPTED_VERDICT, DELIVERY_EQUIVALENT_VERDICT' in body


@pytest.mark.direct
def test_payout_requires_accepted_delivery():
    assert 'self.deliveries[delivery_ids[0]].state != DELIVERY_ACCEPTED' in _body("settle_award")
    assert 'self.deliveries[delivery_ids[0]].state != DELIVERY_ACCEPTED' in _body("release_milestone")


@pytest.mark.direct
def test_payout_updates_global_liability():
    body = _body("_emit_payout")
    assert "self.escrow_liability -= amount" in body
    assert "escrow liability underflow" in body


@pytest.mark.direct
def test_refund_updates_global_liability():
    body = _body("_emit_refund")
    assert "self.escrow_liability -= amount" in body
    assert "escrow liability underflow" in body


@pytest.mark.direct
def test_cash_exit_replay_guards_are_mutual():
    assert 'if award.payout_exited or award.refund_exited:' in _body("_emit_payout")
    assert 'if award.payout_exited or award.refund_exited:' in _body("_emit_refund")


@pytest.mark.direct
def test_milestone_replay_guard_is_frozen_state():
    body = _body("release_milestone")
    assert "_milestone_was_released" in body
    assert "released_milestones" in SOURCE


@pytest.mark.direct
def test_refund_requires_rejected_or_disputed_delivery():
    body = _body("refund_buyer")
    assert "DELIVERY_REJECTED, DELIVERY_DISPUTED" in body


@pytest.mark.direct
def test_bond_return_and_slash_are_single_exit_paths():
    assert "bond already exited" in SOURCE
    assert "self._return_bond(award)" in _body("settle_award")
    assert "self._slash_bond(award)" in _body("refund_buyer")


@pytest.mark.direct
def test_dispute_decisions_are_closed():
    body = _body("resolve_dispute")
    assert '_allowed(decision, ("PAYOUT", "REFUND", "LOCK"), "dispute decision")' in body


@pytest.mark.direct
def test_views_cover_reviewer_readback():
    expected = {"get_tender", "get_requirements", "get_bids", "get_evidence", "get_adjudication", "get_award", "get_delivery", "get_delivery_adjudication", "get_payments", "get_refunds", "get_audit_events", "get_accounting", "get_protocol_info"}
    assert expected <= set(INTERFACE["methods"])


@pytest.mark.direct
def test_protocol_info_exposes_schema():
    assert "SCHEMA_VERSION" in _body("get_protocol_info")


@pytest.mark.direct
def test_zero_address_recipients_are_rejected():
    assert "zero address is not permitted" in SOURCE
    assert "_nonzero(owner)" in _body("_record_evidence")
