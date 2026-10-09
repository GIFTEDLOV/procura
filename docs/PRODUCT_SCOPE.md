# Procura product scope

Procura is a released procurement application positioned as **verifiable procurement from requirement to payment**. It serves buyers, suppliers, inspectors, and reviewers across the complete procurement lifecycle: frozen requirements, bids, bounded semantic conformity adjudication, awards, escrow, deliveries, inspection, payments, refunds, disputes, proof, and transaction recovery.

The current product release includes the frozen `PROCUREMENT_V1` contract, controlled demo data, canonical Studio-dev LIVE reads, explicit LIVE / CONTROLLED DEMO / HISTORICAL PROOF modes, wallet and role UX, typed write entry points, transaction recovery visibility, complete application surfaces, and a product landing page. The contract and deployment are frozen; v1.0.1 changes only the application, documentation, repository presentation, and production frontend.

## Controlled demo

The demo covers 100 industrial solar batteries. Supplier A is compliant; Supplier B fails the 6,000-cycle requirement; Supplier C claims an equivalent but cannot overcome the explicit cycle minimum. The awarded Product A is replaced by a lower-spec Product B and the inspection verdict is `MATERIAL_DELIVERY_MISMATCH`. The payment surface is blocked/refundable under frozen policy.
