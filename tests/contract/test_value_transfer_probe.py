from pathlib import Path


def test_value_transfer_probe_contains_current_runtime_primitives():
    source = (Path(__file__).resolve().parents[2] / "contracts" / "ValueTransferProbe.py").read_text(encoding="utf-8")
    assert "@gl.public.write.payable" in source
    assert "gl.message.value" in source
    assert "self.balance" in source
    assert "@gl.evm.contract_interface" in source
    assert "emit_transfer" in source


def test_probe_has_no_legacy_fake_settlement_api():
    source = (Path(__file__).resolve().parents[2] / "contracts" / "ValueTransferProbe.py").read_text(encoding="utf-8")
    assert ".send(" not in source
    assert "ledger_only" not in source
