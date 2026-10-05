# Procura

Verifiable procurement from requirement to payment.

Gate 1 foundation for a production-grade procurement application using GenLayer as a bounded semantic adjudication layer. The repository is intentionally not deployed or connected to live writes.

## Run the frontend

```powershell
pnpm --dir frontend install
pnpm --dir frontend dev
```

The local app is served on `http://localhost:3001`.

## Verify

```powershell
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend build
python -m pytest -q
python scripts/probe_value_transfer.py
```

See `docs/` for the protocol, state machine, economic model, semantic boundary, threat model, frontend architecture, and test matrix.
