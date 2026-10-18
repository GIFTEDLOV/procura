# Procura Studionet release checkpoint

Updated: 2026-10-18

## Live deployment and reconciliation

- Network: GenLayer Studionet, chain `61999`, RPC `https://studio.genlayer.com/api`.
- Contract: `0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929`; source SHA-256 `a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac`.
- Reused deployment transaction: `0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33`; this qualification made no deployment.
- The current source and deployed source hashes match. Local deployed schema, ABI, and typed-interface hashes are in `evidence/release-provenance.json`; all 39 runtime methods were verified, including exact signatures for the five reviewer methods.
- Stable `genlayer-js@1.1.8` is the only GenLayer SDK dependency in the frontend. Stable reads work; stable writes estimate actual calldata gas and gas price, then request the EIP-1193 wallet transaction.
- Fresh read-only reconciliation at `2026-10-18T15:34:30.732Z` enumerated six tenders and 33 transactions for the target contract. It confirms source parity, current accounting, complete qualification state, and unchanged historical escrow. See [`procura-v2-studionet-v2-1-2-reconciliation-2026-10-18.json`](procura-v2-studionet-v2-1-2-reconciliation-2026-10-18.json).
- Buyer nonce is `455/455` latest/pending, with zero pending transactions. Supplier nonce is `20/20`, with zero pending transactions. Candidate contract balance/liability is `0.0003 GEN`. The duplicate address `0x3801344A8963F7067f55dA584c0Df156e70326A9` has zero balance; it is not used.
- Historical escrow across six other contracts is unchanged at `2.5013 GEN`. None of those balances was transferred or included in this qualification.

## Prior failure diagnosis

The earlier case `PROCURA-CLOUD-REVIEWER-20261016-C` finalized `MAJORITY_DISAGREE` because its objective requirement used unsupported comparator `EQ`; the leader error was `objective semver operator is unsupported`. A separate old freeze failed because that tender had no requirement. Neither failed transaction was repeated. The successful case uses the supported SemVer `>=` comparison and genuine pinned package bytes retrieved from two independent public hosts.

## Qualification complete

Case: `PROCURA-STUDIONET-QUAL-20261018143534`. The complete 13-write lifecycle finalized with `MAJORITY_AGREE`, successful leader/validator execution, EVM receipt status `0x1`, and canonical readback for every write. No operation entered `READY_TO_FINALIZE`, so no finalization call was needed.

- All five steward-required methods pass LIVE: `create_tender`, `submit_bid`, `add_bid_evidence`, `create_delivery`, and `add_delivery_evidence`.
- Adjudication: `COMPLIANT`, `evidence_sufficient=true`, material conflict false.
- Award: `ACCEPTED`; escrow remains `100000000000000` wei.
- Delivery: `DELIVERED`; delivery evidence is recorded canonically.
- Evidence: pinned official GenLayer Labs `genlayer-js@1.1.8` package manifest, SHA-256 `0695982b068f8043a21b6d3ccfc10b5cb7aa5e945186a1e10fbe6f7113dd48cf`, 2,144 bytes. Both raw GitHub and jsDelivr were verified.
- Actual new escrow debit: `0.0001 GEN`; actual transaction fees: `0 GEN`. The aggregate authorization ceiling was `0.001 GEN` and the realized debit is within it.
- Candidate liability is `0.0003 GEN`: `0.0001 GEN` for this award and `0.0002 GEN` pre-existing for other cases.

Full transaction details and hashes: [`procura-v2-studionet-v2-1-2-live.json`](procura-v2-studionet-v2-1-2-live.json) and [reviewer transaction links](../../../../docs/LIVE_PROOFS.md). The before/after read-only capture is also preserved as [`procura-v2-studionet-v2-1-2-reconciliation-before-final-frontend-2026-10-18.json`](procura-v2-studionet-v2-1-2-reconciliation-before-final-frontend-2026-10-18.json).

## Frontend and release progress

- LIVE network and contract configuration are Studionet `61999` and the verified address. All five controls are enabled and mapped through the deployed shared schema.
- Stable writer types replace RC client types. The wallet must match the provider bound to the SDK client; one wallet submission is permitted per write attempt; its hash is persisted before finality polling; unknown outcomes resume the same hash.
- The Proof & Audit page reads all 13 proof rows, case verdict, award/delivery state, and artifact identity from `evidence/release-provenance.json`. Focused UI tests assert the 13 explorer URLs and evidence hash/length.
- Local verification: 86 frontend tests passed; typecheck passed; production build passed (Vite reports the existing large main-chunk warning); 172 Python tests passed and 12 direct-runtime cases skipped; schema parity passed; 7 transaction-safety checks passed; full browser E2E passed (60 passed, 4 intentionally skipped). The direct GenVM cases are skipped because the pinned `genlayer-test==0.30.0rc2` adapter only supports the v0.3 calldata/storage API, while this V2.1.2 source uses v0.6. The complete same-source qualification has successful LIVE validator consensus and canonical readbacks; no local result is represented as LIVE proof.
- PR #9 work is kept in `.worktrees/steward-v212`; the root workspace's separate dirty branch was not changed. The exact-commit GitHub CI, merge, and deployment to the verified `procura` Vercel project remain to complete. Portal submission remains reserved for the user.

## Authorization boundary

The recorded user authorization covered zero deployments and up to 13 qualification writes with a `0.001 GEN` aggregate maximum. It did not authorize any retry of failed public operations, GitHub publication, Vercel deployment, or Portal submission. The user has since authorized the complete GitHub and Vercel release. The GenLayer Portal submission must still be done manually by the user.
