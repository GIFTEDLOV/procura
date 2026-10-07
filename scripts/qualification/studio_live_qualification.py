"""Type-safe Studio-dev qualification writes for the already deployed Procura.

This module deliberately uses genlayer-py only.  It never invokes the GenLayer
CLI argument parser, never constructs an RLP transaction manually, and never
retries a submitted transaction.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import requests
from eth_account import Account
from genlayer_py import create_client
from genlayer_py.abi import calldata
from genlayer_py.abi.transactions import serialize
from genlayer_py.chains import studio_devnet
from genlayer_py.contracts.utils import make_calldata_object
from genlayer_py.transactions.actions import is_successful
from genlayer_py.transactions import (
    MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
    MessageType,
    derive_external_message_call_key,
    encode_external_message_fee_params,
)
from web3 import Web3


NETWORK = "studio-dev"
CHAIN_ID = 61997
RPC = "https://studio-dev.genlayer.com/api"
CONTRACT_ADDRESS = "0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA"
BUYER_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
SUPPLIER_ADDRESS = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8"
LIVE_TEST_AMOUNT = 1_000_000_000_000_000
PASSWORD_ENV = "PROCURA_QUALIFICATION_KEYSTORE_PASSWORD"
DEFAULT_JOURNAL = Path(tempfile.gettempdir()) / "procura-studio-live-qualification.jsonl"
DEFAULT_FEE_PROFILE = Path(__file__).resolve().parents[2] / "evidence" / "studio-dev-fee-profile.json"


class QualificationError(RuntimeError):
    """A qualification precondition, execution, or accounting check failed."""


@dataclass(frozen=True)
class WriteSpec:
    function_name: str
    kwargs: dict[str, Any]
    value: int = 0
    external_recipient: str | None = None
    external_value: int | None = None
    external_data: str = "0x"


@dataclass(frozen=True)
class EncodedWrite:
    calldata_bytes: bytes
    rpc_data: str
    decoded_calldata: Any


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, bytes):
        return "0x" + value.hex()
    if isinstance(value, int):
        return str(value)
    if value is None or isinstance(value, (str, float, bool)):
        return value
    # genlayer-py returns typed wrapper values (for example CalldataAddress)
    # from canonical reads. Keep journaling safe after a finalized write.
    return str(value)


_SENSITIVE_KEYS = {"private_key", "privateKey", "api_key", "apiKey", "password", "secret"}


def _redact_sensitive(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): "[REDACTED]" if str(key) in _SENSITIVE_KEYS else _redact_sensitive(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_sensitive(item) for item in value]
    return value


def _append_journal(path: Path, event: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(_json_safe(event), sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def _hash_fixture(label: str) -> str:
    return hashlib.sha256(label.encode("utf-8")).hexdigest()


def _utc_case_id(prefix: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"PROCURA-LIVE-{prefix}-{stamp}"


def _load_account(keystore_path: Path, password: str):
    encrypted = keystore_path.read_text(encoding="utf-8")
    private_key = Account.decrypt(encrypted, password)
    return Account.from_key(private_key)


class StudioLiveQualification:
    def __init__(self, account: Any, journal: Path | None = None):
        self.account = account
        self.journal = journal or Path(os.environ.get("PROCURA_LIVE_JOURNAL", DEFAULT_JOURNAL))
        self.client = create_client(studio_devnet, endpoint=RPC, account=account)
        if self.client.chain.id != CHAIN_ID:
            raise QualificationError(f"unexpected chain id: {self.client.chain.id}")
        if self.client.provider.url != RPC:
            raise QualificationError(f"unexpected RPC: {self.client.provider.url}")
        self.schema = self.client.get_contract_schema(CONTRACT_ADDRESS)

    def method_schema(self, function_name: str) -> dict[str, Any]:
        methods = self.schema.get("methods", {})
        if function_name not in methods:
            raise QualificationError(f"method absent from deployed schema: {function_name}")
        return methods[function_name]

    def _expected_params(self, function_name: str) -> dict[str, str]:
        info = self.method_schema(function_name)
        kwparams = info.get("kwparams") or {}
        if kwparams:
            return {str(name): str(schema_type) for name, schema_type in kwparams.items()}
        return {str(name): str(schema_type) for name, schema_type in info.get("params", [])}

    def _ordered_args(self, function_name: str, kwargs: dict[str, Any]) -> list[Any]:
        """Return schema-order positional values for methods without kwparams.

        The deployed Procura schema exposes positional ``params`` and an empty
        ``kwparams`` object.  The write object remains named and type-checked;
        only the SDK call is lowered to the exact schema order accepted by the
        current client.
        """
        expected = self._expected_params(function_name)
        return [kwargs[name] for name in expected]

    @staticmethod
    def _validate_value(name: str, schema_type: str, value: Any) -> None:
        if schema_type in ("string", "str"):
            valid = isinstance(value, str)
        elif schema_type in ("int", "u256", "u128", "u64", "u32", "i256", "i128", "i64"):
            valid = type(value) is int
        elif schema_type == "bool":
            valid = type(value) is bool
        elif schema_type in ("array", "list"):
            valid = isinstance(value, list)
        elif schema_type in ("dict", "map"):
            valid = isinstance(value, dict)
        elif schema_type == "address":
            valid = isinstance(value, str)
        else:
            valid = True
        if not valid:
            raise QualificationError(
                f"{name} expected {schema_type}, got {type(value).__name__}"
            )

    def validate_write(self, spec: WriteSpec) -> None:
        expected = self._expected_params(spec.function_name)
        supplied = set(spec.kwargs)
        if supplied != set(expected):
            missing = sorted(set(expected) - supplied)
            extra = sorted(supplied - set(expected))
            raise QualificationError(
                f"{spec.function_name} kwargs mismatch; missing={missing}, extra={extra}"
            )
        for name, schema_type in expected.items():
            self._validate_value(name, schema_type, spec.kwargs[name])
        if type(spec.value) is not int or spec.value < 0:
            raise QualificationError("write value must be a non-negative Python int")

    def read(self, function_name: str, kwargs: dict[str, Any] | None = None) -> Any:
        self.method_schema(function_name)
        read_kwargs = kwargs or {}
        return self.client.read_contract(
            CONTRACT_ADDRESS,
            function_name,
            args=self._ordered_args(function_name, read_kwargs),
            account=self.account,
        )

    def balance(self, address: str) -> int:
        return int(self.client.w3.eth.get_balance(Web3.to_checksum_address(address)))

    def wait_for_balance_deltas(
        self,
        expectations: dict[str, tuple[int, int]],
        *,
        label: str,
        retries: int = 24,
        interval: float = 5.0,
    ) -> dict[str, int]:
        """Wait for finalized external message effects without rebroadcasting."""
        for attempt in range(retries):
            current = {address: self.balance(address) for address in expectations}
            if all(current[address] - before == delta for address, (before, delta) in expectations.items()):
                return current
            if attempt + 1 < retries:
                time.sleep(interval)
        details = {
            address: {
                "before": before,
                "expectedDelta": delta,
                "actualDelta": current[address] - before,
            }
            for address, (before, delta) in expectations.items()
        }
        raise QualificationError(f"{label} external transfer effect did not settle: {details}")

    def fee_profile(self, function_name: str) -> dict[str, Any]:
        path = Path(os.environ.get("PROCURA_FEE_PROFILE", DEFAULT_FEE_PROFILE))
        if not path.exists():
            raise QualificationError(f"fee profile is missing: {path}")
        document = json.loads(path.read_text(encoding="utf-8"))
        if document.get("network") != NETWORK or int(document.get("chainId", -1)) != CHAIN_ID:
            raise QualificationError(f"fee profile targets the wrong network: {path}")
        methods = document.get("methods", {})
        profile = methods.get(function_name)
        if not isinstance(profile, dict):
            raise QualificationError(f"fee profile entry is missing for {function_name}: {path}")
        required = (
            "leaderTimeunitsAllocation",
            "validatorTimeunitsAllocation",
            "executionBudgetPerRound",
            "totalMessageFees",
        )
        missing = [key for key in required if key not in profile]
        if missing:
            raise QualificationError(f"fee profile entry incomplete for {function_name}: {missing}")
        if "feeValue" in profile:
            raise QualificationError(f"fee profile must not hardcode feeValue: {function_name}")
        return profile

    @staticmethod
    def _external_allocation(spec: WriteSpec, profile: dict[str, Any]) -> dict[str, Any] | None:
        if spec.external_recipient is None:
            return None
        config = profile.get("externalMessage")
        if not isinstance(config, dict):
            raise QualificationError(f"missing externalMessage fee profile for {spec.function_name}")
        gas_limit = int(config.get("gasLimit", 0))
        max_gas_price = int(config.get("maxGasPrice", 0))
        budget = int(config.get("budget", profile.get("totalMessageFees", 0)))
        if gas_limit <= 0 or max_gas_price <= 0 or budget <= 0:
            raise QualificationError(f"invalid external message fee profile for {spec.function_name}")
        if budget != gas_limit * max_gas_price:
            raise QualificationError(
                f"external message budget mismatch for {spec.function_name}: "
                f"budget={budget}, gasLimit*maxGasPrice={gas_limit * max_gas_price}"
            )
        declared_message_fees = int(profile.get("totalMessageFees", 0))
        if declared_message_fees != budget:
            raise QualificationError(
                f"totalMessageFees does not equal pinned message budget for {spec.function_name}"
            )
        return {
            "messageType": MessageType.External,
            "onAcceptance": False,
            "parentIndex": MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
            "recipient": spec.external_recipient,
            "callKey": derive_external_message_call_key(spec.external_data),
            "budget": budget,
            "feeParams": encode_external_message_fee_params(
                {"gasLimit": gas_limit, "maxGasPrice": max_gas_price}
            ),
        }

    def _fee_options(self, spec: WriteSpec, profile: dict[str, Any]) -> dict[str, Any]:
        appeal_rounds = int(profile.get("appealRounds", 0))
        rotations = profile.get("rotations")
        if rotations is None:
            rotations_per_round = int(profile.get("rotationsPerRound", 3))
            rotations = [rotations_per_round] * (appeal_rounds + 1)
        options: dict[str, Any] = {
            "leaderTimeunitsAllocation": int(profile["leaderTimeunitsAllocation"]),
            "validatorTimeunitsAllocation": int(profile["validatorTimeunitsAllocation"]),
            "executionBudgetPerRound": int(profile["executionBudgetPerRound"]),
            "totalMessageFees": int(profile.get("totalMessageFees", 0)),
            "appealRounds": appeal_rounds,
            "rotations": [int(value) for value in rotations],
        }
        allocation = self._external_allocation(spec, profile)
        if allocation is not None:
            options["messageAllocations"] = [allocation]
        elif profile.get("messageAllocations") is not None:
            options["messageAllocations"] = profile["messageAllocations"]
        return options

    def encode_write(self, spec: WriteSpec) -> EncodedWrite:
        self.validate_write(spec)
        args = self._ordered_args(spec.function_name, spec.kwargs)
        encoded = calldata.encode(
            make_calldata_object(method=spec.function_name, args=args)
        )
        return EncodedWrite(
            calldata_bytes=encoded,
            rpc_data=serialize([encoded, False]),
            decoded_calldata=calldata.decode(encoded),
        )

    @staticmethod
    def _status_code(result: Any) -> int | None:
        if not isinstance(result, dict):
            return None
        status = result.get("status")
        if isinstance(status, dict) and status.get("code") is not None:
            return int(status["code"])
        for key in ("status_code", "statusCode", "code"):
            if result.get(key) is not None:
                return int(result[key])
        return None

    def gen_call_write(self, spec: WriteSpec, fee_quote: dict[str, Any] | None = None) -> dict[str, Any]:
        encoded = self.encode_write(spec)
        request = {
            "from": self.account.address,
            "to": CONTRACT_ADDRESS,
            "data": encoded.rpc_data,
            "type": "write",
            "value": hex(spec.value),
            "status": "finalized",
        }
        if fee_quote is not None:
            request["fees"] = {
                "distribution": fee_quote["distribution"],
                "feeValue": fee_quote["feeValue"],
            }
            if fee_quote.get("messageAllocations"):
                request["fees"]["messageAllocations"] = fee_quote["messageAllocations"]
        response = requests.post(
            RPC,
            json={
                "jsonrpc": "2.0",
                "id": int(time.time() * 1000),
                "method": "gen_call",
                "params": [request],
            },
            headers={"Content-Type": "application/json", "User-Agent": "genlayer-py"},
            timeout=120,
        ).json()
        response = _redact_sensitive(response)
        if response.get("error"):
            error = response["error"]
            error_data = error.get("data") if isinstance(error, dict) else None
            receipt = error_data.get("receipt") if isinstance(error_data, dict) else None
            stderr = receipt.get("genvm_result", {}).get("stderr", "") if isinstance(receipt, dict) else ""
            normalized_code = None
            if isinstance(receipt, dict) and receipt.get("execution_result") == "ERROR":
                normalized_code = 2 if "Traceback" in stderr or "TypeError" in stderr else 1
            return {
                "request": request,
                "response": response,
                "result": receipt,
                "statusCode": normalized_code,
                "statusCodeSource": "normalized from embedded GenVM execution_result; raw RPC status.code absent",
                "statusMessage": error.get("message") if isinstance(error, dict) else None,
                "rpcCode": error.get("code") if isinstance(error, dict) else None,
                "rpcError": error,
                "genvmResult": receipt,
                "calldataSha256": hashlib.sha256(encoded.calldata_bytes).hexdigest(),
                "calldataLength": len(encoded.calldata_bytes),
                "rpcDataSha256": hashlib.sha256(bytes.fromhex(encoded.rpc_data[2:])).hexdigest(),
                "rpcDataLength": len(bytes.fromhex(encoded.rpc_data[2:])),
                "decodedCalldata": encoded.decoded_calldata,
            }
        if "result" not in response:
            raise QualificationError(
                f"gen_call response missing result: {json.dumps(_json_safe(response), sort_keys=True)}"
            )
        raw_result = response["result"]
        if raw_result == "00":
            return {
                "request": request,
                "response": response,
                "result": {"status": {"code": 0, "message": "00"}},
                "statusCode": 0,
                "statusMessage": "00",
                "calldataSha256": hashlib.sha256(encoded.calldata_bytes).hexdigest(),
                "calldataLength": len(encoded.calldata_bytes),
                "rpcDataSha256": hashlib.sha256(bytes.fromhex(encoded.rpc_data[2:])).hexdigest(),
                "rpcDataLength": len(bytes.fromhex(encoded.rpc_data[2:])),
                "decodedCalldata": encoded.decoded_calldata,
                "messages": [],
            }
        status_code = self._status_code(raw_result)
        if status_code is None:
            raise QualificationError(
                "gen_call result missing status.code: "
                f"{json.dumps(_json_safe(raw_result), sort_keys=True)}"
            )
        return {
            "request": request,
            "response": response,
            "result": raw_result,
            "statusCode": status_code,
            "calldataSha256": hashlib.sha256(encoded.calldata_bytes).hexdigest(),
            "calldataLength": len(encoded.calldata_bytes),
            "rpcDataSha256": hashlib.sha256(bytes.fromhex(encoded.rpc_data[2:])).hexdigest(),
            "rpcDataLength": len(bytes.fromhex(encoded.rpc_data[2:])),
            "decodedCalldata": encoded.decoded_calldata,
        }

    def preflight(
        self,
        spec: WriteSpec,
        *,
        fee_quote: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        result = self.gen_call_write(spec, fee_quote=fee_quote)
        raw_result = result["result"]
        status = raw_result.get("status", {}) if isinstance(raw_result, dict) else {}
        if result["statusCode"] != 0:
            raise QualificationError(
                f"gen_call {spec.function_name} failed with normalized status.code={result['statusCode']} "
                f"(RPC {result.get('rpcCode')}): "
                f"{json.dumps(_json_safe(result.get('genvmResult') or result.get('rpcError')), sort_keys=True)}"
            )
        return {
            **result,
            "statusMessage": status.get("message") if isinstance(status, dict) else None,
            "kwargsTypes": {key: type(value).__name__ for key, value in spec.kwargs.items()},
            "argsTypes": [type(value).__name__ for value in self._ordered_args(spec.function_name, spec.kwargs)],
        }

    def quote(self, profile: dict[str, Any], spec: WriteSpec | None = None) -> dict[str, Any]:
        options = self._fee_options(spec or WriteSpec("", {}), profile)
        estimate = self.client.estimate_transaction_fees(options=options)
        fee_value = int(estimate["feeValue"])
        distribution = estimate.get("distribution")
        if fee_value <= 0:
            raise QualificationError(f"non-positive fee quote: {fee_value}")
        if not isinstance(distribution, dict) or not distribution:
            raise QualificationError("fee distribution is missing or empty")
        return {
            "feeValue": fee_value,
            "distribution": distribution,
            "messageAllocations": estimate.get("messageAllocations", options.get("messageAllocations", [])),
            "profile": profile,
            "estimateOptions": options,
        }

    def send_once(
        self,
        spec: WriteSpec,
        *,
        profile: dict[str, Any] | None = None,
        fee_quote: dict[str, Any] | None = None,
        preflight_result: dict[str, Any] | None = None,
        readback: Callable[[], Any] | None = None,
        label: str,
    ) -> dict[str, Any]:
        profile = profile or self.fee_profile(spec.function_name)
        quote = fee_quote or self.quote(profile, spec)
        preflight = preflight_result or self.preflight(spec, fee_quote=quote)
        fees = {
            "distribution": quote["distribution"],
            "feeValue": quote["feeValue"],
        }
        if quote.get("messageAllocations"):
            fees["messageAllocations"] = quote["messageAllocations"]
        args = self._ordered_args(spec.function_name, spec.kwargs)
        canonical = {
            "network": NETWORK,
            "chainId": CHAIN_ID,
            "rpc": RPC,
            "address": CONTRACT_ADDRESS,
            "functionName": spec.function_name,
            "kwargs": spec.kwargs,
            "args": args,
            "value": spec.value,
            "fees": fees,
            "profile": profile,
            "sender": self.account.address,
        }
        _append_journal(
            self.journal,
            {"event": "gen_call_preflight", "label": label, **preflight},
        )
        _append_journal(
            self.journal,
            {"event": "fee_quote", "label": label, "quote": quote, **canonical},
        )

        tx_hash = self.client.write_contract(
            CONTRACT_ADDRESS,
            spec.function_name,
            account=self.account,
            args=args,
            value=spec.value,
            fees=fees,
        )
        tx_hash_text = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
        _append_journal(
            self.journal,
            {"event": "broadcast", "label": label, "txHash": tx_hash_text, **canonical},
        )

        receipt = self.client.wait_for_transaction_receipt(
            tx_hash,
            wait_until="finalized",
            interval=5000,
            retries=120,
            full_transaction=True,
        )
        if not is_successful(receipt):
            _append_journal(
                self.journal,
                {"event": "execution_failure", "label": label, "txHash": tx_hash_text},
            )
            raise QualificationError(f"{label} did not finalize with successful execution")

        result = {"txHash": tx_hash_text, "receipt": receipt}
        if readback is not None:
            result["readback"] = readback()
        _append_journal(
            self.journal,
            {"event": "finalized", "label": label, "txHash": tx_hash_text, "readback": result.get("readback")},
        )
        return result


def create_tender_kwargs(case_id: str, *, budget: int = LIVE_TEST_AMOUNT) -> dict[str, Any]:
    return {
        "tender_id": case_id,
        "title": "Controlled live qualification",
        "description": "Non-production controlled qualification tender",
        "category": "CONTROLLED",
        "currency_label": "GEN",
        "budget_ceiling": budget,
        "bid_deadline": "9999-12-31T23:59:59Z",
        "evaluation_deadline": "9999-12-31T23:59:59Z",
        "delivery_deadline": "9999-12-31T23:59:59Z",
        "equivalence_policy": "NO_EQUIVALENCE",
        "evaluation_policy": "OBJECTIVE_AND_SEMANTIC",
        "payment_policy": "FULL_ON_ACCEPTANCE",
        "supplier_bond_policy": "NONE",
        "tender_hash": _hash_fixture(f"{case_id}:controlled-tender"),
    }


def requirement_kwargs(case_id: str, *, semantic: bool = False) -> dict[str, Any]:
    return {
        "tender_id": case_id,
        "requirement_id": f"{case_id}:REQ-1",
        "title": "Controlled qualification item",
        "description": (
            "The supplier must provide exactly one unit of a standard controlled "
            "qualification item. The evidence and supplier response confirm full conformity."
            if semantic
            else "The controlled qualification tender requires one item."
        ),
        "requirement_type": "OBJECTIVE",
        "mandatory": True,
        "operator": "MUST_HAVE",
        "expected_value": "1",
        "unit": "item",
        "equivalence_allowed": False,
        "evidence_required": semantic,
        "semantic_question": "Does the authenticated evidence establish the requirement?",
        "materiality": "HIGH",
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("schema", "preflight-create", "refund", "refund-retry", "payout"))
    parser.add_argument("--keystore", required=True, help="Encrypted keystore for the active signer")
    parser.add_argument("--supplier-keystore", help="Encrypted supplier keystore for payout mode")
    parser.add_argument("--case-id")
    parser.add_argument("--resume-create-tx", help="Resume after an already-finalized create_tender hash")
    parser.add_argument("--failed-cancel-tx", help="Previously failed cancel_tender hash for refund-retry mode")
    parser.add_argument("--supplier-password-env", default=PASSWORD_ENV)
    parser.add_argument("--journal", type=Path)
    return parser


def _password(env_name: str) -> str:
    value = os.environ.get(env_name)
    if not value:
        raise QualificationError(f"missing keystore password environment variable: {env_name}")
    return value


def _load_helper(keystore: str, password_env: str, journal: Path | None) -> StudioLiveQualification:
    account = _load_account(Path(keystore), _password(password_env))
    return StudioLiveQualification(account, journal)


def _assert_sender(helper: StudioLiveQualification, expected: str) -> None:
    if helper.account.address.lower() != expected.lower():
        raise QualificationError(f"wrong signer: expected {expected}, got {helper.account.address}")


def run_refund(
    helper: StudioLiveQualification,
    case_id: str,
    *,
    resume_create_tx: str | None = None,
) -> dict[str, Any]:
    _assert_sender(helper, BUYER_ADDRESS)
    if not resume_create_tx and case_id in helper.read("get_tender_ids"):
        raise QualificationError(f"case already exists: {case_id}")

    create = WriteSpec("create_tender", create_tender_kwargs(case_id))
    if resume_create_tx:
        existing = helper.read("get_tender", {"tender_id": case_id})
        if not existing:
            raise QualificationError(f"cannot resume: canonical tender readback is empty: {case_id}")
        _append_journal(
            helper.journal,
            {"event": "resume_finalized", "label": "refund.create_tender", "txHash": resume_create_tx},
        )
        create_result = {"txHash": resume_create_tx, "readback": existing}
    else:
        create_result = helper.send_once(
            create,
            readback=lambda: helper.read("get_tender", {"tender_id": case_id}),
            label="refund.create_tender",
        )
    result: dict[str, Any] = {"caseId": case_id, "create": create_result}

    requirement = WriteSpec("add_requirement", requirement_kwargs(case_id))
    result["addRequirement"] = helper.send_once(
        requirement,
        readback=lambda: helper.read("get_requirements", {"tender_id": case_id}),
        label="refund.add_requirement",
    )

    freeze = WriteSpec("freeze_tender", {"tender_id": case_id})
    result["freeze"] = helper.send_once(
        freeze,
        readback=lambda: helper.read("get_tender", {"tender_id": case_id}),
        label="refund.freeze_tender",
    )

    accounting_before = helper.read("get_accounting")
    balances_before = {
        "buyer": helper.balance(BUYER_ADDRESS),
        "contract": helper.balance(CONTRACT_ADDRESS),
    }
    fund = WriteSpec("fund_tender", {"tender_id": case_id}, LIVE_TEST_AMOUNT)
    result["fund"] = helper.send_once(
        fund,
        readback=lambda: {
            "tender": helper.read("get_tender", {"tender_id": case_id}),
            "accounting": helper.read("get_accounting"),
        },
        label="refund.fund_tender",
    )
    balances_after_fund = {
        "buyer": helper.balance(BUYER_ADDRESS),
        "contract": helper.balance(CONTRACT_ADDRESS),
    }
    tender_after_fund = result["fund"]["readback"]["tender"]
    accounting_after_fund = result["fund"]["readback"]["accounting"]
    if balances_after_fund["contract"] - balances_before["contract"] != LIVE_TEST_AMOUNT:
        raise QualificationError("fund contract balance delta mismatch")
    if int(tender_after_fund["escrow_liability"]) != LIVE_TEST_AMOUNT:
        raise QualificationError("fund tender escrow mismatch")
    if int(accounting_after_fund["escrow_liability"]) - int(accounting_before["escrow_liability"]) != LIVE_TEST_AMOUNT:
        raise QualificationError("fund global liability mismatch")

    before_cancel = {
        "buyer": helper.balance(BUYER_ADDRESS),
        "contract": helper.balance(CONTRACT_ADDRESS),
        "escrow": int(tender_after_fund["escrow_liability"]),
        "liability": int(accounting_after_fund["escrow_liability"]),
        "totalRefunds": int(accounting_after_fund["total_buyer_refunds"]),
    }
    cancel = WriteSpec(
        "cancel_tender",
        {"tender_id": case_id},
        external_recipient=BUYER_ADDRESS,
        external_value=LIVE_TEST_AMOUNT,
    )
    cancel_profile = helper.fee_profile(cancel.function_name)
    cancel_quote = helper.quote(cancel_profile, cancel)
    cancel_preflight = helper.preflight(cancel, fee_quote=cancel_quote)
    result["refundPreflight"] = cancel_preflight
    result["refund"] = helper.send_once(
        cancel,
        profile=cancel_profile,
        fee_quote=cancel_quote,
        preflight_result=cancel_preflight,
        readback=lambda: {
            "tender": helper.read("get_tender", {"tender_id": case_id}),
            "accounting": helper.read("get_accounting"),
            "audit": helper.read("get_audit_events"),
        },
        label="refund.cancel_tender",
    )
    settled_balances = helper.wait_for_balance_deltas(
        {
            BUYER_ADDRESS: (before_cancel["buyer"], LIVE_TEST_AMOUNT),
            CONTRACT_ADDRESS: (before_cancel["contract"], -LIVE_TEST_AMOUNT),
        },
        label="refund",
    )
    after_cancel = {
        "buyer": settled_balances[BUYER_ADDRESS],
        "contract": settled_balances[CONTRACT_ADDRESS],
        "escrow": int(result["refund"]["readback"]["tender"]["escrow_liability"]),
        "liability": int(result["refund"]["readback"]["accounting"]["escrow_liability"]),
        "totalRefunds": int(result["refund"]["readback"]["accounting"]["total_buyer_refunds"]),
    }
    expected = LIVE_TEST_AMOUNT
    checks = {
        "buyerRefundDelta": after_cancel["buyer"] - before_cancel["buyer"],
        "contractRefundDelta": before_cancel["contract"] - after_cancel["contract"],
        "escrowDelta": before_cancel["escrow"] - after_cancel["escrow"],
        "liabilityDelta": before_cancel["liability"] - after_cancel["liability"],
        "accountingRefundDelta": after_cancel["totalRefunds"] - before_cancel["totalRefunds"],
    }
    if any(value != expected for value in checks.values()):
        raise QualificationError(f"refund accounting/balance mismatch: {checks}")
    result["refundBalances"] = {"before": before_cancel, "after": after_cancel, "checks": checks}
    result["refundExitMethod"] = "cancel_tender (the deployed contract performs the buyer refund here; refund_buyer requires an award and is not legal for this shortest path)"
    return result


def _collect_external_messages(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if "recipient" in value and "value" in value and (
            "messageType" in value or "message_type" in value or "messageFeeMode" in value
        ):
            found.append(value)
        for item in value.values():
            found.extend(_collect_external_messages(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(_collect_external_messages(item))
    return found


def _actual_protocol_fee_spent(receipt: dict[str, Any]) -> int:
    # Studio-dev v0.6 places the authoritative settled fee accounting under
    # receipt.data.fee_accounting.  Keep the older top-level shape as a
    # compatibility fallback for receipts produced by earlier SDK versions.
    data = receipt.get("data") or {}
    fee_accounting = (
        data.get("fee_accounting")
        or receipt.get("fee_accounting")
        or {}
    )
    primary_spent = fee_accounting.get("primary_fee_spent")
    if primary_spent is not None:
        return int(primary_spent)
    paid = fee_accounting.get("paid_fee_value")
    refunded = fee_accounting.get("total_refunded")
    if paid is not None and refunded is not None:
        return int(paid) - int(refunded)
    fees = receipt.get("fees") or {}
    consumed = fees.get("consumed") or {}
    return int(consumed.get("executionConsumed", 0)) + int(consumed.get("messageFeesConsumed", 0))


def run_refund_retry(
    helper: StudioLiveQualification,
    case_id: str,
    failed_cancel_tx: str,
) -> dict[str, Any]:
    _assert_sender(helper, BUYER_ADDRESS)
    tender = helper.read("get_tender", {"tender_id": case_id})
    accounting = helper.read("get_accounting")
    if tender.get("state") != "FUNDED":
        raise QualificationError(f"refund retry requires FUNDED state, got {tender.get('state')}")
    if int(tender.get("escrow_liability", 0)) != LIVE_TEST_AMOUNT:
        raise QualificationError("refund retry escrow precondition failed")
    if int(accounting.get("escrow_liability", 0)) != LIVE_TEST_AMOUNT:
        raise QualificationError("refund retry global liability precondition failed")
    if int(accounting.get("total_funded", 0)) != LIVE_TEST_AMOUNT:
        raise QualificationError("refund retry total_funded precondition failed")
    if int(accounting.get("total_buyer_refunds", 0)) != 0:
        raise QualificationError("refund retry total_buyer_refunds precondition failed")
    if int(accounting.get("total_supplier_payouts", 0)) != 0:
        raise QualificationError("refund retry total_supplier_payouts precondition failed")

    before = {
        "buyer": helper.balance(BUYER_ADDRESS),
        "contract": helper.balance(CONTRACT_ADDRESS),
        "escrow": int(tender["escrow_liability"]),
        "liability": int(accounting["escrow_liability"]),
        "totalRefunds": int(accounting["total_buyer_refunds"]),
    }
    cancel = WriteSpec(
        "cancel_tender",
        {"tender_id": case_id},
        external_recipient=BUYER_ADDRESS,
        external_value=LIVE_TEST_AMOUNT,
    )
    profile = helper.fee_profile(cancel.function_name)
    quote = helper.quote(profile, cancel)
    preflight = helper.preflight(cancel, fee_quote=quote)
    result = helper.send_once(
        cancel,
        profile=profile,
        fee_quote=quote,
        preflight_result=preflight,
        readback=lambda: {
            "tender": helper.read("get_tender", {"tender_id": case_id}),
            "accounting": helper.read("get_accounting"),
            "audit": helper.read("get_audit_events"),
        },
        label="refund.cancel_tender.retry",
    )
    receipt = result["receipt"]
    fee_spent = _actual_protocol_fee_spent(receipt)
    settled = helper.wait_for_balance_deltas(
        {
            BUYER_ADDRESS: (before["buyer"], LIVE_TEST_AMOUNT - fee_spent),
            CONTRACT_ADDRESS: (before["contract"], -LIVE_TEST_AMOUNT),
        },
        label="refund-retry",
    )
    after_readback = result["readback"]
    after = {
        "buyer": settled[BUYER_ADDRESS],
        "contract": settled[CONTRACT_ADDRESS],
        "escrow": int(after_readback["tender"]["escrow_liability"]),
        "liability": int(after_readback["accounting"]["escrow_liability"]),
        "totalRefunds": int(after_readback["accounting"]["total_buyer_refunds"]),
    }
    messages = _collect_external_messages(receipt)
    matching = [
        message for message in messages
        if str(message.get("recipient", "")).lower() == BUYER_ADDRESS.lower()
        and int(message.get("value", 0)) == LIVE_TEST_AMOUNT
    ]
    checks = {
        "externalMessageValue": LIVE_TEST_AMOUNT if matching else 0,
        "contractDelta": before["contract"] - after["contract"],
        "escrowDelta": before["escrow"] - after["escrow"],
        "liabilityDelta": before["liability"] - after["liability"],
        "refundAccountingDelta": after["totalRefunds"] - before["totalRefunds"],
    }
    if any(value != LIVE_TEST_AMOUNT for value in checks.values()):
        raise QualificationError(f"refund retry proof mismatch: {checks}")
    result["failedCancelTx"] = failed_cancel_tx
    result["before"] = before
    result["after"] = after
    result["buyerNetBalanceDelta"] = after["buyer"] - before["buyer"]
    result["protocolFeesSpentByBuyer"] = fee_spent
    result["externalMessages"] = messages
    result["triggeredTransactions"] = receipt.get("triggered_transactions", [])
    fee_accounting = (
        (receipt.get("data") or {}).get("fee_accounting")
        or receipt.get("fee_accounting")
        or {}
    )
    consumed = (receipt.get("fees") or {}).get("consumed") or {}
    result["messageFeesBudget"] = (
        fee_accounting.get("message_fee_budget")
        or consumed.get("messageFeesBudgetTotal")
    )
    result["messageFeesConsumed"] = (
        fee_accounting.get("message_fee_consumed")
        or consumed.get("messageFeesConsumed")
    )
    result["primaryFeeSpent"] = fee_accounting.get("primary_fee_spent")
    result["allocationMatched"] = bool(matching)
    result["checks"] = checks
    return result


def run_payout(buyer: StudioLiveQualification, supplier: StudioLiveQualification, case_id: str) -> dict[str, Any]:
    _assert_sender(buyer, BUYER_ADDRESS)
    _assert_sender(supplier, SUPPLIER_ADDRESS)
    if case_id in buyer.read("get_tender_ids"):
        raise QualificationError(f"case already exists: {case_id}")

    result: dict[str, Any] = {"caseId": case_id}
    create = WriteSpec("create_tender", create_tender_kwargs(case_id))
    result["create"] = buyer.send_once(
        create,
        readback=lambda: buyer.read("get_tender", {"tender_id": case_id}),
        label="payout.create_tender",
    )
    requirement = WriteSpec("add_requirement", requirement_kwargs(case_id, semantic=True))
    result["addRequirement"] = buyer.send_once(
        requirement,
        readback=lambda: buyer.read("get_requirements", {"tender_id": case_id}),
        label="payout.add_requirement",
    )
    result["freeze"] = buyer.send_once(
        WriteSpec("freeze_tender", {"tender_id": case_id}),
        readback=lambda: buyer.read("get_tender", {"tender_id": case_id}),
        label="payout.freeze_tender",
    )
    result["fund"] = buyer.send_once(
        WriteSpec("fund_tender", {"tender_id": case_id}, LIVE_TEST_AMOUNT),
        readback=lambda: buyer.read("get_tender", {"tender_id": case_id}),
        label="payout.fund_tender",
    )

    bid_id = f"{case_id}:BID-1"
    bid_hash = _hash_fixture(f"{bid_id}:controlled-bid")
    result["submitBid"] = supplier.send_once(
        WriteSpec("submit_bid", {
            "bid_id": bid_id,
            "tender_id": case_id,
            "price": LIVE_TEST_AMOUNT,
            "currency": "GEN",
            "delivery_commitment": "One standard controlled qualification item delivered before deadline",
            "requirement_responses": "Exactly one unit; fully compliant with the frozen requirement.",
            "submitted_at": "2026-01-01T00:00:00Z",
            "bid_hash": bid_hash,
        }),
        readback=lambda: buyer.read("get_bids", {"tender_id": case_id}),
        label="payout.submit_bid",
    )
    evidence_id = f"{bid_id}:EVIDENCE-1"
    evidence_hash = _hash_fixture(f"{evidence_id}:controlled-evidence")
    result["bidEvidence"] = supplier.send_once(
        WriteSpec("add_bid_evidence", {
            "bid_id": bid_id,
            "evidence_id": evidence_id,
            "authority": "Procura controlled qualification fixture",
            "source_url": "https://example.com/procura-controlled-qualification/bid-1",
            "content_sha256": evidence_hash,
            "content_byte_length": 64,
            "observed_at": "2026-01-01T00:00:00Z",
            "published_at": "2026-01-01T00:00:00Z",
            "evidence_type": "CONTROLLED_FIXTURE",
        }),
        readback=lambda: buyer.read("get_evidence", {"entity_type": "BID", "entity_id": bid_id}),
        label="payout.add_bid_evidence",
    )
    result["beginEvaluation"] = buyer.send_once(
        WriteSpec("begin_bid_evaluation", {"tender_id": case_id}),
        readback=lambda: buyer.read("get_tender", {"tender_id": case_id}),
        label="payout.begin_bid_evaluation",
    )
    result["adjudication"] = buyer.send_once(
        WriteSpec("adjudicate_requirement", {
            "bid_id": bid_id,
            "requirement_id": f"{case_id}:REQ-1",
            "evidence_snapshot_root": _hash_fixture(f"{case_id}:bid-snapshot"),
        }),
        readback=lambda: buyer.read("get_adjudication", {
            "bid_id": bid_id,
            "requirement_id": f"{case_id}:REQ-1",
        }),
        label="payout.adjudicate_requirement",
    )
    result["finalizeEvaluation"] = buyer.send_once(
        WriteSpec("finalize_bid_evaluation", {"tender_id": case_id}),
        readback=lambda: buyer.read("get_bids", {"tender_id": case_id}),
        label="payout.finalize_bid_evaluation",
    )
    award_id = f"{case_id}:AWARD-1"
    result["award"] = buyer.send_once(
        WriteSpec("award_bid", {
            "tender_id": case_id,
            "award_id": award_id,
            "winning_bid_id": bid_id,
            "awarded_specification": "One standard controlled qualification item",
            "payment_milestones": str(LIVE_TEST_AMOUNT),
            "delivery_deadline": "9999-12-31T23:59:59Z",
            "award_hash": _hash_fixture(f"{award_id}:controlled-award"),
        }),
        readback=lambda: buyer.read("get_award", {"award_id": award_id}),
        label="payout.award_bid",
    )
    result["acceptAward"] = supplier.send_once(
        WriteSpec("accept_award", {"award_id": award_id}),
        readback=lambda: buyer.read("get_award", {"award_id": award_id}),
        label="payout.accept_award",
    )
    delivery_id = f"{case_id}:DELIVERY-1"
    result["delivery"] = supplier.send_once(
        WriteSpec("create_delivery", {
            "delivery_id": delivery_id,
            "award_id": award_id,
            "delivery_reference": "CONTROLLED-DELIVERY-1",
            "delivered_items": "One standard controlled qualification item",
            "quantity": 1,
            "serial_identifiers": "CONTROLLED-QUALIFICATION-1",
            "submitted_at": "2026-01-02T00:00:00Z",
        }),
        readback=lambda: buyer.read("get_delivery", {"delivery_id": delivery_id}),
        label="payout.create_delivery",
    )
    delivery_evidence_id = f"{delivery_id}:EVIDENCE-1"
    result["deliveryEvidence"] = supplier.send_once(
        WriteSpec("add_delivery_evidence", {
            "delivery_id": delivery_id,
            "evidence_id": delivery_evidence_id,
            "authority": "Procura controlled qualification fixture",
            "source_url": "https://example.com/procura-controlled-qualification/delivery-1",
            "content_sha256": _hash_fixture(f"{delivery_evidence_id}:controlled-evidence"),
            "content_byte_length": 64,
            "observed_at": "2026-01-02T00:00:00Z",
            "published_at": "2026-01-02T00:00:00Z",
            "evidence_type": "CONTROLLED_FIXTURE",
        }),
        readback=lambda: buyer.read("get_evidence", {"entity_type": "DELIVERY", "entity_id": delivery_id}),
        label="payout.add_delivery_evidence",
    )
    result["beginInspection"] = buyer.send_once(
        WriteSpec("begin_inspection", {"delivery_id": delivery_id}),
        readback=lambda: buyer.read("get_delivery", {"delivery_id": delivery_id}),
        label="payout.begin_inspection",
    )
    result["deliveryAdjudication"] = buyer.send_once(
        WriteSpec("adjudicate_delivery", {
            "delivery_id": delivery_id,
            "evidence_snapshot_root": _hash_fixture(f"{case_id}:delivery-snapshot"),
        }),
        readback=lambda: buyer.read("get_delivery_adjudication", {"delivery_id": delivery_id}),
        label="payout.adjudicate_delivery",
    )
    result["acceptDelivery"] = buyer.send_once(
        WriteSpec("accept_delivery", {"delivery_id": delivery_id}),
        readback=lambda: buyer.read("get_delivery", {"delivery_id": delivery_id}),
        label="payout.accept_delivery",
    )

    before = {
        "supplier": buyer.balance(SUPPLIER_ADDRESS),
        "contract": buyer.balance(CONTRACT_ADDRESS),
        "award": buyer.read("get_payments", {"award_id": award_id}),
        "accounting": buyer.read("get_accounting"),
    }
    settle_spec = WriteSpec(
        "settle_award",
        {"award_id": award_id},
        external_recipient=SUPPLIER_ADDRESS,
        external_value=LIVE_TEST_AMOUNT,
    )
    settle_profile = buyer.fee_profile(settle_spec.function_name)
    settle_quote = buyer.quote(settle_profile, settle_spec)
    settle_preflight = buyer.preflight(settle_spec, fee_quote=settle_quote)
    result["settlePreflight"] = settle_preflight
    result["settle"] = buyer.send_once(
        settle_spec,
        profile=settle_profile,
        fee_quote=settle_quote,
        preflight_result=settle_preflight,
        readback=lambda: {
            "award": buyer.read("get_payments", {"award_id": award_id}),
            "accounting": buyer.read("get_accounting"),
            "audit": buyer.read("get_audit_events"),
        },
        label="payout.settle_award",
    )
    settled_balances = buyer.wait_for_balance_deltas(
        {
            SUPPLIER_ADDRESS: (before["supplier"], LIVE_TEST_AMOUNT),
            CONTRACT_ADDRESS: (before["contract"], -LIVE_TEST_AMOUNT),
        },
        label="payout",
    )
    after = {
        "supplier": settled_balances[SUPPLIER_ADDRESS],
        "contract": settled_balances[CONTRACT_ADDRESS],
        "award": result["settle"]["readback"]["award"],
        "accounting": result["settle"]["readback"]["accounting"],
    }
    checks = {
        "supplierPayoutDelta": after["supplier"] - before["supplier"],
        "contractPayoutDelta": before["contract"] - after["contract"],
        "escrowDelta": int(before["award"]["escrow_remaining"]) - int(after["award"]["escrow_remaining"]),
        "liabilityDelta": int(before["accounting"]["escrow_liability"]) - int(after["accounting"]["escrow_liability"]),
        "accountingPayoutDelta": int(after["accounting"]["total_supplier_payouts"]) - int(before["accounting"]["total_supplier_payouts"]),
    }
    if any(value != LIVE_TEST_AMOUNT for value in checks.values()):
        raise QualificationError(f"payout accounting/balance mismatch: {checks}")
    result["payoutBalances"] = {"before": before, "after": after, "checks": checks}
    return result


def main() -> int:
    args = _parser().parse_args()
    helper = _load_helper(args.keystore, args.supplier_password_env, args.journal)
    if args.mode == "schema":
        print(json.dumps(_json_safe(helper.schema), sort_keys=True))
        return 0

    case_id = args.case_id or _utc_case_id("REFUND" if args.mode != "payout" else "PAYOUT")
    if args.mode == "preflight-create":
        spec = WriteSpec("create_tender", create_tender_kwargs(case_id))
        preflight = helper.gen_call_write(spec)
        output = {
            "network": NETWORK,
            "chainId": CHAIN_ID,
            "rpc": RPC,
            "caseId": case_id,
            "schema": helper._expected_params("create_tender"),
            "kwargsTypes": {key: type(value).__name__ for key, value in spec.kwargs.items()},
            "hashPythonType": type(spec.kwargs["tender_hash"]).__name__,
            "hashValue": spec.kwargs["tender_hash"],
            "preflight": "PASS" if preflight["statusCode"] == 0 else "FAIL",
            "statusCode": preflight["statusCode"],
            "statusCodeSource": preflight.get("statusCodeSource", "raw status.code"),
            "statusMessage": preflight.get("statusMessage"),
            "rpcCode": preflight.get("rpcCode"),
            "calldataSha256": preflight["calldataSha256"],
            "calldataLength": preflight["calldataLength"],
            "rpcDataSha256": preflight["rpcDataSha256"],
            "rpcDataLength": preflight["rpcDataLength"],
            "decodedCalldata": preflight["decodedCalldata"],
            "genvm": preflight.get("genvmResult") or preflight.get("result"),
            "rpcError": preflight.get("rpcError"),
        }
        print(json.dumps(_redact_sensitive(_json_safe(output)), sort_keys=True))
        return 0 if preflight["statusCode"] == 0 else 1
    if args.mode == "refund":
        result = run_refund(helper, case_id, resume_create_tx=args.resume_create_tx)
    elif args.mode == "refund-retry":
        if not args.failed_cancel_tx:
            raise QualificationError("--failed-cancel-tx is required for refund-retry mode")
        result = run_refund_retry(helper, case_id, args.failed_cancel_tx)
    else:
        if not args.supplier_keystore:
            raise QualificationError("--supplier-keystore is required for payout mode")
        supplier = _load_helper(args.supplier_keystore, args.supplier_password_env, args.journal)
        result = run_payout(helper, supplier, case_id)
    print(json.dumps(_json_safe(result), sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except QualificationError as exc:
        print(json.dumps({"qualification": "STOPPED", "error": str(exc)}))
        raise SystemExit(1)
