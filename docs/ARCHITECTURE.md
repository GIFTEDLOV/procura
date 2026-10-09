# Current architecture

Procura separates deterministic protocol authority from product presentation.

```text
Landing / application shell
        ↓
Mode-aware query layer (LIVE / CONTROLLED DEMO / HISTORICAL PROOF)
        ↓
Canonical read adapter + typed write adapter
        ↓
Transaction engine (preflight → one broadcast → hash persistence → finality → readback)
        ↓
Frozen Procurement_V1 contract
```

The frontend owns presentation, form validation, mode separation, and recovery visibility. The contract remains authoritative for identity, state, evidence, semantic result finalization, escrow, and value exits.
