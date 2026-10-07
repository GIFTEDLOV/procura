# Test matrix

| Area | Coverage |
| --- | --- |
| Contract interface | AST parity with `contracts/interface.json` |
| Adversarial rules | strict SHA-256, closed verdict enum, transport failure separation |
| Property/invariant | liability conservation and canonical verdict enum generation |
| Value transfers | payable decorator, `gl.message.value`, `self.balance`, EOA `emit_transfer` probe |
| Fee allocation | exact buyer refund and supplier settlement external allocations; no allocation for ordinary writes |
| Frontend | Vitest serialization, transaction recovery, render smoke |
| Browser E2E | Playwright routes, flagship screen labels, explicit demo mode |

## Release preflight

- Direct contract tests: 143 PASS, 1 SKIPPED.
- Skip reason: the installed Windows/Python 3.14 GenLayer direct runner raises
  `DecodingError` while injecting v0.6 message context; this is documented
  environment provenance and was not repaired.
- Adversarial: 44 PASS minimum met.
- Property: 12 PASS minimum met.
- Mutation: 24/24 killed.
- Frontend unit/integration: 46 PASS.
- Playwright: 16 PASS; console errors 0; horizontal overflow 0.
- Typecheck, build, interface parity, transaction recovery, GenVM lint, and
  secret scan: PASS.
- Focused fee-allocation regression: PASS.

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
- Payout: not attempted because supplier signer access is unavailable.

No contract source, ABI, state machine, accounting policy, or deployment was
changed during fee-allocation recovery.
