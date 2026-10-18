# Current frontend

The production app uses Studionet chain `61999`, the verified V2.1.2 contract,
the shared deployed schema, and stable `genlayer-js@1.1.8`. It exposes explicit
LIVE, CONTROLLED DEMO, and HISTORICAL modes. LIVE reads never fill gaps from
demo fixtures.

The LIVE Tender Builder, Bid Builder, Bid Evidence, Delivery Workspace, and
Delivery Evidence controls call the contract through the typed adapter. The
adapter validates network, signer, roles, timestamps, SHA-256 values, argument
order, finality, execution, and canonical readback. Submitted hashes remain
available after a browser restart for same-hash recovery.

Studio-dev deployments and earlier V1 UI behaviors are historical. The
current contract, source hash, method transaction links, and test coverage are
documented in [LIVE deployment](LIVE_DEPLOYMENT.md), [LIVE proofs](LIVE_PROOFS.md),
and [frontend LIVE integration](FRONTEND_LIVE_INTEGRATION.md).
