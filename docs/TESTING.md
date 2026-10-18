# Testing and release gates

The `Procura release gates` workflow runs six required jobs on the exact
checked-out commit: contract tests, security/adversarial tests, frontend unit
tests and build, integration tests, browser E2E, and deployment/schema
provenance.

The active release coverage includes:

- Contract source SHA, deployed shared schema/ABI parity, and argument-name,
  order, and type checks for the five reviewer methods.
- Correct UTC string timestamps, lowercase SHA-256 serialization, evidence
  identity, and schema-to-UI argument mapping.
- The installed stable `genlayer-js@1.1.8` writer using gas-estimation and
  gas-price RPCs, wallet hash persistence, signer/network checks, duplicate
  send denial, finality recovery, validator execution agreement, and canonical
  readback.
- LIVE UI controls for all five methods and Proof & Audit rendering every
  verified transaction link and the actual evidence hash/length.
- A read-only runner safety test proving simulation, estimation, and public
  reads do not sign or broadcast; qualification writes remain behind the
  explicit 13-method allowlist and spending cap.
- Python contract/integration suites, frontend unit tests, typecheck,
  production build, and Playwright browser checks.

Run the focused release gates locally:

```powershell
py -m pytest -q
py scripts/check_steward_v212_schema.py
node scripts/qualification/transaction-safety.test.mjs
cd frontend
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm e2e
```

Exact commit results are linked from the release PR and GitHub Actions; they
are not inferred from local tests.
