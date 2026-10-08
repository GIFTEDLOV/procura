from pathlib import Path

import pytest

from scripts.qualification.studio_live_qualification import (
    QualificationError,
    StudioLiveQualification,
    WriteSpec,
    _is_missing_adjudication_error,
)


def _helper(tmp_path: Path) -> StudioLiveQualification:
    helper = object.__new__(StudioLiveQualification)
    helper.journal = tmp_path / "retry.jsonl"
    return helper


def _spec() -> WriteSpec:
    return WriteSpec(
        "adjudicate_requirement",
        {"bid_id": "BID-1", "requirement_id": "REQ-1", "evidence_snapshot_root": "a" * 64},
    )


def test_missing_record_error_is_the_only_absence_signal():
    assert _is_missing_adjudication_error(
        RuntimeError("gen_call failed (code=-32000): execution failed")
    )
    assert not _is_missing_adjudication_error(RuntimeError("connection reset"))


def test_no_record_and_processing_state_permits_one_retry(tmp_path):
    helper = _helper(tmp_path)
    sent = []
    helper.send_once = lambda spec, **kwargs: sent.append((spec, kwargs)) or {"txHash": "retry"}

    def missing_record():
        raise RuntimeError("gen_call failed (code=-32000): execution failed")

    result = helper.send_semantic_once_or_retry(
        _spec(),
        record_readback=missing_record,
        processing_state_readback=lambda: {"state": "EVALUATING"},
        processing_states={"EVALUATING"},
        label="test.bid",
    )
    assert result == {"txHash": "retry"}
    assert len(sent) == 1


def test_existing_canonical_record_refuses_retry_before_broadcast(tmp_path):
    helper = _helper(tmp_path)
    helper.send_once = lambda *args, **kwargs: pytest.fail("broadcast must not occur")
    with pytest.raises(QualificationError, match="canonical result already exists"):
        helper.send_semantic_once_or_retry(
            _spec(),
            record_readback=lambda: {"canonical_verdict": "INCONCLUSIVE"},
            processing_state_readback=lambda: {"state": "EVALUATING"},
            processing_states={"EVALUATING"},
            label="test.bid",
        )


def test_unreadable_canonical_state_fails_closed(tmp_path):
    helper = _helper(tmp_path)
    helper.send_once = lambda *args, **kwargs: pytest.fail("broadcast must not occur")
    with pytest.raises(QualificationError, match="cannot determine"):
        helper.send_semantic_once_or_retry(
            _spec(),
            record_readback=lambda: (_ for _ in ()).throw(RuntimeError("connection reset")),
            processing_state_readback=lambda: {"state": "EVALUATING"},
            processing_states={"EVALUATING"},
            label="test.bid",
        )


def test_delivery_retry_requires_under_inspection(tmp_path):
    helper = _helper(tmp_path)
    helper.send_once = lambda *args, **kwargs: pytest.fail("broadcast must not occur")
    with pytest.raises(QualificationError, match="processing state"):
        helper.send_semantic_once_or_retry(
            WriteSpec(
                "adjudicate_delivery",
                {"delivery_id": "DELIVERY-1", "evidence_snapshot_root": "b" * 64},
            ),
            record_readback=lambda: None,
            processing_state_readback=lambda: {"state": "ACCEPTED"},
            processing_states={"UNDER_INSPECTION"},
            label="test.delivery",
        )
