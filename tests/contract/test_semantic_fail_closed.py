import json

import pytest


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


def strict_vector(raw: str, fields: set[str]):
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(value, dict) or set(value) != fields or any(type(value[key]) is not bool for key in fields):
        return None
    return value


@pytest.mark.adversarial
@pytest.mark.parametrize("raw", ["{}", '{"extra":true}', "not-json", '{"requirement_satisfied":"true"}', '{"requirement_satisfied":1}'])
def test_bid_malformed_vectors_fail_closed(raw):
    assert strict_vector(raw, BID_FIELDS) is None


@pytest.mark.adversarial
@pytest.mark.parametrize("raw", ["{}", '{"extra":true}', "not-json", '{"authorized_substitution":null}', '{"quantity_conformant":0}'])
def test_delivery_malformed_vectors_fail_closed(raw):
    assert strict_vector(raw, DELIVERY_FIELDS) is None


def test_safe_transport_result_is_not_a_business_verdict():
    transport_failure = {"kind": "TIMEOUT", "canonical_verdict": None}
    assert transport_failure["canonical_verdict"] not in {"MATERIALLY_NON_COMPLIANT", "MATERIAL_DELIVERY_MISMATCH"}

