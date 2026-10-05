"""Report the installed GenLayer value-transfer primitives without live writes."""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    source = (root / "contracts" / "ValueTransferProbe.py").read_text(encoding="utf-8")
    package = importlib.util.find_spec("genlayer_py")
    genlayer_cli = "installed" if __import__("shutil").which("genlayer") else "not-found"
    print("VALUE_TRANSFER_PROBE")
    print(f"python={sys.version.split()[0]}")
    print(f"genlayer_py={'installed' if package else 'not-found'}")
    print(f"genlayer_cli={genlayer_cli}")
    print(f"payable_decorator={'@gl.public.write.payable' in source}")
    print(f"incoming_value_accessor={'gl.message.value' in source}")
    print(f"balance_accessor={'self.balance' in source}")
    print(f"outgoing_eoa_primitive={'emit_transfer' in source and '@gl.evm.contract_interface' in source}")
    print(f"contract_source_sha256={__import__('hashlib').sha256(source.encode()).hexdigest()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
