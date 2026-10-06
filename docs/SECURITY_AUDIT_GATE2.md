# Procura Security Audit — Gate 2

## Findings

Critical: 0  
High: 0  
Medium: 1  
Low: 0

### Medium — Local native value execution is unqualified

Target Studio-dev deployment and GenVM execution succeeded, but native value
movement is still unqualified. The first controlled refund-case setup write
failed before state creation because the CLI serialized an all-numeric hash as
an integer; no funding, refund, payout, or settlement proof was completed.
The local Windows/Python 3.14 direct-runner limitation remains tooling
provenance, not a Procura security finding.

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

The failed live setup is release-blocking until a later authorized pass uses a
correctly typed string hash and completes exact refund/payout balance and
accounting reconciliation. No source or guard was weakened to bypass it.
