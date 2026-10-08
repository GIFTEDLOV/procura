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

## Release preflight

- Direct contract tests: 144 PASS, 1 SKIPPED.
- Skip reason: the installed Windows/Python 3.14 GenLayer direct runner raises
  `DecodingError` while injecting v0.6 message context; this is documented
  environment provenance and was not repaired.
- Adversarial: 44 PASS minimum met.
- Property: 12 PASS minimum met.
- Mutation: 24/24 killed.
- Frontend unit/integration: 54 PASS.
- Playwright: 16 PASS; console errors 0; horizontal overflow 0.
- Typecheck, build, interface parity, transaction recovery, and secret scan:
  PASS. The installed `genvm-linter 0.11.1rc2` still recognizes only the
  legacy bare `@allow_storage` spelling and reports nine E014 false positives
  against the target-proven `@gl.storage.allow` contract API; production source
  was not regressed to satisfy that stale linter.
- Focused fee-allocation regression: PASS.
- JSON response regression: PASS; focused contract/adversarial semantic tests
  pass, including the two native JSON calls and two default nondet calls.
- Liveness regression: PASS locally for the undeployed candidate. The
  canonical Deployment #5 case has a retry recovery path when no result is
  committed, but remains blocked for publication until successful-result replay
  protection is deployed and requalified.

## Runtime qualification

- Deployment #4 schema and deploy simulation: PASS; 39 methods.
- Storage allocation probes and Procura-shaped allocation harness: PASS.
- Corrected raw `gen_call type=write` create preflight: PASS (`00`).
- Live funding: PASS; exact `1000000000000000` wei reflected in escrow and
  global liability.
- First cancel/refund: finalized with
  `Mode1MessageFeesRequireGenVMPerEmissionSupport`; no state mutation.
- Same-case cancel retry: PASS with the required external allocation. Gross
  buyer refund and contract/accounting deltas are exact; buyer net delta is
  reconciled after protocol fees.
- Payout setup: finalized with explicit `deployer` buyer and `player2` supplier
  accounts. Adjudication preflight then stopped with the frozen deployed
  runtime error `gl.vm.run_nondet_unsafe` missing; no payout settlement was
  broadcast.
- Corrected temporary JSON semantic probe: deployment, requirement, and
  delivery transactions finalized with consensus and strict payload readback.

## Frontend live-write boundary

- `genlayer-js` 2.0.0-rc.1 is used by the adapter against Studio-dev 61997.
- Focused live-adapter tests cover schema-ordered typed actions, numeric-only
  hash strings, buyer/supplier role guards, wrong-network rejection, canonical
  refund/supplier message allocations, non-message writes, one-shot broadcast,
  and same-hash persistence.
- Controlled-demo browser screens do not claim a wallet connection or live
  state. Full browser broadcast qualification is intentionally not run after
  the SDK payout stop.

No contract source, ABI, state machine, accounting policy, or deployment was
changed during fee-allocation recovery.

## Final Deployment #5 gate result

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
  typecheck and production build: PASS.
