# Test matrix

| Area | Coverage |
| --- | --- |
| Contract interface | AST parity with `contracts/interface.json` |
| Adversarial rules | strict SHA-256, closed verdict enum, transport failure separation |
| Property/invariant | liability conservation and canonical verdict enum generation |
| Value transfers | payable decorator, `gl.message.value`, `self.balance`, EOA `emit_transfer` probe |
| Frontend | Vitest serialization, transaction recovery, render smoke |
| Browser E2E | Playwright routes, flagship screen labels, explicit demo mode |

The Gate 1 test suite is foundation-level and must be extended with live simulator and testnet integration cases before release.

## Final migration preflight

- Direct contract tests: 44 PASS, 1 SKIPPED.
- Skip reason: the installed Windows/Python 3.14 GenLayer direct runner raises
  `DecodingError` while injecting v0.6 message context; a separate cache path
  also lacks permission. This is an environment limitation and was not repaired.
- Adversarial: 44 PASS.
- Property: 12 PASS.
- Mutation: 24/24 killed.
- Frontend unit/integration: 46 PASS.
- Playwright: 16 PASS; console errors 0; horizontal overflow 0.
- Typecheck, build, interface parity, transaction recovery, and secret scan:
  PASS.
- GenVM lint validation: PASS; the installed AST lint emitted a known false
  positive for the current `gl.storage.allow` namespace, while target
  Studio-dev schema/deploy execution passed.

Live value qualification remains incomplete and is a release blocker.
# Gate 2 qualification update

The Gate 2 recovery suite is now split into two explicit classes:

- local/static qualification: contract policy, adversarial, property, mutation, interface parity, frontend unit/integration, and browser E2E;
- runtime qualification: Local Studio deployment, native GEN funding, supplier payout, buyer refund, and balance-delta reconciliation.

The first class passes in this workspace. Runtime qualification is blocked by
the installed Local Studio JSON-RPC web GenVM module failing startup with
`missing field session_create_request`; no native value claim is made until the
module is repaired or replaced.

Coverage executed in the recovery pass:

- 136 Python tests pass, with one legacy Windows direct-runner test skipped because it is explicitly guarded for the known DecodingError;
- 46 frontend unit/integration tests pass;
- 16 Playwright tests pass at 1440, 1024, 430, and 390 viewport sizes;
- GenVM linter: 3 checks and SDK validation pass;
- TypeScript typecheck and Vite production build pass.

The mutation suite defines and executes 24 source mutants. It is deliberately
separate from live GenLayer execution and must be rerun with the Studio driver
once the local runtime is healthy.
