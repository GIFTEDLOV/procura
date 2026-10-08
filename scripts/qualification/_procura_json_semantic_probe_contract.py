# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""Temporary Procura semantic compatibility probe.

This file is intentionally disposable.  It copies the production bounded
semantic prompts, strict vector parsers, independent validator calls, and
default 5jyc nondeterminism API without procurement state transitions.
"""

import json

import genlayer as gl
from genlayer import *


def _fail(message: str):
    raise gl.vm.UserError(message)


def _bool(value, field: str) -> bool:
    if type(value) is not bool:
        _fail(field + " must be a strict boolean")
    return value


def _parse_bid_vector(raw):
    try:
        value = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        _fail("malformed semantic output")
    fields = (
        "requirement_satisfied",
        "mandatory_requirement_breached",
        "claimed_equivalence_valid",
        "certification_requirement_met",
        "material_conflict",
        "evidence_sufficient",
    )
    if not isinstance(value, dict) or set(value.keys()) != set(fields):
        _fail("semantic vector fields are not exact")
    return {field: _bool(value[field], field) for field in fields}


def _parse_delivery_vector(raw):
    try:
        value = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        _fail("malformed delivery semantic output")
    fields = (
        "awarded_specification_matched",
        "authorized_substitution",
        "material_specification_difference",
        "quantity_conformant",
        "inspection_evidence_sufficient",
    )
    if not isinstance(value, dict) or set(value.keys()) != set(fields):
        _fail("delivery semantic vector fields are not exact")
    return {field: _bool(value[field], field) for field in fields}


class ProcuraJsonSemanticProbe(gl.contract.Contract):
    requirement_result: str
    delivery_result: str

    def __init__(self):
        self.requirement_result = ""
        self.delivery_result = ""

    @gl.public.write
    def probe_requirement(
        self,
        requirement_description: str,
        requirement_type: str,
        expected_value: str,
        unit: str,
        supplier_response: str,
        evidence_snapshot_root: str,
    ):
        prompt = (
            "You are a bounded procurement evidence adjudicator. Return JSON only. "
            "Do not decide price, winner, payment, identity, deadlines, or state transitions.\n"
            "Frozen requirement:\n" + requirement_description + "\n"
            "Type=" + requirement_type + "; expected=" + expected_value + "; unit=" + unit + "\n"
            "Supplier response:\n" + supplier_response + "\n"
            "Authenticated evidence root=" + evidence_snapshot_root + "\n"
            "Return exactly these boolean fields: requirement_satisfied, mandatory_requirement_breached, "
            "claimed_equivalence_valid, certification_requirement_met, material_conflict, evidence_sufficient."
        )

        def leader_fn():
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leader_result):
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                leader = _parse_bid_vector(leader_result.calldata)
                independent = _parse_bid_vector(
                    gl.nondet.exec_prompt(prompt, response_format="json")
                )
            except Exception:
                return False
            return leader == independent

        raw = gl.vm.run_nondet_default(leader_fn, validator_fn)
        self.requirement_result = json.dumps(_parse_bid_vector(raw), sort_keys=True)

    @gl.public.write
    def probe_delivery(
        self,
        awarded_specification: str,
        delivered_specification: str,
        quantity: str,
        evidence_snapshot_root: str,
    ):
        prompt = (
            "You are a bounded procurement inspection adjudicator. Return JSON only. "
            "Do not decide payment amounts, recipients, deadlines, or state transitions.\n"
            "Awarded specification:\n" + awarded_specification + "\n"
            "Delivered specification:\n" + delivered_specification + "\n"
            "Delivered quantity=" + quantity + "\n"
            "Authenticated evidence root=" + evidence_snapshot_root + "\n"
            "Return exactly these boolean fields: awarded_specification_matched, authorized_substitution, "
            "material_specification_difference, quantity_conformant, inspection_evidence_sufficient."
        )

        def leader_fn():
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leader_result):
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                leader = _parse_delivery_vector(leader_result.calldata)
                independent = _parse_delivery_vector(
                    gl.nondet.exec_prompt(prompt, response_format="json")
                )
            except Exception:
                return False
            return leader == independent

        raw = gl.vm.run_nondet_default(leader_fn, validator_fn)
        self.delivery_result = json.dumps(_parse_delivery_vector(raw), sort_keys=True)

    @gl.public.view
    def get_requirement_result(self) -> str:
        return self.requirement_result

    @gl.public.view
    def get_delivery_result(self) -> str:
        return self.delivery_result
