"""Run the current value-transfer probe under the Python 3.12 direct VM."""

from __future__ import annotations

from gltest.direct import VMContext, create_address, deploy_contract


def main() -> int:
    vm = VMContext()
    buyer = create_address("buyer")
    supplier = create_address("supplier")
    vm.sender = buyer

    with vm.activate():
        probe = deploy_contract("contracts/ValueTransferProbe.py", vm)
        vm.sender = buyer
        vm.value = 100
        probe.fund()
        funded = probe.get_probe()
        print(f"FUNDED={funded}")

        vm.value = 0
        probe.send_to_eoa(supplier, 40)
        settled = probe.get_probe()
        print(f"SETTLED={settled}")
        print(f"BALANCES={vm._balances}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
