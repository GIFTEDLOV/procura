# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""Procura: verifiable procurement from requirement to payment.

The contract keeps deterministic procurement, permissions, deadlines, hashes,
and accounting on-chain. GenLayer is used only for bounded semantic vectors
over authenticated evidence. Every value exit is checks-effects-interactions
and uses the current GenLayer external-message primitive.
"""

import json
import re
from dataclasses import dataclass

import genlayer as gl
from genlayer import *
from genlayer.storage import TreeMap


SCHEMA_VERSION = "PROCUREMENT_V1"
ZERO_ADDRESS = "0x" + "0" * 40
HEX64 = re.compile(r"^[0-9a-f]{64}$")
MAX_EVIDENCE_BYTES = u256(10_000_000)

TENDER_DRAFT = "DRAFT"
TENDER_FROZEN = "FROZEN"
TENDER_FUNDED = "FUNDED"
TENDER_EVALUATING = "EVALUATING"
TENDER_EVALUATED = "EVALUATED"
TENDER_AWARDED = "AWARDED"
TENDER_CANCELLED = "CANCELLED"

BID_DRAFT = "DRAFT"
BID_SUBMITTED = "SUBMITTED"
BID_UNDER_EVALUATION = "UNDER_EVALUATION"
BID_COMPLIANT = "COMPLIANT"
BID_NON_COMPLIANT = "NON_COMPLIANT"
BID_WITHDRAWN = "WITHDRAWN"
BID_AWARDED = "AWARDED"
BID_NOT_AWARDED = "NOT_AWARDED"

DELIVERY_PENDING = "PENDING"
DELIVERY_IN_TRANSIT = "IN_TRANSIT"
DELIVERY_DELIVERED = "DELIVERED"
DELIVERY_UNDER_INSPECTION = "UNDER_INSPECTION"
DELIVERY_ACCEPTED = "ACCEPTED"
DELIVERY_REJECTED = "REJECTED"
DELIVERY_DISPUTED = "DISPUTED"

VERDICT_COMPLIANT = "COMPLIANT"
VERDICT_MATERIALLY_NON_COMPLIANT = "MATERIALLY_NON_COMPLIANT"
VERDICT_EQUIVALENT_ACCEPTABLE = "EQUIVALENT_ACCEPTABLE"
VERDICT_INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
VERDICT_INCONCLUSIVE = "INCONCLUSIVE"

DELIVERY_ACCEPTED_VERDICT = "DELIVERY_ACCEPTED"
DELIVERY_MISMATCH_VERDICT = "MATERIAL_DELIVERY_MISMATCH"
DELIVERY_EQUIVALENT_VERDICT = "AUTHORIZED_EQUIVALENT"
DELIVERY_INSUFFICIENT_VERDICT = "INSUFFICIENT_EVIDENCE"
DELIVERY_INCONCLUSIVE_VERDICT = "INCONCLUSIVE"


def _emit_external_transfer(recipient: Address, amount: u256) -> None:
    # Deferred because the direct runner injects message context at call time.
    @gl.evm.contract_interface
    class Recipient:
        class View:
            pass

        class Write:
            pass

    Recipient(recipient).emit_transfer(value=amount)


@gl.storage.allow
@dataclass
class Tender:
    tender_id: str
    buyer: Address
    title: str
    description: str
    category: str
    currency_label: str
    budget_ceiling: u256
    bid_deadline: str
    evaluation_deadline: str
    delivery_deadline: str
    required_certifications: gl.storage.DynArray[str]
    equivalence_policy: str
    evaluation_policy: str
    payment_policy: str
    supplier_bond_policy: str
    state: str
    version: u32
    tender_hash: str
    total_funded: u256
    escrow_liability: u256


@gl.storage.allow
@dataclass
class Requirement:
    requirement_id: str
    tender_id: str
    title: str
    description: str
    requirement_type: str
    mandatory: bool
    operator: str
    expected_value: str
    unit: str
    equivalence_allowed: bool
    evidence_required: bool
    semantic_question: str
    materiality: str
    version: u32


@gl.storage.allow
@dataclass
class Bid:
    bid_id: str
    tender_id: str
    supplier: Address
    price: u256
    currency: str
    delivery_commitment: str
    requirement_responses: str
    submitted_at: str
    bid_hash: str
    state: str


@gl.storage.allow
@dataclass
class Evidence:
    evidence_id: str
    owner: Address
    entity_type: str
    entity_id: str
    authority: str
    source_url: str
    content_sha256: str
    content_byte_length: u256
    observed_at: str
    published_at: str
    evidence_type: str


@gl.storage.allow
@dataclass
class Adjudication:
    adjudication_id: str
    bid_id: str
    requirement_id: str
    requirement_version: u32
    evidence_snapshot_root: str
    requirement_satisfied: bool
    mandatory_requirement_breached: bool
    claimed_equivalence_valid: bool
    certification_requirement_met: bool
    material_conflict: bool
    evidence_sufficient: bool
    canonical_verdict: str
    failure_causes: str
    timestamp: str


@gl.storage.allow
@dataclass
class Award:
    award_id: str
    tender_id: str
    winning_bid_id: str
    supplier: Address
    awarded_price: u256
    awarded_specification: str
    award_hash: str
    payment_milestones: str
    delivery_deadline: str
    state: str
    funded_amount: u256
    escrow_remaining: u256
    paid_amount: u256
    refunded_amount: u256
    bond_amount: u256
    bond_returned: u256
    bond_slashed: u256
    payout_exited: bool
    refund_exited: bool
    released_milestones: str


@gl.storage.allow
@dataclass
class Delivery:
    delivery_id: str
    award_id: str
    supplier: Address
    delivery_reference: str
    delivered_items: str
    quantity: u256
    serial_identifiers: str
    submitted_at: str
    state: str


@gl.storage.allow
@dataclass
class DeliveryAdjudication:
    adjudication_id: str
    delivery_id: str
    awarded_specification: str
    delivered_specification: str
    evidence_snapshot_root: str
    awarded_specification_matched: bool
    authorized_substitution: bool
    material_specification_difference: bool
    quantity_conformant: bool
    inspection_evidence_sufficient: bool
    canonical_verdict: str
    failure_causes: str
    timestamp: str


@gl.storage.allow
@dataclass
class AuditEvent:
    event_id: str
    entity_type: str
    entity_id: str
    event_type: str
    actor: Address
    details: str
    timestamp: str


def _now() -> str:
    return str(gl.message.raw["datetime"])


def _fail(message: str):
    raise gl.vm.UserError(message)


def _nonzero(address: Address) -> None:
    if address.as_hex.lower() == ZERO_ADDRESS:
        _fail("zero address is not permitted")


def _hash(value: str, field: str) -> str:
    if not isinstance(value, str) or HEX64.fullmatch(value) is None:
        _fail(field + " must be exactly 64 lowercase hexadecimal characters")
    return value


def _source_url(value: str) -> str:
    if not isinstance(value, str) or not (value.startswith("https://") or value.startswith("http://")):
        _fail("source_url must be an http(s) URL")
    if " " in value or len(value) <= len("https://"):
        _fail("source_url is malformed")
    return value


def _allowed(value: str, values: tuple, field: str) -> None:
    if value not in values:
        _fail(field + " outside canonical enum")


def _bool(value, field: str) -> bool:
    if type(value) is not bool:
        _fail(field + " must be a strict boolean")
    return value


def _u(value: u256) -> u256:
    if value < 0:
        _fail("negative amount")
    return u256(value)


def _canonical_bid_verdict(vector: dict) -> str:
    if vector["material_conflict"] or vector["mandatory_requirement_breached"]:
        return VERDICT_MATERIALLY_NON_COMPLIANT
    if not vector["evidence_sufficient"]:
        return VERDICT_INSUFFICIENT_EVIDENCE
    if vector["claimed_equivalence_valid"] and vector["requirement_satisfied"]:
        return VERDICT_EQUIVALENT_ACCEPTABLE
    if vector["requirement_satisfied"] and vector["certification_requirement_met"]:
        return VERDICT_COMPLIANT
    return VERDICT_INCONCLUSIVE


def _canonical_delivery_verdict(vector: dict) -> str:
    if not vector["inspection_evidence_sufficient"]:
        return DELIVERY_INSUFFICIENT_VERDICT
    if vector["material_specification_difference"] and not vector["authorized_substitution"]:
        return DELIVERY_MISMATCH_VERDICT
    if vector["authorized_substitution"] and vector["awarded_specification_matched"]:
        return DELIVERY_EQUIVALENT_VERDICT
    if vector["awarded_specification_matched"] and vector["quantity_conformant"]:
        return DELIVERY_ACCEPTED_VERDICT
    return DELIVERY_INCONCLUSIVE_VERDICT


class Procura(gl.contract.Contract):
    tenders: TreeMap[str, Tender]
    tender_ids: gl.storage.DynArray[str]
    requirements: TreeMap[str, Requirement]
    requirement_ids_by_tender: TreeMap[str, gl.storage.DynArray[str]]
    bids: TreeMap[str, Bid]
    bid_ids_by_tender: TreeMap[str, gl.storage.DynArray[str]]
    evidence: TreeMap[str, Evidence]
    evidence_ids_by_entity: TreeMap[str, gl.storage.DynArray[str]]
    adjudications: TreeMap[str, Adjudication]
    adjudication_ids_by_bid: TreeMap[str, gl.storage.DynArray[str]]
    awards: TreeMap[str, Award]
    award_ids: gl.storage.DynArray[str]
    deliveries: TreeMap[str, Delivery]
    delivery_ids_by_award: TreeMap[str, gl.storage.DynArray[str]]
    delivery_adjudications: TreeMap[str, DeliveryAdjudication]
    audit_events: gl.storage.DynArray[AuditEvent]
    total_funded: u256
    escrow_liability: u256
    total_supplier_payouts: u256
    total_buyer_refunds: u256
    total_supplier_bonds: u256
    total_bond_returns: u256
    total_bond_slashes: u256

    def __init__(self):
        self.total_funded = u256(0)
        self.escrow_liability = u256(0)
        self.total_supplier_payouts = u256(0)
        self.total_buyer_refunds = u256(0)
        self.total_supplier_bonds = u256(0)
        self.total_bond_returns = u256(0)
        self.total_bond_slashes = u256(0)

    def _require_tender(self, tender_id: str) -> Tender:
        if tender_id not in self.tenders:
            _fail("unknown tender")
        return self.tenders[tender_id]

    def _require_buyer(self, tender: Tender) -> None:
        if gl.message.sender_address != tender.buyer:
            _fail("buyer permission required")

    def _require_award(self, award_id: str) -> Award:
        if award_id not in self.awards:
            _fail("unknown award")
        return self.awards[award_id]

    def _audit(self, entity_type: str, entity_id: str, event_type: str, details: str) -> None:
        event_id = entity_type + ":" + entity_id + ":" + str(len(self.audit_events))
        self.audit_events.append(
            AuditEvent(event_id, entity_type, entity_id, event_type, gl.message.sender_address, details, _now())
        )

    def _entity_key(self, entity_type: str, entity_id: str) -> str:
        return entity_type + ":" + entity_id

    def _record_evidence(
        self,
        evidence_id: str,
        owner: Address,
        entity_type: str,
        entity_id: str,
        authority: str,
        source_url: str,
        content_sha256: str,
        content_byte_length: u256,
        observed_at: str,
        published_at: str,
        evidence_type: str,
    ) -> None:
        _nonzero(owner)
        _hash(content_sha256, "content_sha256")
        _source_url(source_url)
        if evidence_id in self.evidence:
            _fail("evidence id already exists")
        if content_byte_length == u256(0):
            _fail("evidence content cannot be empty")
        if content_byte_length > MAX_EVIDENCE_BYTES:
            _fail("evidence content exceeds maximum size")
        if not authority or not evidence_type:
            _fail("evidence authority and source_url are required")
        if published_at > observed_at:
            _fail("published_at cannot be after observed_at")
        self.evidence[evidence_id] = Evidence(
            evidence_id,
            owner,
            entity_type,
            entity_id,
            authority,
            source_url,
            content_sha256,
            content_byte_length,
            observed_at,
            published_at,
            evidence_type,
        )
        key = self._entity_key(entity_type, entity_id)
        self.evidence_ids_by_entity.get_or_insert_default(key).append(evidence_id)
        self._audit("evidence", evidence_id, "EVIDENCE_AUTHENTICATED", entity_type + ":" + entity_id)

    def _validate_milestones(self, payment_milestones: str, maximum: u256) -> None:
        if not payment_milestones:
            _fail("payment milestones are required")
        total = u256(0)
        parts = payment_milestones.split(",")
        for part in parts:
            if not part or not part.isdigit():
                _fail("payment milestone must be a non-negative integer")
            amount = u256(int(part))
            if amount == u256(0):
                _fail("payment milestone must be positive")
            total += amount
        if total > maximum:
            _fail("payment milestones exceed awarded price")

    def _milestone_was_released(self, award: Award, milestone_index: u32) -> bool:
        for released in award.released_milestones.split(","):
            if released and u32(int(released)) == milestone_index:
                return True
        return False

    def _bond_amount_from_policy(self, policy: str, awarded_price: u256) -> u256:
        if policy == "" or policy == "NONE":
            return u256(0)
        parts = policy.split(":")
        if len(parts) != 2 or parts[1] == "" or not parts[1].isdigit():
            _fail("supplier bond policy is malformed")
        value = u256(int(parts[1]))
        if parts[0] == "FIXED":
            return value
        if parts[0] == "PERCENT" and value <= u256(100):
            return (awarded_price * value) // u256(100)
        _fail("supplier bond policy is outside canonical form")
        return u256(0)

    def _return_bond(self, award: Award) -> None:
        if award.bond_amount == u256(0):
            return
        if award.bond_returned != u256(0) or award.bond_slashed != u256(0):
            _fail("bond already exited")
        award.bond_returned = award.bond_amount
        self.total_bond_returns += award.bond_amount
        _emit_external_transfer(award.supplier, award.bond_amount)

    def _slash_bond(self, award: Award) -> None:
        if award.bond_amount == u256(0):
            return
        if award.bond_returned != u256(0) or award.bond_slashed != u256(0):
            _fail("bond already exited")
        award.bond_slashed = award.bond_amount
        self.total_bond_slashes += award.bond_amount

    def _parse_bid_vector(self, raw: str) -> dict:
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

    def _parse_delivery_vector(self, raw: str) -> dict:
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

    def _semantic_bid_vector(self, bid: Bid, requirement: Requirement, evidence_snapshot_root: str) -> dict:
        prompt = (
            "You are a bounded procurement evidence adjudicator. Return JSON only. "
            "Do not decide price, winner, payment, identity, deadlines, or state transitions.\n"
            "Frozen requirement:\n" + requirement.description + "\n"
            "Type=" + requirement.requirement_type + "; expected=" + requirement.expected_value + "; unit=" + requirement.unit + "\n"
            "Supplier response:\n" + bid.requirement_responses + "\n"
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
                leader = self._parse_bid_vector(leader_result.calldata)
                independent = self._parse_bid_vector(
                    gl.nondet.exec_prompt(prompt, response_format="json")
                )
            except Exception:
                return False
            return leader == independent

        raw = gl.vm.run_nondet_default(leader_fn, validator_fn)
        return self._parse_bid_vector(raw)

    def _semantic_delivery_vector(self, award: Award, delivery: Delivery, evidence_snapshot_root: str) -> dict:
        prompt = (
            "You are a bounded procurement inspection adjudicator. Return JSON only. "
            "Do not decide payment amounts, recipients, deadlines, or state transitions.\n"
            "Awarded specification:\n" + award.awarded_specification + "\n"
            "Delivered specification:\n" + delivery.delivered_items + "\n"
            "Delivered quantity=" + str(delivery.quantity) + "\n"
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
                leader = self._parse_delivery_vector(leader_result.calldata)
                independent = self._parse_delivery_vector(
                    gl.nondet.exec_prompt(prompt, response_format="json")
                )
            except Exception:
                return False
            return leader == independent

        raw = gl.vm.run_nondet_default(leader_fn, validator_fn)
        return self._parse_delivery_vector(raw)

    @gl.public.write
    def create_tender(
        self,
        tender_id: str,
        title: str,
        description: str,
        category: str,
        currency_label: str,
        budget_ceiling: u256,
        bid_deadline: str,
        evaluation_deadline: str,
        delivery_deadline: str,
        equivalence_policy: str,
        evaluation_policy: str,
        payment_policy: str,
        supplier_bond_policy: str,
        tender_hash: str,
    ) -> None:
        if tender_id in self.tenders:
            _fail("tender id already exists")
        if not title or not description or not currency_label:
            _fail("tender fields are incomplete")
        _hash(tender_hash, "tender_hash")
        buyer = gl.message.sender_address
        _nonzero(buyer)
        self.tenders[tender_id] = Tender(
            tender_id, buyer, title, description, category, currency_label,
            _u(budget_ceiling), bid_deadline, evaluation_deadline, delivery_deadline,
            [], equivalence_policy, evaluation_policy, payment_policy,
            supplier_bond_policy, TENDER_DRAFT, u32(0), tender_hash, u256(0), u256(0)
        )
        self.tender_ids.append(tender_id)
        self._audit("tender", tender_id, "TENDER_CREATED", SCHEMA_VERSION)

    @gl.public.write
    def add_requirement(
        self,
        tender_id: str,
        requirement_id: str,
        title: str,
        description: str,
        requirement_type: str,
        mandatory: bool,
        operator: str,
        expected_value: str,
        unit: str,
        equivalence_allowed: bool,
        evidence_required: bool,
        semantic_question: str,
        materiality: str,
    ) -> None:
        tender = self._require_tender(tender_id)
        self._require_buyer(tender)
        if tender.state != TENDER_DRAFT:
            _fail("requirements are frozen")
        _allowed(requirement_type, ("OBJECTIVE", "SEMANTIC", "CERTIFICATION", "COMMERCIAL", "DELIVERY"), "requirement_type")
        if requirement_id in self.requirements:
            _fail("requirement id already exists")
        self.requirements[requirement_id] = Requirement(
            requirement_id, tender_id, title, description, requirement_type,
            _bool(mandatory, "mandatory"), operator, expected_value, unit,
            _bool(equivalence_allowed, "equivalence_allowed"), _bool(evidence_required, "evidence_required"),
            semantic_question, materiality, u32(1)
        )
        self.requirement_ids_by_tender.get_or_insert_default(tender_id).append(requirement_id)
        self._audit("requirement", requirement_id, "REQUIREMENT_ADDED", tender_id)

    @gl.public.write
    def add_certification_requirement(
        self, tender_id: str, requirement_id: str, title: str, description: str, certification_name: str
    ) -> None:
        self.add_requirement(
            tender_id, requirement_id, title, description, "CERTIFICATION", True,
            "MUST_HAVE", certification_name, "certificate", False, True,
            "Does the evidence establish this certification?", "HIGH"
        )

    @gl.public.write
    def freeze_tender(self, tender_id: str) -> None:
        tender = self._require_tender(tender_id)
        self._require_buyer(tender)
        if tender.state != TENDER_DRAFT or len(self.requirement_ids_by_tender.get(tender_id, [])) == 0:
            _fail("tender cannot be frozen")
        tender.state = TENDER_FROZEN
        tender.version = u32(1)
        self._audit("tender", tender_id, "TENDER_FROZEN", tender.tender_hash)

    @gl.public.write.payable
    def fund_tender(self, tender_id: str) -> None:
        tender = self._require_tender(tender_id)
        self._require_buyer(tender)
        if tender.state != TENDER_FROZEN:
            _fail("only frozen tenders can be funded")
        amount = _u(gl.message.value)
        if amount == u256(0) or amount > tender.budget_ceiling:
            _fail("funding must be positive and within budget")
        tender.total_funded = amount
        tender.escrow_liability = amount
        tender.state = TENDER_FUNDED
        self.total_funded += amount
        self.escrow_liability += amount
        self._audit("tender", tender_id, "ESCROW_FUNDED", str(amount))

    @gl.public.write
    def cancel_tender(self, tender_id: str) -> None:
        tender = self._require_tender(tender_id)
        self._require_buyer(tender)
        if tender.state not in (TENDER_FUNDED, TENDER_FROZEN):
            _fail("tender cannot be cancelled in current state")
        if tender.total_funded > u256(0):
            amount = tender.escrow_liability
            if amount == u256(0):
                _fail("escrow already exited")
            tender.escrow_liability = u256(0)
            self.escrow_liability -= amount
            self.total_buyer_refunds += amount
            _emit_external_transfer(tender.buyer, amount)
        tender.state = TENDER_CANCELLED
        self._audit("tender", tender_id, "BUYER_CANCELLED_AND_REFUNDED", "before award")

    @gl.public.write
    def submit_bid(
        self,
        bid_id: str,
        tender_id: str,
        price: u256,
        currency: str,
        delivery_commitment: str,
        requirement_responses: str,
        submitted_at: str,
        bid_hash: str,
    ) -> None:
        tender = self._require_tender(tender_id)
        if tender.state not in (TENDER_FROZEN, TENDER_FUNDED):
            _fail("bidding is closed")
        if submitted_at > tender.bid_deadline:
            _fail("late bid")
        if bid_id in self.bids:
            _fail("bid id already exists")
        _hash(bid_hash, "bid_hash")
        if currency != tender.currency_label or _u(price) > tender.budget_ceiling:
            _fail("bid commercial terms violate frozen policy")
        self.bids[bid_id] = Bid(
            bid_id, tender_id, gl.message.sender_address, _u(price), currency,
            delivery_commitment, requirement_responses, submitted_at, bid_hash, BID_SUBMITTED
        )
        self.bid_ids_by_tender.get_or_insert_default(tender_id).append(bid_id)
        self._audit("bid", bid_id, "BID_SUBMITTED", tender_id)

    @gl.public.write
    def add_bid_evidence(
        self, bid_id: str, evidence_id: str, authority: str, source_url: str,
        content_sha256: str, content_byte_length: u256, observed_at: str,
        published_at: str, evidence_type: str
    ) -> None:
        if bid_id not in self.bids:
            _fail("unknown bid")
        bid = self.bids[bid_id]
        if bid.supplier != gl.message.sender_address:
            _fail("supplier permission required")
        if observed_at > bid.submitted_at:
            _fail("bid evidence was submitted after bid timestamp")
        self._record_evidence(evidence_id, bid.supplier, "BID", bid_id, authority, source_url, content_sha256, content_byte_length, observed_at, published_at, evidence_type)

    @gl.public.write
    def begin_bid_evaluation(self, tender_id: str) -> None:
        tender = self._require_tender(tender_id)
        self._require_buyer(tender)
        if tender.state not in (TENDER_FROZEN, TENDER_FUNDED):
            _fail("tender cannot enter evaluation")
        tender.state = TENDER_EVALUATING
        for bid_id in self.bid_ids_by_tender.get(tender_id, []):
            self.bids[bid_id].state = BID_UNDER_EVALUATION
        self._audit("tender", tender_id, "BID_EVALUATION_STARTED", "frozen policy")

    @gl.public.write
    def adjudicate_requirement(self, bid_id: str, requirement_id: str, evidence_snapshot_root: str) -> None:
        if bid_id not in self.bids or requirement_id not in self.requirements:
            _fail("unknown bid or requirement")
        bid = self.bids[bid_id]
        requirement = self.requirements[requirement_id]
        tender = self._require_tender(bid.tender_id)
        self._require_buyer(tender)
        if tender.state != TENDER_EVALUATING or requirement.tender_id != bid.tender_id:
            _fail("evaluation precondition failed")
        _hash(evidence_snapshot_root, "evidence_snapshot_root")
        adjudication_id = bid_id + ":" + requirement_id
        if adjudication_id in self.adjudications:
            _fail("requirement already adjudicated")
        vector = self._semantic_bid_vector(bid, requirement, evidence_snapshot_root)
        verdict = _canonical_bid_verdict(vector)
        self.adjudications[adjudication_id] = Adjudication(
            adjudication_id, bid_id, requirement_id, requirement.version, evidence_snapshot_root,
            vector["requirement_satisfied"], vector["mandatory_requirement_breached"],
            vector["claimed_equivalence_valid"], vector["certification_requirement_met"],
            vector["material_conflict"], vector["evidence_sufficient"], verdict,
            "mandatory_breach" if vector["mandatory_requirement_breached"] else "",
            _now()
        )
        self.adjudication_ids_by_bid.get_or_insert_default(bid_id).append(adjudication_id)
        self._audit("adjudication", adjudication_id, "BID_REQUIREMENT_ADJUDICATED", verdict)

    @gl.public.write
    def finalize_bid_evaluation(self, tender_id: str) -> None:
        tender = self._require_tender(tender_id)
        self._require_buyer(tender)
        if tender.state != TENDER_EVALUATING:
            _fail("evaluation is not active")
        requirement_ids = self.requirement_ids_by_tender.get(tender_id, [])
        for bid_id in self.bid_ids_by_tender.get(tender_id, []):
            bid = self.bids[bid_id]
            compliant = True
            for requirement_id in requirement_ids:
                requirement = self.requirements[requirement_id]
                key = bid_id + ":" + requirement_id
                if key not in self.adjudications:
                    _fail("all frozen requirements must be adjudicated")
                verdict = self.adjudications[key].canonical_verdict
                if requirement.mandatory and verdict not in (VERDICT_COMPLIANT, VERDICT_EQUIVALENT_ACCEPTABLE):
                    compliant = False
            bid.state = BID_COMPLIANT if compliant else BID_NON_COMPLIANT
        tender.state = TENDER_EVALUATED
        self._audit("tender", tender_id, "BID_EVALUATION_FINALIZED", "buyer selects winner")

    @gl.public.write
    def award_bid(
        self, tender_id: str, award_id: str, winning_bid_id: str,
        awarded_specification: str, payment_milestones: str, delivery_deadline: str,
        award_hash: str
    ) -> None:
        tender = self._require_tender(tender_id)
        self._require_buyer(tender)
        if tender.state != TENDER_EVALUATED or winning_bid_id not in self.bids:
            _fail("award precondition failed")
        bid = self.bids[winning_bid_id]
        if bid.tender_id != tender_id or bid.state != BID_COMPLIANT:
            _fail("winner must be compliant under frozen policy")
        if award_id in self.awards:
            _fail("award id already exists")
        _hash(award_hash, "award_hash")
        if bid.price > tender.total_funded:
            _fail("award price exceeds funded escrow")
        self._validate_milestones(payment_milestones, bid.price)
        self.awards[award_id] = Award(
            award_id, tender_id, winning_bid_id, bid.supplier, bid.price,
            awarded_specification, award_hash, payment_milestones, delivery_deadline,
            "AWARDED_PENDING_ACCEPTANCE", u256(0), u256(0), u256(0), u256(0),
            u256(0), u256(0), u256(0), False, False, ""
        )
        self.award_ids.append(award_id)
        bid.state = BID_AWARDED
        tender.state = TENDER_AWARDED
        self._audit("award", award_id, "AWARD_CREATED", winning_bid_id)

    @gl.public.write
    def accept_award(self, award_id: str) -> None:
        award = self._require_award(award_id)
        if award.supplier != gl.message.sender_address or award.state != "AWARDED_PENDING_ACCEPTANCE":
            _fail("supplier acceptance precondition failed")
        tender = self._require_tender(award.tender_id)
        if tender.escrow_liability < award.awarded_price:
            _fail("insufficient escrow")
        award.state = "ACCEPTED"
        award.funded_amount = award.awarded_price
        award.escrow_remaining = award.awarded_price
        tender.escrow_liability -= award.awarded_price
        self._audit("award", award_id, "AWARD_ACCEPTED", award.supplier.as_hex)

    @gl.public.write.payable
    def post_supplier_bond(self, award_id: str, expected_bond_amount: u256) -> None:
        award = self._require_award(award_id)
        if award.supplier != gl.message.sender_address or award.state != "ACCEPTED":
            _fail("bond precondition failed")
        amount = _u(gl.message.value)
        tender = self._require_tender(award.tender_id)
        frozen_amount = self._bond_amount_from_policy(tender.supplier_bond_policy, award.awarded_price)
        if amount != _u(expected_bond_amount) or amount != frozen_amount or award.bond_amount != u256(0):
            _fail("bond amount is not frozen or already posted")
        award.bond_amount = amount
        self.total_supplier_bonds += amount
        self._audit("award", award_id, "SUPPLIER_BOND_POSTED", str(amount))

    @gl.public.write
    def create_delivery(
        self, delivery_id: str, award_id: str, delivery_reference: str,
        delivered_items: str, quantity: u256, serial_identifiers: str, submitted_at: str
    ) -> None:
        award = self._require_award(award_id)
        if award.supplier != gl.message.sender_address or award.state != "ACCEPTED":
            _fail("delivery precondition failed")
        if delivery_id in self.deliveries or submitted_at > award.delivery_deadline:
            _fail("invalid or late delivery")
        self.deliveries[delivery_id] = Delivery(
            delivery_id, award_id, award.supplier, delivery_reference,
            delivered_items, _u(quantity), serial_identifiers, submitted_at, DELIVERY_DELIVERED
        )
        self.delivery_ids_by_award.get_or_insert_default(award_id).append(delivery_id)
        self._audit("delivery", delivery_id, "DELIVERY_SUBMITTED", award_id)

    @gl.public.write
    def add_delivery_evidence(
        self, delivery_id: str, evidence_id: str, authority: str, source_url: str,
        content_sha256: str, content_byte_length: u256, observed_at: str,
        published_at: str, evidence_type: str
    ) -> None:
        if delivery_id not in self.deliveries:
            _fail("unknown delivery")
        delivery = self.deliveries[delivery_id]
        if delivery.supplier != gl.message.sender_address:
            _fail("supplier permission required")
        if observed_at > delivery.submitted_at:
            _fail("delivery evidence was submitted after delivery timestamp")
        self._record_evidence(evidence_id, delivery.supplier, "DELIVERY", delivery_id, authority, source_url, content_sha256, content_byte_length, observed_at, published_at, evidence_type)

    @gl.public.write
    def begin_inspection(self, delivery_id: str) -> None:
        if delivery_id not in self.deliveries:
            _fail("unknown delivery")
        delivery = self.deliveries[delivery_id]
        award = self._require_award(delivery.award_id)
        tender = self._require_tender(award.tender_id)
        self._require_buyer(tender)
        if delivery.state != DELIVERY_DELIVERED:
            _fail("delivery is not ready for inspection")
        delivery.state = DELIVERY_UNDER_INSPECTION
        self._audit("delivery", delivery_id, "INSPECTION_STARTED", award.awarded_specification)

    @gl.public.write
    def adjudicate_delivery(self, delivery_id: str, evidence_snapshot_root: str) -> None:
        if delivery_id not in self.deliveries:
            _fail("unknown delivery")
        delivery = self.deliveries[delivery_id]
        award = self._require_award(delivery.award_id)
        tender = self._require_tender(award.tender_id)
        self._require_buyer(tender)
        if delivery.state != DELIVERY_UNDER_INSPECTION:
            _fail("inspection precondition failed")
        _hash(evidence_snapshot_root, "evidence_snapshot_root")
        adjudication_id = delivery_id + ":inspection"
        if adjudication_id in self.delivery_adjudications:
            _fail("delivery already adjudicated")
        vector = self._semantic_delivery_vector(award, delivery, evidence_snapshot_root)
        verdict = _canonical_delivery_verdict(vector)
        self.delivery_adjudications[adjudication_id] = DeliveryAdjudication(
            adjudication_id, delivery_id, award.awarded_specification, delivery.delivered_items,
            evidence_snapshot_root, vector["awarded_specification_matched"], vector["authorized_substitution"],
            vector["material_specification_difference"], vector["quantity_conformant"],
            vector["inspection_evidence_sufficient"], verdict,
            "unauthorized_substitution" if vector["material_specification_difference"] and not vector["authorized_substitution"] else "",
            _now()
        )
        self._audit("delivery_adjudication", adjudication_id, "DELIVERY_ADJUDICATED", verdict)

    @gl.public.write
    def accept_delivery(self, delivery_id: str) -> None:
        if delivery_id not in self.deliveries:
            _fail("unknown delivery")
        delivery = self.deliveries[delivery_id]
        award = self._require_award(delivery.award_id)
        tender = self._require_tender(award.tender_id)
        self._require_buyer(tender)
        key = delivery_id + ":inspection"
        if delivery.state != DELIVERY_UNDER_INSPECTION or key not in self.delivery_adjudications:
            _fail("delivery must be adjudicated before acceptance")
        verdict = self.delivery_adjudications[key].canonical_verdict
        if verdict not in (DELIVERY_ACCEPTED_VERDICT, DELIVERY_EQUIVALENT_VERDICT):
            _fail("delivery verdict does not permit acceptance")
        delivery.state = DELIVERY_ACCEPTED
        self._audit("delivery", delivery_id, "DELIVERY_ACCEPTED", verdict)

    @gl.public.write
    def reject_delivery(self, delivery_id: str) -> None:
        if delivery_id not in self.deliveries:
            _fail("unknown delivery")
        delivery = self.deliveries[delivery_id]
        award = self._require_award(delivery.award_id)
        tender = self._require_tender(award.tender_id)
        self._require_buyer(tender)
        key = delivery_id + ":inspection"
        if delivery.state != DELIVERY_UNDER_INSPECTION or key not in self.delivery_adjudications:
            _fail("delivery must be adjudicated before rejection")
        verdict = self.delivery_adjudications[key].canonical_verdict
        if verdict in (DELIVERY_ACCEPTED_VERDICT, DELIVERY_EQUIVALENT_VERDICT):
            _fail("accepted delivery cannot be rejected")
        delivery.state = DELIVERY_REJECTED
        self._audit("delivery", delivery_id, "DELIVERY_REJECTED", verdict)

    def _emit_payout(self, award: Award, amount: u256) -> None:
        if award.payout_exited or award.refund_exited:
            _fail("award already exited")
        if amount == u256(0) or amount > award.escrow_remaining:
            _fail("invalid payout amount")
        if self.escrow_liability < amount:
            _fail("escrow liability underflow")
        award.escrow_remaining -= amount
        award.paid_amount += amount
        self.escrow_liability -= amount
        self.total_supplier_payouts += amount
        _emit_external_transfer(award.supplier, amount)

    def _emit_refund(self, award: Award, amount: u256) -> None:
        if award.payout_exited or award.refund_exited:
            _fail("award already exited")
        if amount == u256(0) or amount > award.escrow_remaining:
            _fail("invalid refund amount")
        if self.escrow_liability < amount:
            _fail("escrow liability underflow")
        award.escrow_remaining -= amount
        award.refunded_amount += amount
        award.refund_exited = True
        self.escrow_liability -= amount
        self.total_buyer_refunds += amount
        _emit_external_transfer(self._require_tender(award.tender_id).buyer, amount)

    @gl.public.write
    def release_milestone(self, award_id: str, milestone_index: u32) -> None:
        award = self._require_award(award_id)
        tender = self._require_tender(award.tender_id)
        self._require_buyer(tender)
        if award.state != "ACCEPTED":
            _fail("award is not accepted")
        delivery_ids = self.delivery_ids_by_award.get(award_id, [])
        if len(delivery_ids) == 0 or self.deliveries[delivery_ids[0]].state != DELIVERY_ACCEPTED:
            _fail("milestone requires accepted delivery")
        parts = award.payment_milestones.split(",")
        if milestone_index >= u32(len(parts)):
            _fail("unknown payment milestone")
        if self._milestone_was_released(award, milestone_index):
            _fail("payment milestone already released")
        amount = _u(u256(int(parts[milestone_index])))
        self._emit_payout(award, amount)
        award.released_milestones = award.released_milestones + str(milestone_index) + ","
        if award.escrow_remaining == u256(0):
            award.payout_exited = True
            award.state = "SETTLED"
            self._return_bond(award)
        self._audit("award", award_id, "MILESTONE_RELEASED", str(milestone_index))

    @gl.public.write
    def settle_award(self, award_id: str) -> None:
        award = self._require_award(award_id)
        tender = self._require_tender(award.tender_id)
        self._require_buyer(tender)
        if award.state != "ACCEPTED" or award.payout_exited or award.refund_exited:
            _fail("award cannot be settled")
        delivery_ids = self.delivery_ids_by_award.get(award_id, [])
        if len(delivery_ids) == 0 or self.deliveries[delivery_ids[0]].state != DELIVERY_ACCEPTED:
            _fail("settlement requires accepted delivery")
        self._emit_payout(award, award.escrow_remaining)
        award.payout_exited = True
        award.state = "SETTLED"
        self._return_bond(award)
        self._audit("award", award_id, "AWARD_SETTLED", "value exit emitted")

    @gl.public.write
    def refund_buyer(self, award_id: str) -> None:
        award = self._require_award(award_id)
        tender = self._require_tender(award.tender_id)
        self._require_buyer(tender)
        if award.refund_exited or award.payout_exited or award.state not in ("ACCEPTED", "DISPUTED"):
            _fail("refund not permitted")
        delivery_ids = self.delivery_ids_by_award.get(award_id, [])
        if len(delivery_ids) > 0 and self.deliveries[delivery_ids[0]].state not in (DELIVERY_REJECTED, DELIVERY_DISPUTED):
            _fail("refund requires rejected or disputed delivery")
        amount = award.escrow_remaining
        self._emit_refund(award, amount)
        award.state = "REFUNDED"
        self._slash_bond(award)
        self._audit("award", award_id, "BUYER_REFUNDED", "rejected delivery")

    @gl.public.write
    def open_dispute(self, award_id: str, reason: str) -> None:
        award = self._require_award(award_id)
        if award.state not in ("ACCEPTED", "AWARDED_PENDING_ACCEPTANCE"):
            _fail("award cannot be disputed")
        if gl.message.sender_address not in (self._require_tender(award.tender_id).buyer, award.supplier):
            _fail("party permission required")
        award.state = "DISPUTED"
        self._audit("award", award_id, "DISPUTE_OPENED", reason)

    @gl.public.write
    def resolve_dispute(self, award_id: str, decision: str) -> None:
        award = self._require_award(award_id)
        tender = self._require_tender(award.tender_id)
        self._require_buyer(tender)
        _allowed(decision, ("PAYOUT", "REFUND", "LOCK"), "dispute decision")
        if award.state != "DISPUTED":
            _fail("award is not disputed")
        if decision == "PAYOUT":
            self._emit_payout(award, award.escrow_remaining)
            award.payout_exited = True
            award.state = "SETTLED"
            self._return_bond(award)
        elif decision == "REFUND":
            self._emit_refund(award, award.escrow_remaining)
            award.state = "REFUNDED"
            self._slash_bond(award)
        self._audit("award", award_id, "DISPUTE_RESOLVED", decision)

    @gl.public.view
    def get_tender(self, tender_id: str) -> dict:
        return self.tenders[tender_id]

    @gl.public.view
    def get_requirements(self, tender_id: str) -> list:
        return [self.requirements[i] for i in self.requirement_ids_by_tender.get(tender_id, [])]

    @gl.public.view
    def get_bids(self, tender_id: str) -> list:
        return [self.bids[i] for i in self.bid_ids_by_tender.get(tender_id, [])]

    @gl.public.view
    def get_evidence(self, entity_type: str, entity_id: str) -> list:
        return [self.evidence[i] for i in self.evidence_ids_by_entity.get(self._entity_key(entity_type, entity_id), [])]

    @gl.public.view
    def get_adjudication(self, bid_id: str, requirement_id: str) -> dict:
        return self.adjudications[bid_id + ":" + requirement_id]

    @gl.public.view
    def get_award(self, award_id: str) -> dict:
        return self.awards[award_id]

    @gl.public.view
    def get_delivery(self, delivery_id: str) -> dict:
        return self.deliveries[delivery_id]

    @gl.public.view
    def get_delivery_adjudication(self, delivery_id: str) -> dict:
        return self.delivery_adjudications[delivery_id + ":inspection"]

    @gl.public.view
    def get_payments(self, award_id: str) -> dict:
        award = self._require_award(award_id)
        return {"funded_amount": award.funded_amount, "escrow_remaining": award.escrow_remaining, "paid_amount": award.paid_amount}

    @gl.public.view
    def get_refunds(self, award_id: str) -> dict:
        award = self._require_award(award_id)
        return {"refunded_amount": award.refunded_amount, "refund_exited": award.refund_exited}

    @gl.public.view
    def get_audit_events(self) -> list:
        return self.audit_events

    @gl.public.view
    def get_accounting(self) -> dict:
        return {
            "total_funded": self.total_funded,
            "escrow_liability": self.escrow_liability,
            "total_supplier_payouts": self.total_supplier_payouts,
            "total_buyer_refunds": self.total_buyer_refunds,
            "total_supplier_bonds": self.total_supplier_bonds,
            "total_bond_returns": self.total_bond_returns,
            "total_bond_slashes": self.total_bond_slashes,
        }

    @gl.public.view
    def get_protocol_info(self) -> dict:
        return {
            "product": "Procura",
            "schema_version": SCHEMA_VERSION,
            "semantic_boundary": "authenticated evidence conformity only",
            "native_value_transfer": "payable + emit_transfer on finalized external message",
            "mode": "LIVE_OR_CONTROLLED_DEMO_EXPLICIT",
        }

    @gl.public.view
    def get_tender_ids(self) -> list:
        return self.tender_ids
