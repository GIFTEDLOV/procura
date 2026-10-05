# Procura Gate 2 Qualification

Date: 2026-10-05  
Schema: `PROCUREMENT_V1`  
Contract: `contracts/Procura.py`

## Result

The non-runtime release gates pass. Native Local Studio value qualification is
blocked by the installed JSON-RPC container, so this candidate is not claimed
to have proven GEN funding, payout, or refund execution.

## Runtime environment

- Docker Desktop is running; Postgres, Hardhat, WebDriver, Ollama, and the JSON-RPC containers were inspected.
- The repository was tested with an isolated WSL Ubuntu 24.04 Python 3.12.3 environment at `/home/dell/.venvs/procura-genlayer312`.
- `genlayer up --headless` required a recoverable CLI config-file repair and manual migration with the service database variables. The JSON-RPC process then failed during web GenVM startup with `missing field session_create_request`.
- RPC target: `http://127.0.0.1:4000/api`; it returned an empty reply because the application lifespan never completed.
- The Windows Python 3.14 direct runner was not retried. The separate Python 3.12 direct qualification also reached the installed runner but failed with the same `DecodingError: unexpected end of memory` before contract import. No runtime value result is inferred from it.

## Passing gates

- Contract source compiles; GenVM lint and SDK validation pass.
- Public interface remains 39 methods and `PROCUREMENT_V1`.
- 136 Python policy/adversarial/property/mutation/schema tests pass; one legacy direct-runtime test is explicitly skipped.
- 46 frontend unit/integration tests pass.
- 16 Playwright tests pass at all four requested viewport sizes.
- TypeScript typecheck and production build pass.
- Controlled demo mode is explicit; no fixture is presented as LIVE.

## Pending runtime evidence

The opt-in driver `scripts/studio_qualification.py` is ready to run only after
Local Studio health is restored. It deploys `StorageProbe.py`, writes and
reads it back, then deploys `ValueTransferProbe.py` and records exact contract
and recipient balance deltas for funding and EOA transfer. Procura payout and
refund qualification must then be run as separate funded scenarios.
