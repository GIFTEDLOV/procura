import json
import hashlib
from pathlib import Path

ROOT = Path("C:/Users/DELL/.gemini/antigravity/scratch/procura")
PROCURA_PY = ROOT / "contracts" / "Procura.py"
V2_SCHEMA = ROOT / "contracts" / "schema.v2.evidence.json"

v3_source_hash = hashlib.sha256(PROCURA_PY.read_bytes()).hexdigest()

schema_v2 = json.loads(V2_SCHEMA.read_text(encoding="utf-8"))

new_methods = [
    {
        "name": "submit_sealed_bid",
        "kind": "write",
        "payable": False,
        "arguments": ["tender_id", "sealed_bid_id", "commitment_hash"],
        "argumentTypes": ["str", "str", "str"],
        "returnType": "None",
        "description": "Cryptographically commits a blinded sealed bid hash prior to deadline."
    },
    {
        "name": "reveal_sealed_bid",
        "kind": "write",
        "payable": False,
        "arguments": [
            "tender_id", "sealed_bid_id", "price", "currency",
            "delivery_commitment", "requirement_responses", "salt", "bid_hash"
        ],
        "argumentTypes": ["str", "str", "u256", "str", "str", "str", "str", "str"],
        "returnType": "None",
        "description": "Reveals sealed bid preimage and parameters; validates against committed hash."
    },
    {
        "name": "adjudicate_comparative_bids",
        "kind": "write",
        "payable": False,
        "arguments": ["tender_id", "candidate_bid_ids"],
        "argumentTypes": ["str", "list[str]"],
        "returnType": "None",
        "description": "Executes GenLayer comparative validator consensus ranking candidate proposals."
    },
    {
        "name": "add_tender_milestone",
        "kind": "write",
        "payable": False,
        "arguments": ["tender_id", "milestone_id", "title", "weight_bps", "deadline"],
        "argumentTypes": ["str", "str", "str", "u256", "str"],
        "returnType": "None",
        "description": "Adds a staged delivery milestone tranche with basis-point weight."
    },
    {
        "name": "complete_milestone_tranche",
        "kind": "write",
        "payable": False,
        "arguments": ["award_id", "milestone_id", "delivery_id"],
        "argumentTypes": ["str", "str", "str"],
        "returnType": "None",
        "description": "Validates accepted delivery and releases corresponding escrow tranche."
    },
    {
        "name": "slash_supplier_bond",
        "kind": "write",
        "payable": False,
        "arguments": ["award_id", "penalty_bps", "reason"],
        "argumentTypes": ["str", "u256", "str"],
        "returnType": "None",
        "description": "Slashes supplier performance bond for liquidated damages upon contract breach."
    },
    {
        "name": "get_sealed_bids",
        "kind": "view",
        "payable": False,
        "arguments": ["tender_id"],
        "argumentTypes": ["str"],
        "returnType": "list",
        "description": "Returns committed and revealed sealed bids for a tender."
    },
    {
        "name": "get_comparative_adjudications",
        "kind": "view",
        "payable": False,
        "arguments": ["tender_id"],
        "argumentTypes": ["str"],
        "returnType": "list",
        "description": "Returns multi-vendor comparative consensus ranking results."
    },
    {
        "name": "get_tender_milestones",
        "kind": "view",
        "payable": False,
        "arguments": ["tender_id"],
        "argumentTypes": ["str"],
        "returnType": "list",
        "description": "Returns staged delivery milestones for a tender."
    },
    {
        "name": "get_supplier_reputation",
        "kind": "view",
        "payable": False,
        "arguments": ["supplier"],
        "argumentTypes": ["str"],
        "returnType": "dict",
        "description": "Calculates on-chain supplier trust score and tier based on bond and settlement history."
    }
]

schema_v3 = {
    "schemaVersion": "PROCUREMENT_V3_ENTERPRISE_MILESTONE",
    "contractVersion": "3.0.0-enterprise-milestone",
    "contract": "ProcuraV3Enterprise",
    "inherits": "PROCUREMENT_V2_1_2_EVIDENCE_STUDIONET",
    "status": "DEVELOPED_VERIFIED",
    "baseSchemaVersion": "PROCUREMENT_V2_1_2_EVIDENCE_STUDIONET",
    "baseSourceSha256": "a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac",
    "candidateSourceSha256": v3_source_hash,
    "changedMethods": [m["name"] for m in new_methods],
    "milestonePillars": [
        "Pillar 1: Comparative Multi-Vendor AI Consensus (gl.eq_principle_prompt_comparative matrix)",
        "Pillar 2: Sealed-Bid Commit/Reveal RFQ (Anti-Front-Running)",
        "Pillar 3: Multi-Tranche Staged Milestone Progress & Dynamic Bond Slashing",
        "Pillar 4: Autonomous Multi-Source Web Oracles & Verifiable Audit Room"
    ],
    "methods": schema_v2["methods"] + new_methods,
    "deployment": {
        "network": "GenLayer Studionet",
        "chainId": 61999,
        "rpc": "https://studio.genlayer.com/api",
        "baseContract": "0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929",
        "explorer": "https://explorer-studio.genlayer.com/address/0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929"
    }
}

(ROOT / "contracts" / "schema.v3.enterprise.json").write_text(json.dumps(schema_v3, indent=2), encoding="utf-8")

# Interface manifest
interface_v3 = {
    "contract": "ProcuraV3Enterprise",
    "schemaVersion": "PROCUREMENT_V3_ENTERPRISE_MILESTONE",
    "methods": [
        {"name": m["name"], "kind": m["kind"], "arguments": m["arguments"], "argumentTypes": m["argumentTypes"]}
        for m in schema_v3["methods"]
    ]
}
(ROOT / "contracts" / "interface.v3.enterprise.json").write_text(json.dumps(interface_v3, indent=2), encoding="utf-8")

print(f"Generated schema.v3.enterprise.json and interface.v3.enterprise.json (SHA-256: {v3_source_hash})")
