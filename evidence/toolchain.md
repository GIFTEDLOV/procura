# Historical Gate 1 preflight evidence

This file records the initial repository/toolchain checkpoint only. It is not
the current release gate. Current release truth is in `docs/TESTING.md` and the
exact-head CI run.

- Workspace: local Procura checkout
- Starting repository: empty directory, no Git repository, no starting commit
- Node: `v24.14.0`
- pnpm: `11.0.9`
- Python: `3.14.3`
- pip: `25.3`
- Git: `2.53.0.windows.2`
- GenLayer CLI: `0.40.0-rc.3`
- Python runtime: `genlayer-py 0.19.0rc2`, `genlayer-test 0.30.0rc2`, `pytest 9.1.1`
- Property testing: `hypothesis 6.168.4` installed during Gate 1
- GenVM linter: `genvm-linter 0.11.1rc2` installed at the Python Scripts path; `genvm-lint` is not on PATH. A contract check was attempted but did not complete within the local artifact setup window.
- Starting head: `NONE (repository initialized during Gate 1)`
- Starting worktree: empty before foundation files

## Runtime probe observation

The source-level probe reports the current incoming and outgoing primitives. The installed direct test runner was also exercised, but its Windows/Python 3.14 message bootstrap raised `genlayer.py.calldata.DecodingError: unexpected end of memory` before loading the probe contract. That test is explicitly skipped in the Gate 1 suite and is a Gate 2 localnet/glsim task.

No deployment, Vercel project, GitHub push, or live write was performed.
