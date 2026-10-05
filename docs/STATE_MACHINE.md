# State machine

Tender: `DRAFT -> FROZEN -> FUNDED -> EVALUATING -> EVALUATED -> AWARDED`, with `CANCELLED` as an explicit pre-award terminal path.

Bid: `DRAFT -> SUBMITTED -> UNDER_EVALUATION -> COMPLIANT | NON_COMPLIANT`, then `AWARDED` or `NOT_AWARDED`; withdrawal is explicit and deterministic.

Delivery: `PENDING -> IN_TRANSIT -> DELIVERED -> UNDER_INSPECTION -> ACCEPTED | REJECTED`, with `DISPUTED` available before terminal settlement.

Award settlement is permitted only from an accepted delivery or a frozen dispute resolution path. Payout and refund are mutually exclusive terminal exits.
