# Test matrix

| Area | Coverage |
| --- | --- |
| Contract interface | AST parity with `contracts/interface.json` |
| Adversarial rules | strict SHA-256, closed verdict enum, transport failure separation |
| Property/invariant | liability conservation and canonical verdict enum generation |
| Value transfers | payable decorator, `gl.message.value`, `self.balance`, EOA `emit_transfer` probe |
| Fee allocation | exact buyer refund and supplier settlement external allocations; no allocation for ordinary writes |
| JSON semantic transport | native JSON response mode on both production semantic paths; parsed dict acceptance; strict rejection of missing/extra fields, wrong boolean types, unknown enums, invalid context, and garbage |
| Semantic liveness | failed/undetermined bid and delivery adjudications remain retryable; successful identities are immutable; finalization still requires every bid record; no evaluation expiry/admin recovery was added |
| Frontend | Vitest serialization, transaction recovery, render smoke |
| Browser E2E | Playwright routes, flagship screen labels, explicit demo mode |

## Current release gates

The current v1.0.1 product release keeps the frozen deployment #6 contract
unchanged. The exact-head local and CI gates are the authoritative counts below.

- Python contract/qualification suite: `167 passed, 1 documented skip`.
- Adversarial: `44 passed`.
- Property/invariant: included in the full Python suite.
- Mutation: `24/24 killed`.
- Frontend unit/integration: `54/54 passed`.
- Browser E2E: `52 total across four projects; 50 passed, 2 intentional skips`.
- Typecheck, build, interface parity, transaction recovery, and secret scan:
  PASS.
- Nine E014 `gl.storage.allow` diagnostics remain documented tooling false
  positives against the proven target runtime.

Historical probe and qualification details remain in `docs/history/` and the
`evidence/` hierarchy; they are not current release gates.

## Historical Deployment #5 gate result

- Contract/qualification tests: 154 PASS, 1 documented direct-runner SKIP.
- Adversarial, property, mutation, storage, nondet, JSON transport, semantic
  validator, and fee-allocation regressions: PASS.
- Deployment #5 schema: 39/39; `gen_call type=deploy`: PASS.
- JSON probe requirement and delivery: finalized consensus PASS with strict
  parsed dictionaries.
- Live one-wei semantic requirement and delivery smokes: consensus PASS;
  delivery smoke acceptance and one-wei settlement reconciliation PASS.
- Final refund and awardable final payout: exact gross value exits PASS.
- Exit guards: double refund, payout after refund, double payout, and refund
  after payout all PASS via non-broadcasting failing preflights.
- Frontend unit: 54 PASS; browser E2E: 16 PASS with no console errors;
  typecheck and production build: PASS. This is historical evidence only.

## Final Deployment #6 gate result

- Python contract/qualification suite: `167 passed, 1 documented skip`.
- Replay/liveness qualification coverage: canonical-state retry eligibility,
  immutable successful bid result, immutable successful delivery result, and
  fail-closed canonical-state reads all PASS.
- Deployment #6: finalized successfully; 39/39 schema parity; source SHA
  exact match; no public method or storage-layout change.
- Fresh refund and payout: exact gross value exits PASS; contract balance and
  escrow liability are both zero afterward.
- Live duplicate adjudication preflights: bid and delivery rejected before
  nondeterministic execution; no duplicate write was broadcast.
- Frontend unit: 54 PASS; Playwright: 16 PASS; console errors 0; horizontal
  overflow 0; typecheck, build, interface parity, transaction recovery, and
  secret scan PASS.
- Known nine E014 `gl.storage.allow` findings remain tooling false positives
  against the proven target runtime and are not release-blocking.
