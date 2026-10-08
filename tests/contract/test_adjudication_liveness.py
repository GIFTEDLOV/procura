import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / "contracts" / "Procura.py").read_text(encoding="utf-8")
TREE = ast.parse(SOURCE)


def _method(name: str) -> ast.FunctionDef:
    return next(
        node
        for node in ast.walk(TREE)
        if isinstance(node, ast.FunctionDef) and node.name == name
    )


def _body(name: str) -> str:
    return ast.get_source_segment(SOURCE, _method(name)) or ""


def _statement_call_index(method: ast.FunctionDef, attribute: str) -> int:
    for index, node in enumerate(method.body):
        for child in ast.walk(node):
            if not isinstance(child, ast.Call) or not isinstance(child.func, ast.Attribute):
                continue
            if child.func.attr == attribute:
                return index
    raise AssertionError(f"{attribute} call not found")


def _assignment_index(method: ast.FunctionDef) -> int:
    return _storage_assignment_index(method, "adjudications")


def _storage_assignment_index(method: ast.FunctionDef, storage_name: str) -> int:
    for index, node in enumerate(method.body):
        if not isinstance(node, ast.Assign):
            continue
        if any(
            isinstance(target, ast.Subscript)
            and isinstance(target.value, ast.Attribute)
            and target.value.attr == storage_name
            for target in node.targets
        ):
            return index
    raise AssertionError(f"{storage_name} record write not found")


def test_successful_requirement_adjudication_is_immutable():
    body = _body("adjudicate_requirement")
    assert 'if adjudication_id in self.adjudications:' in body
    assert '_fail("requirement already adjudicated")' in body
    assert 'adjudication_id = bid_id + ":" + requirement_id' in body
    assert "requirement.version" in body
    assert "evidence_snapshot_root" in body
    assert body.count('self.adjudications[adjudication_id] = Adjudication(') == 1


def test_replay_guard_runs_before_semantic_execution_and_record_write():
    method = _method("adjudicate_requirement")
    guard_index = next(
        index
        for index, node in enumerate(method.body)
        if isinstance(node, ast.If)
        and "adjudication_id in self.adjudications" in ast.unparse(node.test)
    )
    semantic_index = _statement_call_index(method, "_semantic_bid_vector")
    record_index = _assignment_index(method)
    assert guard_index < semantic_index < record_index


def test_failed_or_undetermined_attempts_remain_retryable():
    body = _body("adjudicate_requirement")
    semantic_index = body.index("vector = self._semantic_bid_vector")
    record_index = body.index("self.adjudications[adjudication_id] = Adjudication")
    assert semantic_index < record_index
    assert "attempt" not in body.lower()
    assert "undetermined" not in body.lower()


def test_finalize_still_requires_a_successfully_stored_adjudication():
    body = _body("finalize_bid_evaluation")
    assert 'if key not in self.adjudications:' in body
    assert 'all frozen requirements must be adjudicated' in body


def test_successful_delivery_adjudication_is_immutable():
    body = _body("adjudicate_delivery")
    assert 'if adjudication_id in self.delivery_adjudications:' in body
    assert '_fail("delivery already adjudicated")' in body
    assert 'adjudication_id = delivery_id + ":inspection"' in body
    assert body.count('self.delivery_adjudications[adjudication_id] = DeliveryAdjudication(') == 1


def test_delivery_retry_guard_runs_before_semantic_execution_and_record_write():
    method = _method("adjudicate_delivery")
    guard_index = next(
        index
        for index, node in enumerate(method.body)
        if isinstance(node, ast.If)
        and "adjudication_id in self.delivery_adjudications" in ast.unparse(node.test)
    )
    semantic_index = _statement_call_index(method, "_semantic_delivery_vector")
    record_index = _storage_assignment_index(method, "delivery_adjudications")
    assert guard_index < semantic_index < record_index


def test_failed_delivery_attempts_remain_retryable():
    body = _body("adjudicate_delivery")
    semantic_index = body.index("vector = self._semantic_delivery_vector")
    record_index = body.index("self.delivery_adjudications[adjudication_id] = DeliveryAdjudication")
    assert semantic_index < record_index
    assert "attempt" not in body.lower()
    assert "undetermined" not in body.lower()


def test_no_evaluation_expiry_or_admin_recovery_was_added():
    assert "def expire_tender" not in SOURCE
    assert "def recover_evaluation" not in SOURCE
    assert "TENDER_EVALUATING" not in _body("cancel_tender")
    assert "TENDER_EVALUATING" not in _body("refund_buyer")
