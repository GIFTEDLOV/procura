# Testing and release gates

The exact current counts are recorded by the release CI run and its attached artifacts. The baseline release includes 167 Python tests, 44 adversarial tests, 24/24 mutants killed, and 54 frontend unit tests. The v1.0.1 browser matrix covers landing, route identity, mode separation, wallet states, readback states, evidence surfaces, mobile navigation, screenshots, and page overflow/error checks.

Required local gates:

```powershell
py -m pytest -q
cd frontend
pnpm test
pnpm typecheck
pnpm build
pnpm e2e
```

Nine E014 `gl.storage.allow` findings remain documented tooling false positives only.
