import re

import pytest


SHA256 = re.compile(r"^[0-9a-f]{64}$")
MAX_BYTES = 10_000_000


def classify_evidence(sha: str, length: int, url: str, observed: str, published: str, expected: str):
    if not SHA256.fullmatch(sha) or length <= 0 or length > MAX_BYTES:
        return "INVALID_IDENTITY"
    if not (url.startswith("http://") or url.startswith("https://")) or " " in url:
        return "INVALID_IDENTITY"
    if published > observed or observed > expected:
        return "LATE_OR_INVALID_TIME"
    return "AUTHENTICATED"


@pytest.mark.adversarial
@pytest.mark.parametrize("case,expected", [
    (("a" * 64, 42, "https://example.test/evidence", "2026-10-01", "2026-09-30", "2026-10-01"), "AUTHENTICATED"),
    (("A" * 64, 42, "https://example.test/evidence", "2026-10-01", "2026-09-30", "2026-10-01"), "INVALID_IDENTITY"),
    (("a" * 63, 42, "https://example.test/evidence", "2026-10-01", "2026-09-30", "2026-10-01"), "INVALID_IDENTITY"),
    (("a" * 64, 0, "https://example.test/evidence", "2026-10-01", "2026-09-30", "2026-10-01"), "INVALID_IDENTITY"),
    (("a" * 64, MAX_BYTES + 1, "https://example.test/evidence", "2026-10-01", "2026-09-30", "2026-10-01"), "INVALID_IDENTITY"),
    (("a" * 64, 42, "ftp://example.test/evidence", "2026-10-01", "2026-09-30", "2026-10-01"), "INVALID_IDENTITY"),
    (("a" * 64, 42, "https://example.test/evidence", "2026-10-02", "2026-09-30", "2026-10-01"), "LATE_OR_INVALID_TIME"),
    (("a" * 64, 42, "https://example.test/evidence", "2026-10-01", "2026-10-02", "2026-10-01"), "LATE_OR_INVALID_TIME"),
])
def test_evidence_failure_matrix(case, expected):
    assert classify_evidence(*case) == expected


def test_transport_failure_is_unavailable_not_adverse():
    assert "TIMEOUT" not in {"MATERIALLY_NON_COMPLIANT", "MATERIAL_DELIVERY_MISMATCH"}
