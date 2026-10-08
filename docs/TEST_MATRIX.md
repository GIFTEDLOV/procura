# Test matrix

| Area | Coverage |
| --- | --- |
| Contract interface | AST parity with `contracts/interface.json` |
| Adversarial rules | strict SHA-256, closed verdict enum, transport failure separation |
| Property/invariant | liability conservation and canonical verdict enum generation |
| Value transfers | payable decorator, `gl.message.value`, `self.balance`, EOA `emit_transfer` probe |
| Fee allocation | exact buyer refund and supplier settlement external allocations; no allocation for ordinary writes |
| JSON semantic transport | native JSON response mode on both production semantic paths; parsed dict acceptance; strict rejection of missing/extra fields, wrong boolean types, unknown enums, invalid context, and garbage |
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
