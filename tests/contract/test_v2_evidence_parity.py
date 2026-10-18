from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "contracts" / "Procura.py"
SCHEMA = ROOT / "contracts" / "schema.v2.evidence.json"
ABI = ROOT / "contracts" / "abi.v2.evidence.json"
INTERFACE = ROOT / "contracts" / "interface.v2.evidence.json"
MANIFEST = ROOT / "evidence" / "release-provenance.json"
ARTIFACT = ROOT / "evidence" / "qualification" / "fixtures" / "genlayer-js-1b7f50a3-package.json"
CONTRADICTORY_ARTIFACT = ROOT / "evidence" / "qualification" / "fixtures" / "genlayer-js-0.3.0-npm.json"
LIVE_RUNNER = ROOT / "scripts" / "qualification" / "studionet_evidence_qualification.mjs"

REQUIRED = {
    "create_tender": (
        [
            "tender_id", "title", "description", "category", "currency_label",
            "budget_ceiling", "bid_deadline", "evaluation_deadline", "delivery_deadline",
            "equivalence_policy", "evaluation_policy", "payment_policy",
            "supplier_bond_policy", "tender_hash",
        ],
        ["str", "str", "str", "str", "str", "u256", "str", "str", "str", "str", "str", "str", "str", "str"],
    ),
    "submit_bid": (
        ["bid_id", "tender_id", "price", "currency", "delivery_commitment", "requirement_responses", "submitted_at", "bid_hash"],
        ["str", "str", "u256", "str", "str", "str", "str", "str"],
    ),
    "create_delivery": (
        ["delivery_id", "award_id", "delivery_reference", "delivered_items", "quantity", "serial_identifiers", "submitted_at"],
        ["str", "str", "str", "str", "u256", "str", "str"],
    ),
    "add_bid_evidence": (
        ["bid_id", "evidence_id", "authority", "source_url", "content_sha256", "content_byte_length", "observed_at", "published_at", "evidence_type"],
        ["str", "str", "str", "str", "str", "u256", "str", "str", "str"],
    ),
    "add_delivery_evidence": (
        ["delivery_id", "evidence_id", "authority", "source_url", "content_sha256", "content_byte_length", "observed_at", "published_at", "evidence_type"],
        ["str", "str", "str", "str", "str", "u256", "str", "str", "str"],
    ),
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_all_five_required_methods_match_source_schema_abi_and_interface() -> None:
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    contract = next(
        node for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == "ProcuraV2Evidence"
    )
    functions = {node.name: node for node in contract.body if isinstance(node, ast.FunctionDef)}
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    abi = json.loads(ABI.read_text(encoding="utf-8"))
    interface = json.loads(INTERFACE.read_text(encoding="utf-8"))
    schema_methods = {method["name"]: method for method in schema["methods"]}
    abi_methods = {method["name"]: method for method in abi["methods"]}

    for name, (arguments, argument_types) in REQUIRED.items():
        node = functions[name]
        assert [argument.arg for argument in node.args.args[1:]] == arguments
        assert [ast.unparse(argument.annotation) for argument in node.args.args[1:]] == argument_types
        for methods in (schema_methods, abi_methods):
            assert methods[name]["kind"] == "write"
            assert methods[name]["payable"] is False
            assert methods[name]["arguments"] == arguments
            assert methods[name]["argumentTypes"] == argument_types
        assert name in interface["methods"]


def test_deployed_source_schema_abi_and_interface_are_hash_bound() -> None:
    source_hash = sha256(SOURCE)
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    abi = json.loads(ABI.read_text(encoding="utf-8"))
    interface = json.loads(INTERFACE.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    assert schema["candidateSourceSha256"] == source_hash
    assert manifest["contractSha256"] == source_hash
    assert schema["candidateSourceSha256"] == source_hash
    assert abi["candidateSourceSha256"] == source_hash
    assert interface["candidateSourceSha256"] == source_hash
    assert manifest["schemaSha256"] == sha256(SCHEMA)
    assert manifest["abiSha256"] == sha256(ABI)
    assert manifest["interfaceSha256"] == sha256(INTERFACE)
    assert manifest["broadcastAllowed"] is False
    assert manifest["qualification"]["status"] == "PASS"
    assert manifest["deployment"]["canonicalContract"] == "0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929"


def test_candidate_authenticates_authoritative_evidence_inside_consensus() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    assert 'gl.nondet.web.get(' in text
    assert 'gl.nondet.web.request(' not in text
    assert "hashlib.sha256(body).hexdigest()" in text
    assert "evidence byte length mismatch" in text
    assert "evidence content hash mismatch" in text
    assert "if response_status != 200:" in text
    assert "evidence_snapshot_root does not match stored evidence" in text
    assert "run_nondet_unsafe" in text
    assert "return leader == independent" not in text
    assert "_semver_major_from_evidence" in text
    assert "_semver_bid_result" in text
    assert 'response_format="json"' in text
    assert "_bid_material_findings_agree" in text
    assert "_delivery_material_findings_agree" in text
    assert "objective_conflict" in text
    tree = ast.parse(text)
    contract = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "ProcuraV2Evidence")
    methods = {node.name: node for node in contract.body if isinstance(node, ast.FunctionDef)}
    for method_name in ("_semantic_bid_vector", "_semantic_delivery_vector"):
        method = methods[method_name]
        callbacks = [node for node in ast.walk(method) if isinstance(node, ast.FunctionDef) and node.name in {"evaluate", "leader_fn", "validator_fn"}]
        assert {node.name for node in callbacks} == {"leader_fn", "validator_fn"}
        for callback in callbacks:
            captured = {node.id for node in ast.walk(callback) if isinstance(node, ast.Name)}
            assert not captured.intersection({"self", "bid", "requirement", "award", "delivery"})
            assert any(isinstance(node, ast.Call) and "web.get" in ast.unparse(node.func) for node in ast.walk(callback))
    assert sha256(ARTIFACT) == "0695982b068f8043a21b6d3ccfc10b5cb7aa5e945186a1e10fbe6f7113dd48cf"
    assert ARTIFACT.stat().st_size == 2144
    assert sha256(CONTRADICTORY_ARTIFACT) == "5751f3e2cb4cd436a683489456470e434e2fd141f03f7d937a05e2cf4ea0dae8"
    assert CONTRADICTORY_ARTIFACT.stat().st_size == 2254


def test_studionet_runner_is_resumable_and_tracks_finality_without_duplicate_writes() -> None:
    runner = LIVE_RUNNER.read_text(encoding="utf-8")
    for method in REQUIRED:
        assert f'["{method}"' in runner or f'"{method}"' in runner
    assert 'const SPEND_CAP = 1_000_000_000_000_000n;' in runner
    assert 'const ESCROW = 100_000_000_000_000n;' in runner
    assert 'const JOURNAL_PATH = path.join(EVIDENCE_DIR, "procura-v2-studionet-v2-1-2-live.json")' in runner
    assert 'submissionHash: hash' in runner
    assert 'record.genlayerTxId' in runner
    assert 'argumentsHash: sha256(stableJSON(args))' in runner
    assert 'record.completionCheckpoint' in runner
    assert 'await waitForSubmittedHash' in runner
    assert 'await assertCanonicalPrecondition(functionName)' in runner
    assert 'assertCanonicalSuccess(record, canonicalReadback)' in runner
    assert 'nonceSnapshot(live.client, live.account.address)' in runner
    assert 'qualificationTransactionCount: 13' in runner
    assert 'authorization.sourceSha256 === sourceSha' in runner
    assert 'authorization.maximumGenDebitWei' in runner
    assert 'authorization.userAuthorizationText' in runner
    assert 'client.estimateTransactionGas' in runner
    assert 'summary.statusName === "READY_TO_FINALIZE"' in runner
    assert 'client.finalizeTransaction({ txId: parentTxId, account: guardedAccount })' in runner
    assert 'authorization.lifecycleFinalizationMaxCount' in runner
    assert 'transaction was not signed or sent' in runner
    assert 'error.code = "PROCURA_SPEND_CAP_PREFLIGHT"' in runner
    assert 'while (true)' in runner
    for state in ("PENDING", "PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED", "UNDETERMINED", "FINALIZED", "APPEAL_REVEALING", "APPEAL_COMMITTING", "READY_TO_FINALIZE", "CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"):
        assert f'"{state}"' in runner
    assert 'summary.resultName === "MAJORITY_AGREE"' in runner
    assert 'refusing a duplicate broadcast' in runner
    assert 'summary.statusName === "FINALIZED"' in runner
    assert "retries:" not in runner


def test_studionet_metadata_is_explicit() -> None:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    interface = json.loads(INTERFACE.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert schema["stableRuntime"]["network"] == "studionet"
    assert schema["stableRuntime"]["chainId"] == 61999
    assert schema["stableRuntime"]["rpc"] == "https://studio.genlayer.com/api"
    assert interface["stableRuntime"]["network"] == "studionet"
    assert manifest["network"] == "studionet"
    assert manifest["chainId"] == 61999
