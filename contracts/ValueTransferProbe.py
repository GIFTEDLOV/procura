# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Minimal GenLayer value-transfer probe used before settlement is enabled."""

from genlayer import *


def _emit_external_transfer(recipient: Address, amount: u256) -> None:
    # Deferred because the direct runner injects message context at call time.
    @gl.evm.contract_interface
    class Recipient:
        class View:
            pass

        class Write:
            pass

    Recipient(recipient).emit_transfer(value=amount)


class ValueTransferProbe(gl.Contract):
    received: u256
    last_recipient: Address
    last_transfer: u256

    def __init__(self):
        self.received = u256(0)
        self.last_recipient = Address("0x" + "0" * 40)
        self.last_transfer = u256(0)

    @gl.public.write.payable
    def fund(self) -> None:
        if gl.message.value == u256(0):
            raise gl.vm.UserError("probe requires incoming value")
        self.received += gl.message.value

    @gl.public.write
    def send_to_eoa(self, recipient: Address, amount: u256) -> None:
        if recipient.as_hex.lower() == "0x" + "0" * 40:
            raise gl.vm.UserError("zero recipient")
        if amount == u256(0) or amount > self.balance:
            raise gl.vm.UserError("insufficient contract balance")
        self.last_recipient = recipient
        self.last_transfer = amount
        _emit_external_transfer(recipient, amount)

    @gl.public.view
    def get_probe(self) -> dict:
        return {"received": self.received, "balance": self.balance, "last_transfer": self.last_transfer}
