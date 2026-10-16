"""Reviewer-only deterministic mapping test against the actual deployed Procura V2.1.2 source."""
import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contracts" / "Procura.py"
EXPECTED_SHA256 = "a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac"

def main():
    code = SOURCE.read_bytes()
    assert hashlib.sha256(code).hexdigest() == EXPECTED_SHA256, "Contract differs from deployed V2.1.2"
    tree = ast.parse(code.decode("utf-8"))
    cls = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "ProcuraV2Evidence")
    methods = {node.name: node for node in cls.body if isinstance(node, ast.FunctionDef)}
    schema = json.loads((ROOT / "contracts" / "schema.json").read_text())
    assert len(schema["methods"]) == len(methods.keys() & {m["name"] for m in schema["methods"]})
    for method in schema["methods"]:
        node = methods[method["name"]]
        assert [arg.arg for arg in node.args.args if arg.arg != "self"] == method["arguments"], method["name"]
    for name, expected in {
        "create_tender": ("bid_deadline", "evaluation_deadline", "delivery_deadline", "tender_hash"),
        "submit_bid": ("submitted_at", "bid_hash"),
        "create_delivery": ("submitted_at",),
        "add_delivery_evidence": ("content_sha256", "observed_at", "published_at"),
    }.items():
        node = methods[name]
        ann = {arg.arg: ast.unparse(arg.annotation) for arg in node.args.args if arg.annotation is not None}
        for field in expected:
            assert ann[field] == "str", f"{name}.{field} must be a contract-valid string"
    serializer = (ROOT / "frontend" / "src" / "lib" / "serialization.ts").read_text()
    assert "contractTimestampPattern" in serializer
    assert "hashSchema" in serializer
    assert "normalizeContractTimestamp" in serializer
    print("PROCURA_V212_DEPLOYED_SOURCE_PARITY=PASS")
    print("PROCURA_V212_SHARED_METHOD_MAPPING=PASS")
    print("PROCURA_V212_TIMESTAMP_AND_HASH_TYPES=PASS")
    print("LIVE_QUALIFICATION=NOT_EVALUATED")

if __name__ == "__main__":
    main()
