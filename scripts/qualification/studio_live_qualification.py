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
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from eth_account import Account
from genlayer_py import create_client
from genlayer_py.abi import calldata
from genlayer_py.abi.calldata.encoder import encode
from genlayer_py.chains import studio_devnet
from genlayer_py.contracts.utils import make_calldata_object
from genlayer_py.transactions.actions import is_successful
from web3 import Web3


NETWORK = "studio-dev"
CHAIN_ID = 61997
RPC = "https://studio-dev.genlayer.com/api"
CONTRACT_ADDRESS = "0x25cDb9C8Bf6A647Cf964dA999d82fD802057f835"
BUYER_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
SUPPLIER_ADDRESS = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8"
LIVE_TEST_AMOUNT = 1_000_000_000_000_000
PASSWORD_ENV = "PROCURA_QUALIFICATION_KEYSTORE_PASSWORD"
DEFAULT_JOURNAL = Path(tempfile.gettempdir()) / "procura-studio-live-qualification.jsonl"


class QualificationError(RuntimeError):
    """A qualification precondition, execution, or accounting check failed."""


@dataclass(frozen=True)
class WriteSpec:
    function_name: str
    kwargs: dict[str, Any]
    value: int = 0


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, bytes):
        return "0x" + value.hex()
    if isinstance(value, int):
        return str(value)
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

    def preflight(self, spec: WriteSpec) -> dict[str, Any]:
        self.validate_write(spec)
        args = self._ordered_args(spec.function_name, spec.kwargs)
        try:
            estimate = self.client.estimate_transaction_fees_for_write(
                CONTRACT_ADDRESS,
                spec.function_name,
                account=self.account,
                args=args,
                value=spec.value,
            )
        except Exception as exc:
            raise QualificationError(
                "exact SDK write preflight failed before broadcast: "
                f"{type(exc).__name__}: {exc}"
            ) from exc
        fee_value_raw = estimate.get("feeValue")
        if fee_value_raw is None:
            fee_value_raw = estimate.get("fee_value")
        if fee_value_raw is None:
            raise QualificationError("fee quote did not contain feeValue")
        fee_value = int(fee_value_raw)
        if fee_value <= 0:
            raise QualificationError(f"non-positive fee quote: {fee_value}")
        distribution = estimate.get("distribution")
        if not isinstance(distribution, dict) or not distribution:
            raise QualificationError("fee distribution is missing or empty")
        return {
            "feeValue": fee_value,
            "distribution": distribution,
            "kwargsTypes": {key: type(value).__name__ for key, value in spec.kwargs.items()},
            "argsTypes": [type(value).__name__ for value in args],
            "args": args,
        }

    def send_once(
        self,
        spec: WriteSpec,
        *,
        readback: Callable[[], Any] | None = None,
        label: str,
    ) -> dict[str, Any]:
        quote = self.preflight(spec)
        fees = {"distribution": quote["distribution"], "feeValue": quote["feeValue"]}
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
            "sender": self.account.address,
        }
        _append_journal(self.journal, {"event": "fee_quote", "label": label, **canonical})

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
    parser.add_argument("mode", choices=("schema", "preflight-create", "refund", "payout"))
    parser.add_argument("--keystore", required=True, help="Encrypted keystore for the active signer")
    parser.add_argument("--supplier-keystore", help="Encrypted supplier keystore for payout mode")
    parser.add_argument("--case-id")
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


def run_refund(helper: StudioLiveQualification, case_id: str) -> dict[str, Any]:
    _assert_sender(helper, BUYER_ADDRESS)
    if case_id in helper.read("get_tender_ids"):
        raise QualificationError(f"case already exists: {case_id}")

    create = WriteSpec("create_tender", create_tender_kwargs(case_id))
    helper.preflight(create)
    result: dict[str, Any] = {"caseId": case_id, "create": helper.send_once(
        create,
        readback=lambda: helper.read("get_tender", {"tender_id": case_id}),
        label="refund.create_tender",
    )}

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
    cancel = WriteSpec("cancel_tender", {"tender_id": case_id})
    result["refund"] = helper.send_once(
        cancel,
        readback=lambda: {
            "tender": helper.read("get_tender", {"tender_id": case_id}),
            "accounting": helper.read("get_accounting"),
            "audit": helper.read("get_audit_events"),
        },
        label="refund.cancel_tender",
    )
    after_cancel = {
        "buyer": helper.balance(BUYER_ADDRESS),
        "contract": helper.balance(CONTRACT_ADDRESS),
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
    result["settle"] = buyer.send_once(
        WriteSpec("settle_award", {"award_id": award_id}),
        readback=lambda: {
            "award": buyer.read("get_payments", {"award_id": award_id}),
            "accounting": buyer.read("get_accounting"),
            "audit": buyer.read("get_audit_events"),
        },
        label="payout.settle_award",
    )
    after = {
        "supplier": buyer.balance(SUPPLIER_ADDRESS),
        "contract": buyer.balance(CONTRACT_ADDRESS),
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
        quote = helper.preflight(spec)
        print(json.dumps({
            "network": NETWORK,
            "chainId": CHAIN_ID,
            "rpc": RPC,
            "caseId": case_id,
            "schema": helper._expected_params("create_tender"),
            "kwargsTypes": quote["kwargsTypes"],
            "hashPythonType": type(spec.kwargs["tender_hash"]).__name__,
            "hashValue": spec.kwargs["tender_hash"],
            "preflight": "PASS",
            "feeValue": quote["feeValue"],
        }, sort_keys=True))
        return 0
    if args.mode == "refund":
        result = run_refund(helper, case_id)
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
