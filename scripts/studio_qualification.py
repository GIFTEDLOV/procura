"""Opt-in Local Studio qualification for storage and native GEN value paths.

The script is deliberately disabled by default.  It only permits loopback
RPCs and requires --execute so a caller cannot accidentally perform a live
write.  It records recipient and contract balance deltas without counting the
sender's transaction fees as transfer value.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _wait(client, tx_hash):
    return client.wait_for_finalization(tx_hash, interval=1000, retries=60)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true", help="perform loopback Local Studio writes")
    parser.add_argument("--rpc", default=os.getenv("PROCURA_STUDIO_RPC", "http://127.0.0.1:4000/api"))
    args = parser.parse_args()
    if not args.execute:
        print("QUALIFICATION=DRY_RUN")
        print("Set --execute only after Local Studio health and operator review.")
        return 0
    if not args.rpc.startswith(("http://127.0.0.1:", "http://localhost:")):
        raise SystemExit("refusing non-loopback RPC")

    from genlayer_py import create_account, create_client

    root = Path(__file__).resolve().parents[1]
    account = create_account()
    client = create_client(endpoint=args.rpc, account=account)
    client.fund_account(account.address)
    buyer = account.address
    supplier = create_account()
    client.fund_account(supplier.address)

    storage_hash = client.deploy_contract(_read(root / "contracts" / "StorageProbe.py"))
    storage_final = _wait(client, storage_hash)
    storage_address = storage_final.contract_address
    client.write_contract(storage_address, "set_value", args=[123])
    storage_readback = client.read_contract(storage_address, "get_value")

    probe_hash = client.deploy_contract(_read(root / "contracts" / "ValueTransferProbe.py"))
    probe_final = _wait(client, probe_hash)
    probe_address = probe_final.contract_address
    contract_before = client.get_balance(probe_address)
    supplier_before = client.get_balance(supplier.address)
    fund_hash = client.write_contract(probe_address, "fund", value=100)
    _wait(client, fund_hash)
    contract_after_fund = client.get_balance(probe_address)
    payout_hash = client.write_contract(probe_address, "send_to_eoa", args=[supplier.address, 40])
    _wait(client, payout_hash)
    contract_after_exit = client.get_balance(probe_address)
    supplier_after = client.get_balance(supplier.address)
    result = {
        "rpc": args.rpc,
        "storage_deploy": bool(storage_address),
        "storage_readback": str(storage_readback),
        "value_probe": {
            "contract_balance_before": int(contract_before),
            "contract_balance_after_fund": int(contract_after_fund),
            "contract_balance_after_exit": int(contract_after_exit),
            "supplier_balance_before": int(supplier_before),
            "supplier_balance_after_payout": int(supplier_after),
            "expected_funding_delta": 100,
            "expected_payout_delta": 40,
            "actual_funding_delta": int(contract_after_fund - contract_before),
            "actual_contract_exit_delta": int(contract_after_fund - contract_after_exit),
            "actual_supplier_delta": int(supplier_after - supplier_before),
        },
    }
    result["value_probe"]["pass"] = (
        result["value_probe"]["actual_funding_delta"] == 100
        and result["value_probe"]["actual_contract_exit_delta"] == 40
        and result["value_probe"]["actual_supplier_delta"] == 40
    )
    print(json.dumps(result, indent=2))
    return 0 if result["value_probe"]["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
