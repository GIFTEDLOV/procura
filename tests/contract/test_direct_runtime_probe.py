import pytest


@pytest.mark.skip(reason="Installed genlayer-test 0.30.0rc2 direct adapter only supports the v0.3 calldata/storage API; this v0.6 runtime probe needs a compatible GenVM runner.")
def test_runtime_probe_funds_and_emits_value(direct_vm, direct_deploy, direct_alice, direct_bob):
    probe = direct_deploy("contracts/ValueTransferProbe.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    probe.fund()
    state = probe.get_probe()
    assert state["received"] == 100
    assert state["balance"] >= 100

    direct_vm.value = 0
    probe.send_to_eoa(direct_bob, 40)
    state = probe.get_probe()
    assert state["last_transfer"] == 40
