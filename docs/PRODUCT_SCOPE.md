# Procura product scope

Procura is a procurement application positioned as **verifiable procurement from requirement to payment**. It serves buyers, suppliers, inspectors, and reviewers across the complete procurement lifecycle: frozen requirements, bids, bounded semantic conformity adjudication, awards, escrow, deliveries, inspection, payments, refunds, disputes, proof, and transaction recovery.

Gate 1 is a foundation release. It provides the frozen `PROCUREMENT_V1` schema, a GenLayer contract surface, controlled demo data, value-transfer probe, explicit LIVE / CONTROLLED DEMO / HISTORICAL modes, frontend application shell, three flagship screens, and a transaction engine. Deployment and live writes are intentionally out of scope for this gate.

## Controlled demo

The demo covers 100 industrial solar batteries. Supplier A is compliant; Supplier B fails the 6,000-cycle requirement; Supplier C claims an equivalent but cannot overcome the explicit cycle minimum. The awarded Product A is replaced by a lower-spec Product B and the inspection verdict is `MATERIAL_DELIVERY_MISMATCH`. The payment surface is blocked/refundable under frozen policy.
