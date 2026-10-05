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
# Gate 2 qualification update

The Gate 2 recovery suite is now split into two explicit classes:

- local/static qualification: contract policy, adversarial, property, mutation, interface parity, frontend unit/integration, and browser E2E;
- runtime qualification: Local Studio deployment, native GEN funding, supplier payout, buyer refund, and balance-delta reconciliation.

The first class passes in this workspace. Runtime qualification is blocked by
the installed Local Studio JSON-RPC web GenVM module failing startup with
`missing field session_create_request`; no native value claim is made until the
module is repaired or replaced.

Coverage executed in the recovery pass:

- 110 Python tests pass, with one legacy Windows direct-runner test skipped because it is explicitly guarded for the known DecodingError;
- 46 frontend unit/integration tests pass;
- 16 Playwright tests pass at 1440, 1024, 430, and 390 viewport sizes;
- GenVM linter: 3 checks and SDK validation pass;
- TypeScript typecheck and Vite production build pass.

The mutation suite defines and executes 24 source mutants. It is deliberately
separate from live GenLayer execution and must be rerun with the Studio driver
once the local runtime is healthy.
