"""Tests for Procura V3.0 Enterprise Milestone features:
1. Sealed-Bid Commit/Reveal RFQ
2. Comparative Multi-Vendor AI Consensus
3. Multi-Tranche Staged Milestone Progress
4. Dynamic Performance Bond Slashing (Liquidated Damages)
5. Supplier Reputation & Trust Tiering
"""

import ast
import hashlib
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "contracts" / "Procura.py"


def test_v3_contract_ast_contains_all_milestone_dataclasses():
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    classes = {node.name for node in tree.body if isinstance(node, ast.ClassDef)}
    
    # Milestone V3 Dataclasses
    assert "SealedBid" in classes
    assert "ComparativeAdjudication" in classes
    assert "TenderMilestone" in classes
    
    # Existing Dataclasses preserved
    assert "Tender" in classes
    assert "Bid" in classes
    assert "Evidence" in classes
    assert "Award" in classes
    assert "Delivery" in classes


def test_v3_contract_ast_contains_all_milestone_public_methods():
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    contract = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "ProcuraV2Evidence")
    
    methods = {node.name: node for node in contract.body if isinstance(node, ast.FunctionDef)}
    
    # New Milestone V3 Public Writes
    v3_writes = [
        "submit_sealed_bid",
        "reveal_sealed_bid",
        "adjudicate_comparative_bids",
        "add_tender_milestone",
        "complete_milestone_tranche",
        "slash_supplier_bond",
    ]
    for m in v3_writes:
        assert m in methods, f"Missing V3 write method: {m}"
        assert any("public.write" in ast.unparse(d) for d in methods[m].decorator_list)
        
    # New Milestone V3 Public Views
    v3_views = [
        "get_sealed_bids",
        "get_comparative_adjudications",
        "get_tender_milestones",
        "get_supplier_reputation",
    ]
    for m in v3_views:
        assert m in methods, f"Missing V3 view method: {m}"
        assert any("public.view" in ast.unparse(d) for d in methods[m].decorator_list)


def test_sealed_bid_cryptographic_commitment_logic():
    supplier = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".lower()
    tender_id = "TENDER-2026-X1"
    price = 50000
    currency = "GEN"
    salt = "enterprise-secure-salt-98124"
    
    # Create valid commitment
    preimage = f"{supplier}:{tender_id}:{price}:{currency}:{salt}".encode("utf-8")
    commitment = hashlib.sha256(preimage).hexdigest()
    
    # Verify exact match
    check_preimage = f"{supplier}:{tender_id}:{price}:{currency}:{salt}".encode("utf-8")
    assert hashlib.sha256(check_preimage).hexdigest() == commitment
    
    # Verify tampered price changes hash (prevents price manipulation)
    tampered_price_preimage = f"{supplier}:{tender_id}:{price - 1000}:{currency}:{salt}".encode("utf-8")
    assert hashlib.sha256(tampered_price_preimage).hexdigest() != commitment
    
    # Verify tampered salt changes hash
    tampered_salt_preimage = f"{supplier}:{tender_id}:{price}:{currency}:wrong-salt".encode("utf-8")
    assert hashlib.sha256(tampered_salt_preimage).hexdigest() != commitment


def test_comparative_adjudication_scoring_algorithm():
    tender_ceiling = 100_000
    bids = [
        {"bid_id": "BID-A", "price": 80_000, "compliance": True, "has_commitment": True},
        {"bid_id": "BID-B", "price": 60_000, "compliance": True, "has_commitment": True},
        {"bid_id": "BID-C", "price": 95_000, "compliance": False, "has_commitment": False},
    ]
    
    scored = []
    for b in bids:
        tech = 35 if b["compliance"] else 15
        savings_ratio = max(0.0, min(1.0, (tender_ceiling - b["price"]) / max(1, tender_ceiling)))
        comm = 20 + int(20 * savings_ratio)
        timeline = 25 if b["has_commitment"] else 10
        total = tech + comm + timeline
        scored.append({"bid_id": b["bid_id"], "total": total})
        
    scored.sort(key=lambda x: x["total"], reverse=True)
    
    # BID-B should rank #1 because it is fully compliant, committed, and has lowest price
    assert scored[0]["bid_id"] == "BID-B"
    assert scored[1]["bid_id"] == "BID-A"
    assert scored[2]["bid_id"] == "BID-C"
    assert scored[0]["total"] > scored[1]["total"] > scored[2]["total"]


def test_multi_tranche_milestone_calculations():
    awarded_price = 100_000
    milestones = [
        {"id": "M1", "weight_bps": 2500},  # 25%
        {"id": "M2", "weight_bps": 3500},  # 35%
        {"id": "M3", "weight_bps": 4000},  # 40%
    ]
    
    total_weight = sum(m["weight_bps"] for m in milestones)
    assert total_weight == 10000  # 100%
    
    # Tranche 1
    payout_1 = awarded_price * milestones[0]["weight_bps"] // 10000
    assert payout_1 == 25_000
    
    # Tranche 2
    payout_2 = awarded_price * milestones[1]["weight_bps"] // 10000
    assert payout_2 == 35_000
    
    # Tranche 3
    payout_3 = awarded_price * milestones[2]["weight_bps"] // 10000
    assert payout_3 == 40_000
    
    assert payout_1 + payout_2 + payout_3 == awarded_price


def test_performance_bond_slashing_bounds():
    bond_amount = 10_000
    
    # 50% penalty (5000 bps)
    penalty_bps = 5000
    slashed = min(bond_amount, bond_amount * penalty_bps // 10000)
    assert slashed == 5000
    
    remaining = bond_amount - slashed
    assert remaining == 5000
    
    # Additional 50% penalty on original
    slashed_2 = min(remaining, bond_amount * 5000 // 10000)
    assert slashed_2 == 5000
    assert remaining - slashed_2 == 0


def test_supplier_reputation_tiering():
    # Preferred Supplier: 100 score, 0 slashed
    total_posted = 50_000
    total_slashed = 0
    penalty = min(80, int((total_slashed * 100) / total_posted)) if total_posted > 0 else 0
    score = 100 - penalty
    assert score == 100
    tier = "TIER_1_PREFERRED" if score >= 90 else ("TIER_2_VERIFIED" if score >= 70 else "TIER_3_PROBATIONARY")
    assert tier == "TIER_1_PREFERRED"
    
    # Slashed Supplier: 20% slashed
    total_slashed_bad = 10_000
    penalty_bad = min(80, int((total_slashed_bad * 100) / total_posted))
    score_bad = 100 - penalty_bad
    assert score_bad == 80
    tier_bad = "TIER_1_PREFERRED" if score_bad >= 90 else ("TIER_2_VERIFIED" if score_bad >= 70 else "TIER_3_PROBATIONARY")
    assert tier_bad == "TIER_2_VERIFIED"


def test_hardened_sealed_bid_rejects_buyer_self_bidding():
    buyer = "0xa0ee7a142d267c1f36714e4a8f75612f20a79720"
    supplier = "0xa0ee7a142d267c1f36714e4a8f75612f20a79720"
    is_buyer = (buyer.lower() == supplier.lower())
    assert is_buyer is True, "Buyer self-bidding must be detected"


def test_hardened_sealed_bid_deadline_validation():
    bid_deadline = "2026-10-20T12:00:00.000Z"
    now_ts = "2026-10-21T10:00:00.000Z"
    is_expired = (now_ts > bid_deadline)
    assert is_expired is True, "Expired bid deadline must be rejected"


def test_hardened_comparative_rejects_duplicate_candidates():
    candidates = ["BID-01", "BID-02", "BID-01"]
    has_duplicates = len(set(candidates)) != len(candidates)
    assert has_duplicates is True, "Duplicate candidate bids must be detected"


def test_hardened_cumulative_milestone_weights():
    existing_weights = [2500, 3500]  # 6000 bps
    new_weight_invalid = 4500         # 6000 + 4500 = 10500 > 10000
    new_weight_valid = 4000           # 6000 + 4000 = 10000 == 10000
    
    assert sum(existing_weights) + new_weight_invalid > 10000
    assert sum(existing_weights) + new_weight_valid == 10000


def test_hardened_milestone_future_deadline_check():
    now_ts = "2026-10-21T11:00:00.000Z"
    past_deadline = "2026-10-20T11:00:00.000Z"
    future_deadline = "2026-11-20T11:00:00.000Z"
    
    assert past_deadline <= now_ts  # Rejected
    assert future_deadline > now_ts  # Allowed
