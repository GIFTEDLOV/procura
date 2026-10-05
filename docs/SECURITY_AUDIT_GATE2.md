# Procura Security Audit — Gate 2

## Findings

Critical: 0  
High: 0  
Medium: 1  
Low: 0

### Medium — Local native value execution is unqualified

The installed Local Studio JSON-RPC service does not complete startup because
its web GenVM module reports `missing field session_create_request`. This
prevents proof of native balance movement. The application therefore keeps
settlement visibly blocked in controlled-demo mode and the qualification
driver refuses non-loopback endpoints unless explicitly invoked with
`--execute`.

## Controls verified

- buyer/supplier permission checks on deterministic writes;
- no post-freeze requirement mutation and no bid mutation surface;
- exact lowercase unprefixed SHA-256 evidence identity, duplicate-ID guard, and entity binding;
- closed semantic boolean vectors and canonical verdict enums;
- model has no authority over winner, price, amount, recipient, deadline, or state transition;
- payout/refund mutual exclusion, underflow checks, milestone replay guards, and zero-address guard;
- frozen bond policy forms and single bond exit;
- transaction hash persistence and same-hash recovery without rebroadcast;
- explicit LIVE versus CONTROLLED DEMO boundary in the frontend.
