# Current live proofs

The canonical deployment has live proof for both semantic paths and both value exits:

| Proof | Result / value | Transaction |
| --- | --- | --- |
| Bid adjudication | `COMPLIANT` | `0xc1dfbb2ab71c6f5760834bf6607aaea81e7088daab95546b289592c0c990cbb6` |
| Delivery adjudication | `DELIVERY_ACCEPTED` | `0x13d0dcc025a08e51d2d0103d42b72eced5d387466efe83ef6183143b72a55935` |
| Buyer refund | `1000000000000000 wei` | `0x2b71e96260acc5b07f82ee4eabdfccf85e079575a24795339d6baf62cb46a536` |
| Supplier payout | `1000000000000000 wei` | `0x46c000b3ac9d5034d74b54a20a96f1a8b1299ca8c15929d5e168aac4b7b4ff18` |

Bid and delivery successful-result replay guards both passed. Deployment #6 qualification accounting is funded `2000000000000000`, payouts `1000000000000000`, refunds `1000000000000000`, escrow `0`, bond `0`, contract balance `0`, unexplained balance `0`.
