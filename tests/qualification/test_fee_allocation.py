import json
from pathlib import Path

from scripts.qualification.studio_live_qualification import (
    BUYER_ADDRESS,
    CONTRACT_ADDRESS,
    LIVE_TEST_AMOUNT,
    SUPPLIER_ADDRESS,
    StudioLiveQualification,
    WriteSpec,
    _actual_protocol_fee_spent,
)


PROFILE = json.loads(
    (Path(__file__).resolve().parents[2] / "evidence" / "studio-dev-fee-profile.json").read_text(
        encoding="utf-8"
    )
)["methods"]


def _helper() -> StudioLiveQualification:
    return object.__new__(StudioLiveQualification)


def test_cancel_tender_gets_exact_external_refund_allocation():
    spec = WriteSpec(
        "cancel_tender",
        {"tender_id": "PROCURA-LIVE-REFUND-TEST"},
        external_recipient=BUYER_ADDRESS,
        external_value=LIVE_TEST_AMOUNT,
    )
    allocation = StudioLiveQualification._external_allocation(spec, PROFILE["cancel_tender"])
    assert allocation["messageType"] == 0
    assert allocation["onAcceptance"] is False
    assert allocation["recipient"] == BUYER_ADDRESS
    assert allocation["callKey"] == "0x" + ("0" * 64)
    assert allocation["budget"] == 500_000 * 250_000_000


def test_supplier_settlement_gets_supplier_external_allocation():
    spec = WriteSpec(
        "settle_award",
        {"award_id": "PROCURA-LIVE-PAYOUT-TEST:AWARD-1"},
        external_recipient=SUPPLIER_ADDRESS,
        external_value=LIVE_TEST_AMOUNT,
    )
    allocation = StudioLiveQualification._external_allocation(spec, PROFILE["settle_award"])
    assert allocation["messageType"] == 0
    assert allocation["onAcceptance"] is False
    assert allocation["recipient"] == SUPPLIER_ADDRESS
    assert allocation["callKey"] == "0x" + ("0" * 64)
    assert allocation["budget"] == 500_000 * 250_000_000


def test_non_message_write_has_no_external_allocations():
    helper = _helper()
    options = helper._fee_options(
        WriteSpec("create_tender", {"tender_id": "ordinary"}),
        PROFILE["create_tender"],
    )
    assert "messageAllocations" not in options
    assert options["totalMessageFees"] == 0


def test_studio_receipt_nested_fee_accounting_is_authoritative():
    receipt = {
        "data": {
            "fee_accounting": {
                "primary_fee_spent": "126308750000823",
                "message_fee_consumed": "125000000000000",
            }
        },
        "fees": {"consumed": {"executionConsumed": "0", "messageFeesConsumed": "0"}},
    }
    assert _actual_protocol_fee_spent(receipt) == 126308750000823
