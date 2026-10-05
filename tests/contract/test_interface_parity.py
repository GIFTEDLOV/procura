import ast
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _decorated_public_methods():
    tree = ast.parse((ROOT / "contracts" / "Procura.py").read_text(encoding="utf-8"))
    methods = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in node.decorator_list:
            dotted = []
            current = decorator
            while isinstance(current, ast.Attribute):
                dotted.append(current.attr)
                current = current.value
            if isinstance(current, ast.Name):
                dotted.append(current.id)
            if list(reversed(dotted))[:2] == ["gl", "public"]:
                methods.append(node.name)
    return sorted(set(methods))


def test_contract_interface_matches_public_surface():
    interface = json.loads((ROOT / "contracts" / "interface.json").read_text(encoding="utf-8"))
    assert sorted(interface["methods"]) == _decorated_public_methods()


def test_schema_version_is_frozen():
    interface = json.loads((ROOT / "contracts" / "interface.json").read_text(encoding="utf-8"))
    assert interface["schemaVersion"] == "PROCUREMENT_V1"
