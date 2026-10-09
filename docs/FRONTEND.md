# Current frontend

The production frontend is a light-first institutional procurement control plane. `/` is the public landing page; `/app/*` contains the operating surfaces. Legacy flat routes redirect into `/app/*`, while unknown routes render a deliberate 404.

All data is labelled as LIVE, CONTROLLED DEMO, or HISTORICAL PROOF. LIVE reads use canonical Studio-dev state and finite query freshness. Public reads work without a wallet. LIVE writes use EIP-1193 wallet connection, frozen role/network guards, typed actions, persisted transaction hashes, finality/execution checks, and canonical readback.

Responsive targets are 1440, 1024, 430, and 390 pixels. Wide comparison tables use contained scrolling; the page itself is kept overflow-free. Focus-visible controls, labelled forms, explicit status text, reduced-motion support, and mobile navigation are covered by the browser suite.
