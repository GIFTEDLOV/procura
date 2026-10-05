# Frontend architecture

The Vite React application separates the application shell, screen surfaces, contract interface, demo/live data adapters, transaction engine, and validation schemas. TanStack Query owns read caching; React Hook Form + Zod own form state and serialization; the contract interface JSON is used for parity checks.

The three flagship surfaces are Evaluation Room, Inspection Room, and Settlement Ledger. Responsive layouts collapse the sidebar and turn wide matrices into horizontal scroll regions while preserving accessible labels and deterministic status language.
# Gate 2 frontend hardening

All core route families now render explicit controlled-demo populated state,
and the application exposes loading, empty, and RPC-error readback states
without inventing live protocol data. Contract writes are prepared through the
typed domain action builder, the schema manifest, and the transaction recovery
boundary. The interface manifest is derived from `contracts/schema.json`.

Playwright covers desktop 1440, tablet 1024, and mobile 430/390 viewports. The
flagship screens retain the light enterprise visual language and produce
qualification screenshots under `evidence/screenshots/`.
