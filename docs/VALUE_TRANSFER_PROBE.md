# Value transfer probe

The installed CLI is GenLayer `0.40.0-rc.3`; the available Python packages are `genlayer-py 0.19.0rc2` and `genlayer-test 0.30.0rc2`. The current supported API is represented in `contracts/ValueTransferProbe.py`: payable incoming value via `gl.message.value`, balance visibility via `self.balance`, and outgoing EOA transfer via `@gl.evm.contract_interface` plus `emit_transfer(value=...)`.

The probe has not performed a live write. The installed direct runner currently fails during Windows/Python 3.14 message bootstrap before contract import, so direct execution is explicitly skipped rather than treated as proof. Gate 2 must run the probe in a local simulator or controlled network and reconcile both contract and EOA balances after finalization. Until that evidence exists, the frontend labels any settlement data as foundation-only and never claims live settlement.
