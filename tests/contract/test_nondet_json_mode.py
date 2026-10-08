import ast
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / "contracts" / "Procura.py").read_text(encoding="utf-8")
TREE = ast.parse(SOURCE)

BID_FIELDS = {
    "requirement_satisfied",
    "mandatory_requirement_breached",
    "claimed_equivalence_valid",
    "certification_requirement_met",
    "material_conflict",
    "evidence_sufficient",
}
DELIVERY_FIELDS = {
    "awarded_specification_matched",
    "authorized_substitution",
    "material_specification_difference",
    "quantity_conformant",
    "inspection_evidence_sufficient",
}


def _body(name: str) -> str:
    node = next(item for item in ast.walk(TREE) if isinstance(item, ast.FunctionDef) and item.name == name)
    return ast.get_source_segment(SOURCE, node) or ""


def _strict_transport_vector(raw, fields):
    try:
        value = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError):
        return None
    if not isinstance(value, dict) or set(value) != fields:
        return None
    if any(type(value[field]) is not bool for field in fields):
        return None
    return value


def test_both_semantic_leaders_request_native_json():
    assert _body("_semantic_bid_vector").count('response_format="json"') == 2
    assert _body("_semantic_delivery_vector").count('response_format="json"') == 2


def test_both_semantic_paths_use_default_nondet_only():
    assert SOURCE.count("gl.vm.run_nondet_default(leader_fn, validator_fn)") == 2
    assert "run_nondet_unsafe" not in SOURCE


def test_parsed_dict_is_accepted_without_relaxing_shape_validation():
    bid = {field: False for field in BID_FIELDS}
    delivery = {field: False for field in DELIVERY_FIELDS}
    assert _strict_transport_vector(bid, BID_FIELDS) == bid
    assert _strict_transport_vector(delivery, DELIVERY_FIELDS) == delivery
    assert 'json.loads(raw) if isinstance(raw, str) else raw' in _body("_parse_bid_vector")
    assert 'json.loads(raw) if isinstance(raw, str) else raw' in _body("_parse_delivery_vector")


@pytest.mark.parametrize("raw", ["{}", {"extra": True}])
def test_missing_and_extra_fields_fail_closed(raw):
    assert _strict_transport_vector(raw, BID_FIELDS) is None


def test_string_garbage_fails_closed():
    assert _strict_transport_vector("not-json", BID_FIELDS) is None


def test_wrong_boolean_type_fails_closed():
    value = {field: False for field in BID_FIELDS}
    value["evidence_sufficient"] = 1
    assert _strict_transport_vector(value, BID_FIELDS) is None


def test_unknown_delivery_field_fails_closed():
    value = {field: False for field in DELIVERY_FIELDS}
    value["unknown_enum"] = True
    assert _strict_transport_vector(value, DELIVERY_FIELDS) is None


def test_unknown_canonical_enum_is_not_accepted():
    assert "UNKNOWN" not in {
        "COMPLIANT",
        "MATERIALLY_NON_COMPLIANT",
        "EQUIVALENT_ACCEPTABLE",
        "INSUFFICIENT_EVIDENCE",
        "INCONCLUSIVE",
    }
    assert "UNKNOWN" not in {
        "DELIVERY_ACCEPTED",
        "MATERIAL_DELIVERY_MISMATCH",
        "AUTHORIZED_EQUIVALENT",
        "INSUFFICIENT_EVIDENCE",
        "INCONCLUSIVE",
    }


def test_context_and_evidence_guards_remain_in_production_paths():
    requirement = _body("adjudicate_requirement")
    delivery = _body("adjudicate_delivery")
    assert 'if bid_id not in self.bids or requirement_id not in self.requirements:' in requirement
    assert 'if delivery_id not in self.deliveries:' in delivery
    assert '_hash(evidence_snapshot_root, "evidence_snapshot_root")' in requirement
    assert '_hash(evidence_snapshot_root, "evidence_snapshot_root")' in delivery
    assert 'if vector["material_conflict"] or vector["mandatory_requirement_breached"]' in SOURCE
