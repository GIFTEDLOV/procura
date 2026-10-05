# Threat model

Primary risks are post-freeze mutation, late bids, forged evidence URLs, malformed semantic output, transport failures misclassified as non-compliance, duplicate transactions, double value exits, incorrect recipient addresses, and display of settlement before execution success.

Controls include immutable snapshots, strict hashes, evidence ownership, closed enums, fail-closed parsing, checks-effects-interactions, zero-address rejection, explicit transaction phases, same-hash reconciliation, canonical readback, and explicit demo/live modes.
# Gate 2 security review

Critical and High findings are fixed for the non-runtime release candidate.
The review specifically covered access control, frozen-state mutation, award
eligibility, evidence binding and SHA-256 identity, replayed cash exits,
recipient binding, zero addresses, deadline checks, semantic schema closure,
transport failure, stale frontend writes, and explicit controlled-demo mode.

Medium operational finding: native GEN funding/payout/refund remains unproven
because the installed Local Studio JSON-RPC web module does not start. This is
reported as a tooling blocker, not as a successful settlement claim.
