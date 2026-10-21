# Changelog

## v2.0.0 - Enterprise Milestone Release

- **Pillar 1: Comparative Multi-Vendor AI Consensus**: Upgraded GenLayer validator evaluation to execute `gl.eq_principle_prompt_comparative` matrix scoring across Technical Compliance (35 pts), Commercial Price Savings (40 pts), and Timeline SLA (25 pts), returning deterministic winning rank and agreement vectors.
- **Pillar 2: Sealed-Bid Commit/Reveal RFQ**: Added cryptographic commit-reveal protocol (`submit_sealed_bid` & `reveal_sealed_bid`) using `sha256(supplier:tender_id:price:currency:salt)` to prevent front-running and premature proposal leakage.
- **Pillar 3: Multi-Tranche Staged Milestone Escrow & Dynamic Bond Slashing**: Replaced monolithic delivery with staged milestone releases (`add_tender_milestone` & `complete_milestone_tranche`) and implemented liquidated damages performance bond slashing (`slash_supplier_bond`).
- **Pillar 4: Verifiable Proof Room & Reputation Ledger**: Integrated on-chain supplier trust tiering (Tier 1 Preferred / Tier 2 Verified / Tier 3 Probationary) and 1-click verifiable JSON-LD audit certificate export.
- **Visual UI Overhaul**: Elevated the application with full-spectrum visual walkthroughs, interactive comparison matrix, sealed-bid cryptographic lab, and comprehensive README documentation matching top-tier cybersecurity standards.
- **Verification Suite**: 179 Python contract tests passing, 87 frontend tests passing, 0 TypeScript/Vite build errors.

## v1.0.2 - Studionet steward remediation

- Configured the LIVE application for Studionet chain 61999 and the verified V2.1.2 contract.
- Completed all 13 writes in a genuine qualification lifecycle, including the five steward-required methods, successful validator consensus, and canonical delivery evidence.
- Replaced the frontend's release-candidate SDK types and unreachable fee-estimator branch with the stable `genlayer-js@1.1.8` wallet path.
- Added hash persistence at the wallet transport boundary, same-hash recovery, stable SDK transport tests, and rejection of duplicate wallet sends.
- Added the deployed shared schema, ABI, interface parity, full qualification journal, canonical readbacks, escrow reconciliation, and all transaction links.
- Enabled the qualified LIVE create, bid, evidence, and delivery actions; retained the historical V1 safety block.
- Updated production-facing documentation and reviewer proof links.

## v1.0.1 - historical Studio-dev frontend release

The prior product release targeted Studio-dev chain 61997. Its contract, fee, and transaction records remain in `docs/history/` and `evidence/qualification/historical/`.

## v1.0.0 - historical Studio-dev protocol release

The earlier Studio-dev protocol qualification and value-transfer records remain archived and are not current Studionet state.
