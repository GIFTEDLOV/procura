# Contributing

1. Create a branch from `main`.
2. Keep contract changes separate from product changes; the published Procura contract is frozen.
3. Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and the relevant Playwright project from `frontend/`.
4. Do not commit secrets, wallet material, `.env` files, or raw private evidence.
5. Update current documentation and provenance when a product claim changes.
6. Open a pull request with a concise scope, test evidence, and screenshots for UI work.

All changes must preserve the LIVE / CONTROLLED DEMO / HISTORICAL PROOF boundary and fail closed when canonical state is unavailable.
