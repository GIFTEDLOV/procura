import re


HEX64 = re.compile(r"^[0-9a-f]{64}$")
VERDICTS = {
    "COMPLIANT",
    "MATERIALLY_NON_COMPLIANT",
    "EQUIVALENT_ACCEPTABLE",
    "INSUFFICIENT_EVIDENCE",
    "INCONCLUSIVE",
}


def test_evidence_hash_is_exact_lowercase_sha256():
    assert HEX64.fullmatch("a" * 64)
    assert not HEX64.fullmatch("0x" + "a" * 64)
    assert not HEX64.fullmatch("A" * 64)
    assert not HEX64.fullmatch("a" * 63)


def test_semantic_verdict_is_closed_enum():
    assert "MATERIALLY_NON_COMPLIANT" in VERDICTS
    assert "winner: supplier A" not in VERDICTS


def test_transport_failure_is_not_a_business_verdict():
    transport_failure = {"kind": "TRANSPORT_FAILURE", "business_verdict": None}
    assert transport_failure["business_verdict"] is None
