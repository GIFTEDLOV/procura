"""Run the single corrected Procura JSON-mode semantic compatibility probe."""

from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

import requests
from genlayer_py import create_client
from genlayer_py.abi import calldata
from genlayer_py.abi.transactions import serialize
from genlayer_py.chains import studio_devnet
from genlayer_py.contracts.utils import make_calldata_object
from genlayer_py.transactions.actions import is_successful

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.qualification.studio_live_qualification import (  # noqa: E402
    _append_journal,
    _json_safe,
    _load_unlocked_cli_account,
)


RPC = "https://studio-dev.genlayer.com/api"
CHAIN_ID = 61997
RUNNER = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng"
HISTORICAL_ADDRESS = "0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
SOURCE_PATH = Path(__file__).with_name("_procura_json_semantic_probe_contract.py")
JOURNAL = Path(__file__).with_name("_procura_json_semantic_probe.jsonl")
EXISTING_DEPLOY_TX = "0x631bc97d6e818d91c2485b109e17887a07a61c0454c52507cca1d19b72ffa631"
EXISTING_PROBE_ADDRESS = "0xAD920928752539Cf7f1f877B39BFEF6e4feEB342"


def _request(method: str, params: list[dict]) -> object:
    response = requests.post(
        RPC,
        json={"jsonrpc": "2.0", "id": int(time.time() * 1000), "method": method, "params": params},
        headers={"Content-Type": "application/json", "User-Agent": "genlayer-py"},
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        raise RuntimeError(json.dumps(_json_safe(payload["error"]), sort_keys=True))
    return payload.get("result")


def _encoded_deploy(source: str) -> str:
    constructor = calldata.encode(make_calldata_object(method=None, args=[], kwargs={}))
    return serialize([source, constructor, False])


def _encoded_write(function_name: str, args: list[object]) -> str:
    encoded = calldata.encode(make_calldata_object(method=function_name, args=args))
    return serialize([encoded, False])


def _status_code(result: object) -> int | None:
    if result == "00":
        return 0
    if isinstance(result, dict):
        status = result.get("status")
        if isinstance(status, dict) and status.get("code") is not None:
            return int(status["code"])
        if result.get("code") is not None:
            return int(result["code"])
    return None


def _gen_call(*, sender: str, to: str, data: str, call_type: str) -> object:
    return _request(
        "gen_call",
        [
            {
                "from": sender,
                "to": to,
                "data": data,
                "type": call_type,
                "value": "0x0",
                "status": "finalized",
            }
        ],
    )


def _receipt_summary(receipt: object) -> dict[str, object]:
    if not isinstance(receipt, dict):
        return {"type": type(receipt).__name__, "value": str(receipt)}
    consensus = receipt.get("consensus_data") or {}
    validators = []
    for item in consensus.get("validators") or []:
        validators.append(
            {
                "address": item.get("node_config", {}).get("address") if isinstance(item.get("node_config"), dict) else None,
                "vote": item.get("vote"),
                "executionResult": item.get("execution_result"),
                "errorCode": (item.get("genvm_result") or {}).get("error_code") if isinstance(item.get("genvm_result"), dict) else None,
                "nondetDisagree": item.get("nondet_disagree"),
                "calldata": item.get("calldata"),
            }
        )
    leader_receipts = []
    for item in receipt.get("leader_receipt") or []:
        leader_receipts.append(
            {
                "address": item.get("node_config", {}).get("address") if isinstance(item.get("node_config"), dict) else None,
                "executionResult": item.get("execution_result"),
                "calldata": item.get("calldata"),
                "eqOutputs": item.get("eq_outputs"),
            }
        )
    return {
        "result": receipt.get("result"),
        "resultName": receipt.get("result_name"),
        "executionResult": receipt.get("tx_execution_result_name"),
        "contractAddress": (receipt.get("data") or {}).get("contract_address"),
        "messages": receipt.get("messages"),
        "consumedValidators": receipt.get("consumed_validators"),
        "consensusVotes": consensus.get("votes"),
        "validators": validators,
        "leaderReceipts": leader_receipts,
        "lastRound": receipt.get("last_round"),
        "txExecutionResult": receipt.get("tx_execution_result"),
    }


def _assert_gen_call(label: str, result: object) -> None:
    code = _status_code(result)
    if code != 0:
        raise RuntimeError(f"{label} failed: {json.dumps(_json_safe(result), sort_keys=True)}")


def _fee_options() -> dict[str, object]:
    return {
        "leaderTimeunitsAllocation": 100,
        "validatorTimeunitsAllocation": 200,
        "executionBudgetPerRound": 25_000_000_000_000_000,
        "totalMessageFees": 0,
        "appealRounds": 0,
        "rotations": [3],
    }


def _args() -> tuple[list[object], list[object]]:
    requirement = [
        "The supplier battery system must be materially compatible with the frozen Victron inverter/controller specification. A documented equivalent is acceptable only where the evidence establishes functional compatibility without weakening mandatory electrical and communication requirements.",
        "SEMANTIC",
        "Victron-compatible LiFePO4 battery system",
        "system",
        "Product: Controlled LiFePO4 battery system. Voltage range: 48V nominal, 40-60V operating. Communication: CAN bus with the frozen Victron controller. Compatibility: manufacturer statement confirms compatibility with the specified Victron inverter/controller. No contradictory statement.",
        "a" * 64,
    ]
    delivery = [
        "Awarded specification: LiFePO4 battery system, 10 kWh, 6000 cycles, compatible with the frozen Victron inverter/controller.",
        "Delivered specification: same LiFePO4 battery system, 10 kWh, 6000 cycles, compatible with the frozen Victron inverter/controller.",
        "1",
        "b" * 64,
    ]
    return requirement, delivery


def main() -> int:
    source = SOURCE_PATH.read_text(encoding="utf-8")
    account = _load_unlocked_cli_account("deployer")
    client = create_client(studio_devnet, endpoint=RPC, account=account)
    if client.chain.id != CHAIN_ID:
        raise RuntimeError(f"unexpected chain id: {client.chain.id}")

    schema = client.get_contract_schema_for_code(source)
    schema_methods = schema.get("methods", {}) if isinstance(schema, dict) else {}
    if not schema_methods:
        raise RuntimeError("probe schema is empty")

    deploy_preflight = _gen_call(
        sender=account.address,
        to=ZERO_ADDRESS,
        data=_encoded_deploy(source),
        call_type="deploy",
    )
    _assert_gen_call("deploy preflight", deploy_preflight)

    estimate = client.estimate_transaction_fees(options=_fee_options())
    fee_value = int(estimate["feeValue"])
    distribution = estimate.get("distribution")
    if fee_value <= 0 or not isinstance(distribution, dict) or not distribution:
        raise RuntimeError(f"invalid probe deploy fee quote: {estimate}")
    fees = {"distribution": distribution, "feeValue": fee_value}

    deploy_tx = EXISTING_DEPLOY_TX
    deploy_hash = deploy_tx
    _append_journal(JOURNAL, {"event": "probe_deploy_resume", "txHash": deploy_tx})
    deploy_receipt = client.wait_for_transaction_receipt(
        deploy_hash, wait_until="finalized", interval=5000, retries=120, full_transaction=True
    )
    if not is_successful(deploy_receipt):
        raise RuntimeError(f"probe deployment failed: {_json_safe(_receipt_summary(deploy_receipt))}")
    probe_address = str((deploy_receipt.get("data") or {}).get("contract_address") or EXISTING_PROBE_ADDRESS)
    if not probe_address or probe_address.lower() == "none":
        raise RuntimeError(f"probe deployment did not return address: {_json_safe(_receipt_summary(deploy_receipt))}")

    requirement_args, delivery_args = _args()
    results: dict[str, object] = {
        "runner": RUNNER,
        "network": "studio-dev",
        "chainId": CHAIN_ID,
        "schemaMethods": sorted(schema_methods),
        "deployPreflight": deploy_preflight,
        "deployFeeValue": fee_value,
        "deployTx": deploy_tx,
        "deployReceipt": _receipt_summary(deploy_receipt),
        "probeAddress": probe_address,
        "requirementLeaderResponseType": "dict (native response_format=json path)",
    }

    for label, function_name, args in (
        ("requirement", "probe_requirement", requirement_args),
        ("delivery", "probe_delivery", delivery_args),
    ):
        leader_preflight = _gen_call(
            sender=account.address,
            to=probe_address,
            data=_encoded_write(function_name, args),
            call_type="write",
        )
        _assert_gen_call(f"{label} leader preflight", leader_preflight)
        tx_hash = client.write_contract(
            probe_address,
            function_name,
            account=account,
            args=args,
            value=0,
            fees=fees,
        )
        tx_text = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
        _append_journal(JOURNAL, {"event": f"probe_{label}_broadcast", "txHash": tx_text})
        receipt = client.wait_for_transaction_receipt(
            tx_hash, wait_until="finalized", interval=5000, retries=180, full_transaction=True
        )
        summary = _receipt_summary(receipt)
        if not is_successful(receipt):
            raise RuntimeError(f"{label} probe did not reach successful consensus: {_json_safe(summary)}")
        read_name = "get_requirement_result" if label == "requirement" else "get_delivery_result"
        result = client.read_contract(probe_address, read_name)
        results[f"{label}Tx"] = tx_text
        results[f"{label}Receipt"] = summary
        results[f"{label}Result"] = result

    print(json.dumps(_json_safe(results), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
