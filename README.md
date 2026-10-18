# Procura

## Procurement you can prove

Procura records procurement requirements, bids, evidence, adjudication, awards, and deliveries in a GenLayer intelligent contract. This release completes the steward's five LIVE workflow methods on Studionet and connects the application to the verified contract and shared schema.

**[Open Procura](https://procura-kappa-two.vercel.app)** · **[Inspect LIVE proof](https://procura-kappa-two.vercel.app/app/proof-audit)** · **[GitHub repository](https://github.com/GIFTEDLOV/procura)** · **[Current release evidence](evidence/release-provenance.json)**

## Verified deployment

| Field | Value |
| --- | --- |
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Contract | [`0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929`](https://explorer-studio.genlayer.com/address/0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929) |
| Source SHA-256 | `a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac` |
| Reused deployment transaction | [`0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33`](https://explorer-studio.genlayer.com/tx/0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33) |
| SDK | `genlayer-js@1.1.8` stable |

The qualification reused the existing deployment and performed no redeployment. The local schema, ABI, and typed interface hashes are frozen in [release provenance](evidence/release-provenance.json).

## LIVE qualification

All 13 writes in the minimum procurement lifecycle finalized with `MAJORITY_AGREE`, successful execution, successful EVM receipts, and canonical readbacks. The five steward-required methods all passed LIVE:

- `create_tender`
- `submit_bid`
- `add_bid_evidence`
- `create_delivery`
- `add_delivery_evidence`

The genuine case used the pinned GenLayer Labs SDK package manifest, whose on-chain evidence records the exact URL, SHA-256, byte length, and timestamps. Adjudication was `COMPLIANT` with sufficient evidence; the award is `ACCEPTED`; the delivery is `DELIVERED`; delivery evidence is canonical. Full transaction links and readbacks are in [LIVE proofs](docs/LIVE_PROOFS.md) and the [durable qualification journal](evidence/qualification/current/procura-v2-studionet-v2-1-2-live.json).

The qualification transferred `0.0001 GEN` into escrow; recorded transaction fees were `0 GEN`. Current candidate-contract liability is `0.0003 GEN`: `0.0001 GEN` for this case and `0.0002 GEN` from prior unrelated activity. Historical escrow across the other deployments was unchanged. These totals are in [release provenance](evidence/release-provenance.json).

## Product modes and writes

The application separates **LIVE**, **CONTROLLED DEMO**, and **HISTORICAL** records. LIVE reads use canonical Studionet state and do not fall back to fixture data. LIVE writes use the shared schema, UTC timestamp and SHA-256 serializers, signer/network/role checks, a persisted transaction journal, same-hash recovery, finality and execution verification, and canonical readback. The browser uses the pinned stable SDK's per-call gas estimate and wallet fee confirmation. Unsupported external payout methods remain disabled until their Studionet message-fee route is verified.

See [frontend integration](docs/FRONTEND_LIVE_INTEGRATION.md), [fee policy](docs/FEE_POLICY.md), and the [historical deployment records](docs/history/README.md).

## Run locally

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm e2e
```

Contract and release checks:

```powershell
py -m pytest -q
py scripts/check_steward_v212_schema.py
node scripts/qualification/transaction-safety.test.mjs
```

## Reviewer note

The exact steward request was to make `create_tender` and `submit_bid` send contract-valid timestamp strings and lowercase 64-character SHA-256 values, connect delivery and evidence actions to the deployed contract, and test mappings through the shared schema. The release meets that request with the complete LIVE lifecycle and verified transaction/readback evidence above. The GenLayer Portal submission is prepared for the user; this repository automation does not submit it.
