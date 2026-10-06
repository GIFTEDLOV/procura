"""Static guards for the 5jyc generic-storage allocation remediation."""

import ast
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = ROOT / "contracts" / "Procura.py"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")
TREE = ast.parse(SOURCE)


def _generic_constructor_calls() -> list[ast.Call]:
    calls: list[ast.Call] = []
    for node in ast.walk(TREE):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Subscript):
            continue
        base = node.func.value
        name = base.attr if isinstance(base, ast.Attribute) else base.id if isinstance(base, ast.Name) else ""
        if name in {"DynArray", "TreeMap"}:
            calls.append(node)
    return calls


@pytest.mark.direct
def test_no_unsupported_direct_storage_generic_instantiation():
    """5jyc forbids direct construction of generic persistent collections."""
    assert _generic_constructor_calls() == []


@pytest.mark.direct
def test_all_procura_dynamic_defaults_use_empty_sequence_values():
    """Read-only TreeMap fallbacks use regular empty sequences, not storage constructors."""
    allocations = [
        node
        for node in ast.walk(TREE)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "inmem_allocate"
    ]
    assert allocations == []
    assert SOURCE.count("get(tender_id, [])") == 6
    assert SOURCE.count("get(award_id, [])") == 3
    assert "get(self._entity_key(entity_type, entity_id), [])" in SOURCE


@pytest.mark.direct
def test_persistent_storage_collections_remain_declarations():
    """The persistent model still declares the same collection fields."""
    expected = {
        "tenders",
        "tender_ids",
        "requirements",
        "requirement_ids_by_tender",
        "bids",
        "bid_ids_by_tender",
        "evidence",
        "evidence_ids_by_entity",
        "adjudications",
        "adjudication_ids_by_bid",
        "awards",
        "award_ids",
        "deliveries",
        "delivery_ids_by_award",
        "delivery_adjudications",
        "audit_events",
    }
    contract = next(node for node in TREE.body if isinstance(node, ast.ClassDef) and node.name == "Procura")
    actual = {
        node.target.id
        for node in contract.body
        if isinstance(node, ast.AnnAssign)
        and isinstance(node.target, ast.Name)
        and any(name in ast.unparse(node.annotation) for name in ("DynArray", "TreeMap"))
    }
    assert expected <= actual
