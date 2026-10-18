"""Stable-GenVM qualification tests for the Studionet Procura V2.1.2 candidate.

The positive artifact is the byte-for-byte pinned package manifest from the
official GenLayer Labs repository. The contradictory record is the actual
published registry metadata for genlayer-js@0.3.0. Web responses are mocked at
the GenVM boundary so contract hashing, deterministic objective checks, state
transitions, and validator callbacks execute unchanged.
"""

from __future__ import annotations

import hashlib
from importlib.metadata import PackageNotFoundError, version
import json
import re
import sys
from pathlib import Path

import pytest


SOURCE = "contracts/Procura.py"
ARTIFACT_PATH = Path("evidence/qualification/fixtures/genlayer-js-1b7f50a3-package.json")
ARTIFACT_URL = "https://raw.githubusercontent.com/genlayerlabs/genlayer-js/1b7f50a3a3f2963ea857941b0fb386081dd5c326/package.json"
ARTIFACT_BYTES = ARTIFACT_PATH.read_bytes()
ARTIFACT_SHA256 = "0695982b068f8043a21b6d3ccfc10b5cb7aa5e945186a1e10fbe6f7113dd48cf"
ARTIFACT_PUBLISHED_AT = "2026-06-10T14:45:30.000Z"
CONTRADICTORY_ARTIFACT_PATH = Path("evidence/qualification/fixtures/genlayer-js-0.3.0-npm.json")
CONTRADICTORY_ARTIFACT_URL = "https://registry.npmjs.org/genlayer-js/0.3.0"
CONTRADICTORY_ARTIFACT_BYTES = CONTRADICTORY_ARTIFACT_PATH.read_bytes()
CONTRADICTORY_ARTIFACT_SHA256 = "5751f3e2cb4cd436a683489456470e434e2fd141f03f7d937a05e2cf4ea0dae8"
CONTRADICTORY_ARTIFACT_PUBLISHED_AT = "2024-10-25T16:24:27.588Z"
POLICY_SHA256 = hashlib.sha256(b"PROCURA V2.1 qualification policy").hexdigest()
AWARD_SHA256 = hashlib.sha256(b"PROCURA V2.1 qualification award").hexdigest()

TENDER_ID = "PROCURA-V21-QUALIFICATION"
REQUIREMENT_ID = f"{TENDER_ID}:REQ-1"
BID_ID = f"{TENDER_ID}:BID-1"
AWARD_ID = f"{TENDER_ID}:AWARD-1"
DELIVERY_ID = f"{TENDER_ID}:DELIVERY-1"
ESCROW = 100_000_000_000_000
SPECIFICATION = "Pinned official genlayer-js package.json manifest at commit 1b7f50a3a3f2963ea857941b0fb386081dd5c326"

try:
    _GENLAYER_TEST_VERSION = version("genlayer-test")
except PackageNotFoundError:
    _GENLAYER_TEST_VERSION = "unavailable"

pytestmark = [
    pytest.mark.skipif(
        sys.platform == "win32",
        reason="Stable GenVM qualification must run in the supported Linux/WSL harness.",
    ),
    pytest.mark.skipif(
        _GENLAYER_TEST_VERSION == "0.30.0rc2",
        reason=(
            "genlayer-test 0.30.0rc2 direct mode only imports the v0.3 calldata/storage API; "
            "it cannot execute this v0.6 contract. The full qualification is verified LIVE."
        ),
    ),
]

BID_RAW = json.dumps(
    {
        "requirement_satisfied": True,
        "mandatory_requirement_breached": False,
        "claimed_equivalence_valid": False,
        "certification_requirement_met": True,
        "material_conflict": False,
        "evidence_sufficient": True,
    }
)
BID_FENCED = f"```json\n{BID_RAW}\n```"
DELIVERY_RAW = json.dumps(
    {
        "awarded_specification_matched": True,
        "authorized_substitution": False,
        "material_specification_difference": False,
        "quantity_conformant": True,
        "inspection_evidence_sufficient": True,
    }
)


def _clock(value: str) -> None:
    import genlayer.gl as gl

    raw = getattr(gl, "message_raw", None)
    if isinstance(raw, dict):
        raw["datetime"] = value


def _mock_bid(direct_vm, output: str | None = None, url: str = ARTIFACT_URL, body: bytes = ARTIFACT_BYTES) -> None:
    direct_vm.mock_web(
        re.escape(url),
        {"method": "GET", "status": 200, "body": body},
    )
    if output is not None:
        direct_vm.mock_llm(r"bounded procurement evidence adjudicator", output)


def _mock_delivery(direct_vm, output: str = DELIVERY_RAW) -> None:
    direct_vm.mock_web(
        re.escape(ARTIFACT_URL),
        {"method": "GET", "status": 200, "body": ARTIFACT_BYTES},
    )
    direct_vm.mock_llm(r"bounded procurement inspection adjudicator", output)


def _prepare_bid(
    direct_vm,
    direct_deploy,
    buyer,
    supplier,
    response_value="1",
    evidence_url=ARTIFACT_URL,
    evidence_bytes=ARTIFACT_BYTES,
    evidence_sha256=ARTIFACT_SHA256,
    evidence_published_at=ARTIFACT_PUBLISHED_AT,
):
    direct_vm.warp("2026-10-20T00:00:00Z")
    contract = direct_deploy(SOURCE)
    direct_vm.sender = buyer
    _clock("2026-10-20T00:00:00Z")
    contract.create_tender(
        TENDER_ID,
        "Procura reviewer qualification",
        "Clearly labelled qualification using a pinned official public package manifest",
        "QUALIFICATION",
        "GEN",
        ESCROW,
        "2026-10-21T00:00:00Z",
        "2026-10-22T00:00:00Z",
        "2026-10-23T00:00:00Z",
        "strict",
        "objective",
        "FULL",
        "NONE",
        POLICY_SHA256,
    )
    contract.add_requirement(
        TENDER_ID,
        REQUIREMENT_ID,
        "Stable official SDK release",
        "The pinned official genlayer-js package.json identifies the package and has a stable SemVer major version of at least 1",
        "OBJECTIVE",
        True,
        ">=",
        "1",
        "semver_major:genlayer-js",
        False,
        True,
        "Does the authenticated official package.json identify genlayer-js, report a non-prerelease major >= 1, and agree with the supplier's major-version claim?",
        "HIGH",
    )
    contract.freeze_tender(TENDER_ID)
    direct_vm.value = ESCROW
    contract.fund_tender(TENDER_ID)
    direct_vm.value = 0

    direct_vm.sender = supplier
    _clock("2026-10-20T00:01:00Z")
    contract.submit_bid(
        BID_ID,
        TENDER_ID,
        ESCROW,
        "GEN",
        SPECIFICATION,
        json.dumps({REQUIREMENT_ID: response_value}),
        "2026-10-20T00:01:00Z",
        evidence_sha256,
    )
    contract.add_bid_evidence(
        BID_ID,
        f"{BID_ID}:EVIDENCE-1",
        "Pinned package.json from the official GenLayer Labs genlayer-js GitHub repository",
        evidence_url,
        evidence_sha256,
        len(evidence_bytes),
        "2026-10-20T00:01:00Z",
        evidence_published_at,
        "OFFICIAL_PACKAGE_MANIFEST",
    )

    direct_vm.sender = buyer
    _clock("2026-10-20T00:02:00Z")
    contract.begin_bid_evaluation(TENDER_ID)
    return contract


def _adjudicate_and_award(contract, direct_vm, buyer, supplier) -> None:
    direct_vm.sender = buyer
    _mock_bid(direct_vm)
    contract.adjudicate_requirement(BID_ID, REQUIREMENT_ID, ARTIFACT_SHA256)

    direct_vm.clear_mocks()
    _mock_bid(direct_vm)
    assert direct_vm.run_validator() is True
    assert contract.get_adjudication(BID_ID, REQUIREMENT_ID).canonical_verdict == "COMPLIANT"

    contract.finalize_bid_evaluation(TENDER_ID)
    contract.award_bid(
        TENDER_ID,
        AWARD_ID,
        BID_ID,
        SPECIFICATION,
        "1",
        "2026-10-23T00:00:00Z",
        AWARD_SHA256,
    )
    direct_vm.sender = supplier
    contract.accept_award(AWARD_ID)


def test_authoritative_artifact_identity_is_exact() -> None:
    assert len(ARTIFACT_BYTES) == 2144
    assert hashlib.sha256(ARTIFACT_BYTES).hexdigest() == ARTIFACT_SHA256
    manifest = json.loads(ARTIFACT_BYTES)
    assert manifest["name"] == "genlayer-js"
    assert manifest["version"] == "1.1.8"
    assert manifest["repository"]["url"] == "git+https://github.com/genlayerlabs/genlayer-js.git"
    assert len(CONTRADICTORY_ARTIFACT_BYTES) == 2254
    assert hashlib.sha256(CONTRADICTORY_ARTIFACT_BYTES).hexdigest() == CONTRADICTORY_ARTIFACT_SHA256
    contradictory = json.loads(CONTRADICTORY_ARTIFACT_BYTES)
    assert contradictory["name"] == "genlayer-js"
    assert contradictory["version"] == "0.3.0"


def test_full_qualification_reaches_delivery_evidence_with_canonical_readback(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.strict_mocks = True
    contract = _prepare_bid(direct_vm, direct_deploy, direct_alice, direct_bob)
    _adjudicate_and_award(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_bob
    _clock("2026-10-20T12:00:00Z")
    contract.create_delivery(
        DELIVERY_ID,
        AWARD_ID,
        "QUALIFICATION-GRN-1",
        SPECIFICATION,
        1,
        "PINNED-COMMIT-1B7F50A3",
        "2026-10-20T12:00:00Z",
    )
    contract.add_delivery_evidence(
        DELIVERY_ID,
        f"{DELIVERY_ID}:EVIDENCE-1",
        "Pinned package.json from the official GenLayer Labs genlayer-js GitHub repository",
        ARTIFACT_URL,
        ARTIFACT_SHA256,
        len(ARTIFACT_BYTES),
        "2026-10-20T12:00:00Z",
        ARTIFACT_PUBLISHED_AT,
        "OFFICIAL_PACKAGE_MANIFEST",
    )

    assert contract.get_tender(TENDER_ID).state == "AWARDED"
    bids = contract.get_bids(TENDER_ID)
    assert len(bids) == 1
    assert bids[0].bid_id == BID_ID
    assert bids[0].state == "AWARDED"
    assert contract.get_delivery(DELIVERY_ID).state == "DELIVERED"
    evidence = contract.get_evidence("DELIVERY", DELIVERY_ID)
    assert len(evidence) == 1
    assert evidence[0].content_sha256 == ARTIFACT_SHA256
    assert evidence[0].content_byte_length == 2144
    assert contract.get_accounting()["escrow_liability"] == ESCROW


def test_evidence_bytes_and_snapshot_root_are_enforced(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.strict_mocks = True
    contract = _prepare_bid(direct_vm, direct_deploy, direct_alice, direct_bob)

    with pytest.raises(Exception, match="does not match stored evidence"):
        contract.adjudicate_requirement(BID_ID, REQUIREMENT_ID, "f" * 64)

    direct_vm.mock_web(
        re.escape(ARTIFACT_URL),
        {"method": "GET", "status": 200, "body": b"unsupported bytes"},
    )
    with pytest.raises(Exception, match="evidence byte length mismatch"):
        contract.adjudicate_requirement(BID_ID, REQUIREMENT_ID, ARTIFACT_SHA256)


def test_evidence_source_must_be_successful_http_response(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = _prepare_bid(direct_vm, direct_deploy, direct_alice, direct_bob)
    direct_vm.mock_web(
        re.escape(ARTIFACT_URL),
        {"method": "GET", "status": 404, "body": ARTIFACT_BYTES},
    )
    with pytest.raises(Exception, match="evidence source must return HTTP 200"):
        contract.adjudicate_requirement(BID_ID, REQUIREMENT_ID, ARTIFACT_SHA256)


def test_authenticated_contradictory_evidence_rejects_supplier_claim(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.strict_mocks = True
    contract = _prepare_bid(
        direct_vm,
        direct_deploy,
        direct_alice,
        direct_bob,
        evidence_url=CONTRADICTORY_ARTIFACT_URL,
        evidence_bytes=CONTRADICTORY_ARTIFACT_BYTES,
        evidence_sha256=CONTRADICTORY_ARTIFACT_SHA256,
        evidence_published_at=CONTRADICTORY_ARTIFACT_PUBLISHED_AT,
    )
    _mock_bid(
        direct_vm,
        url=CONTRADICTORY_ARTIFACT_URL,
        body=CONTRADICTORY_ARTIFACT_BYTES,
    )
    contract.adjudicate_requirement(BID_ID, REQUIREMENT_ID, CONTRADICTORY_ARTIFACT_SHA256)

    direct_vm.clear_mocks()
    _mock_bid(
        direct_vm,
        url=CONTRADICTORY_ARTIFACT_URL,
        body=CONTRADICTORY_ARTIFACT_BYTES,
    )
    assert direct_vm.run_validator() is True
    adjudication = contract.get_adjudication(BID_ID, REQUIREMENT_ID)
    assert adjudication.requirement_satisfied is False
    assert adjudication.mandatory_requirement_breached is True
    assert adjudication.material_conflict is True
    assert adjudication.canonical_verdict == "MATERIALLY_NON_COMPLIANT"

    direct_vm.sender = direct_alice
    contract.finalize_bid_evaluation(TENDER_ID)
    assert contract.get_bids(TENDER_ID)[0].state == "NON_COMPLIANT"
    with pytest.raises(Exception, match="winner must be compliant"):
        contract.award_bid(
            TENDER_ID,
            AWARD_ID,
            BID_ID,
            SPECIFICATION,
            "1",
            "2026-10-23T00:00:00Z",
            AWARD_SHA256,
        )


def test_independent_validator_rejects_contradictory_conclusion(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.strict_mocks = True
    contract = _prepare_bid(direct_vm, direct_deploy, direct_alice, direct_bob)
    _mock_bid(direct_vm)
    contract.adjudicate_requirement(BID_ID, REQUIREMENT_ID, ARTIFACT_SHA256)

    direct_vm.clear_mocks()
    _mock_bid(
        direct_vm,
        url=ARTIFACT_URL,
        body=CONTRADICTORY_ARTIFACT_BYTES,
    )
    assert direct_vm.run_validator() is False


def test_independent_validator_rejects_a_forged_leader_claim(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.strict_mocks = True
    contract = _prepare_bid(direct_vm, direct_deploy, direct_alice, direct_bob)
    _mock_bid(direct_vm)
    contract.adjudicate_requirement(BID_ID, REQUIREMENT_ID, ARTIFACT_SHA256)

    direct_vm.clear_mocks()
    _mock_bid(direct_vm)
    forged_leader_payload = {
        "vector": {
            "requirement_satisfied": False,
            "mandatory_requirement_breached": True,
            "claimed_equivalence_valid": False,
            "certification_requirement_met": True,
            "material_conflict": True,
            "evidence_sufficient": True,
        },
        "objective_result": False,
        "objective_conflict": True,
    }
    assert direct_vm.run_validator(leader_result=forged_leader_payload) is False


def test_independent_validator_rejects_material_delivery_finding_disagreement(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    direct_vm.strict_mocks = True
    contract = _prepare_bid(direct_vm, direct_deploy, direct_alice, direct_bob)
    _adjudicate_and_award(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_bob
    _clock("2026-10-20T12:00:00Z")
    contract.create_delivery(
        DELIVERY_ID,
        AWARD_ID,
        "QUALIFICATION-GRN-1",
        SPECIFICATION,
        1,
        "GENLAYER-JS-COMMIT-1B7F50A3",
        "2026-10-20T12:00:00Z",
    )
    contract.add_delivery_evidence(
        DELIVERY_ID,
        f"{DELIVERY_ID}:EVIDENCE-1",
        "Pinned package.json from the official GenLayer Labs genlayer-js GitHub repository",
        ARTIFACT_URL,
        ARTIFACT_SHA256,
        len(ARTIFACT_BYTES),
        "2026-10-20T12:00:00Z",
        ARTIFACT_PUBLISHED_AT,
        "OFFICIAL_PACKAGE_MANIFEST",
    )
    direct_vm.sender = direct_alice
    contract.begin_inspection(DELIVERY_ID)

    _mock_delivery(direct_vm, DELIVERY_RAW)
    contract.adjudicate_delivery(DELIVERY_ID, ARTIFACT_SHA256)

    direct_vm.clear_mocks()
    dissenting_vector = json.loads(DELIVERY_RAW)
    dissenting_vector["quantity_conformant"] = False
    _mock_delivery(direct_vm, json.dumps(dissenting_vector))
    assert direct_vm.run_validator() is False


def test_duplicate_and_unauthorized_lifecycle_actions_are_rejected(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = _prepare_bid(direct_vm, direct_deploy, direct_alice, direct_bob)

    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="buyer permission required"):
        contract.finalize_bid_evaluation(TENDER_ID)

    direct_vm.sender = direct_alice
    with pytest.raises(Exception, match="bidding is closed"):
        contract.submit_bid(
            "DUPLICATE-BID",
            TENDER_ID,
            1,
            "GEN",
            SPECIFICATION,
            json.dumps({REQUIREMENT_ID: "1"}),
            "2026-10-20T00:03:00Z",
            ARTIFACT_SHA256,
        )


def test_semantic_parsers_accept_supported_forms_and_reject_malformed_output(
    direct_deploy,
):
    contract = direct_deploy(SOURCE)
    assert contract._parse_bid_vector(BID_RAW)["requirement_satisfied"] is True
    assert contract._parse_bid_vector(BID_FENCED)["evidence_sufficient"] is True
    assert contract._parse_bid_vector(json.loads(BID_RAW))["evidence_sufficient"] is True
    reordered = json.dumps(dict(reversed(list(json.loads(BID_RAW).items()))), separators=(",", ":"))
    assert contract._parse_bid_vector(reordered) == json.loads(BID_RAW)
    assert contract._parse_delivery_vector(DELIVERY_RAW)["quantity_conformant"] is True
    assert contract._parse_delivery_vector(json.loads(DELIVERY_RAW))["quantity_conformant"] is True
    with pytest.raises(Exception, match="malformed semantic output"):
        contract._parse_bid_vector("not-json")
    with pytest.raises(Exception, match="malformed semantic output"):
        contract._parse_bid_vector(f"prefix {BID_FENCED}")


def test_protocol_info_reports_qualification_pending_without_false_deployment_claim(
    direct_deploy,
):
    contract = direct_deploy(SOURCE)
    assert contract.get_protocol_info()["qualification_status"] == "QUALIFICATION_PENDING"
