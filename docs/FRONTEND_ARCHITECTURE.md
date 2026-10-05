# Frontend architecture

The Vite React application separates the application shell, screen surfaces, contract interface, demo/live data adapters, transaction engine, and validation schemas. TanStack Query owns read caching; React Hook Form + Zod own form state and serialization; the contract interface JSON is used for parity checks.

The three flagship surfaces are Evaluation Room, Inspection Room, and Settlement Ledger. Responsive layouts collapse the sidebar and turn wide matrices into horizontal scroll regions while preserving accessible labels and deterministic status language.
