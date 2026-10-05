# Procura protocol specification

Schema version: `PROCUREMENT_V1`.

Deterministic state includes addresses, organizations, tender and bid identities, hashes, versions, deadlines, prices, quantities, currency labels, escrow amounts, bonds, statuses, lifecycle legality, transaction identities, and canonical readback.

GenLayer is bounded to evidence-grounded semantic judgments. It returns strict boolean vectors for bid requirements and delivery inspection. A malformed vector, unauthenticated evidence, or transport failure cannot become a business adverse verdict.

The contract public interface is listed in `contracts/interface.json`. It is the canonical parity source for the frontend adapter and AST parity test.
