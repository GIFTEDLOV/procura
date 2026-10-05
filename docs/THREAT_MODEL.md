# Threat model

Primary risks are post-freeze mutation, late bids, forged evidence URLs, malformed semantic output, transport failures misclassified as non-compliance, duplicate transactions, double value exits, incorrect recipient addresses, and display of settlement before execution success.

Controls include immutable snapshots, strict hashes, evidence ownership, closed enums, fail-closed parsing, checks-effects-interactions, zero-address rejection, explicit transaction phases, same-hash reconciliation, canonical readback, and explicit demo/live modes.
