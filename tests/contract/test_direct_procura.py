import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.direct
def test_contract_source_has_fail_closed_semantic_vector():
    source = (ROOT / "contracts" / "Procura.py").read_text(encoding="utf-8")
    assert "malformed semantic output" in source
    assert "mandatory_requirement_breached" in source
    assert "evidence_sufficient" in source


@pytest.mark.direct
def test_demo_fixture_is_explicitly_controlled():
    demo = json.loads((ROOT / "frontend" / "src" / "lib" / "demoData.json").read_text(encoding="utf-8"))
    assert demo["mode"] == "CONTROLLED DEMO"
    assert demo["scenario"]["deliveryVerdict"] == "MATERIAL_DELIVERY_MISMATCH"
