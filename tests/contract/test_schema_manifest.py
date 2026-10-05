import ast
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _decorator_tail(decorator):
    names = []
    current = decorator
    while isinstance(current, ast.Attribute):
        names.append(current.attr)
        current = current.value
    if isinstance(current, ast.Name):
        names.append(current.id)
    return list(reversed(names))


def test_schema_manifest_matches_all_public_methods_and_arguments():
    source = (ROOT / "contracts" / "Procura.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    contract = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "Procura")
    actual = {}
    for node in contract.body:
        if not isinstance(node, ast.FunctionDef):
            continue
        decorators = [_decorator_tail(decorator) for decorator in node.decorator_list]
        if not any(tail[:2] == ["gl", "public"] for tail in decorators):
            continue
        actual[node.name] = [arg.arg for arg in node.args.args[1:]]
    schema = json.loads((ROOT / "contracts" / "schema.json").read_text(encoding="utf-8"))
    manifest = {method["name"]: method["arguments"] for method in schema["methods"]}
    assert actual == manifest
    assert len(actual) == 39


def test_schema_method_names_match_legacy_interface():
    schema = json.loads((ROOT / "contracts" / "schema.json").read_text(encoding="utf-8"))
    interface = json.loads((ROOT / "contracts" / "interface.json").read_text(encoding="utf-8"))
    assert {method["name"] for method in schema["methods"]} == set(interface["methods"])
