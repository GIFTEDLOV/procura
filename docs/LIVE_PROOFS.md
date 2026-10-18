# Current Studionet LIVE proofs

Qualification case: `PROCURA-STUDIONET-QUAL-20261018143534` on Studionet chain `61999`, contract [0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929](https://explorer-studio.genlayer.com/address/0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929).

Each transaction below reached `FINALIZED`, had `MAJORITY_AGREE`, completed leader and validator execution successfully, returned EVM receipt status `0x1`, and was followed by canonical state readback. Explorer links point directly to the actual recorded transactions.

| Step | Transaction |
| --- | --- |
| `create_tender` | [0x418450771700f1e2a13362668964f08080128c9999ea5493dc93e2f79589fbe9](https://explorer-studio.genlayer.com/tx/0x418450771700f1e2a13362668964f08080128c9999ea5493dc93e2f79589fbe9) |
| `add_requirement` | [0xdb8c0cd7b2dff9c63bf791f20b51d615eb598574577200542d67c545c7aa1f46](https://explorer-studio.genlayer.com/tx/0xdb8c0cd7b2dff9c63bf791f20b51d615eb598574577200542d67c545c7aa1f46) |
| `freeze_tender` | [0xd5e47694d6d5c0897b67f324debd006f5b66bbba498526d447cb4f372eac951d](https://explorer-studio.genlayer.com/tx/0xd5e47694d6d5c0897b67f324debd006f5b66bbba498526d447cb4f372eac951d) |
| `fund_tender` (0.0001 GEN escrow) | [0xd44a7a75760154c766ab1d5eaa6330f7ce01bfe51798280be83dbf0d07b0bf7e](https://explorer-studio.genlayer.com/tx/0xd44a7a75760154c766ab1d5eaa6330f7ce01bfe51798280be83dbf0d07b0bf7e) |
| `submit_bid` | [0xee6a1ff4963c0ad2027db5b35f81465609317cbcd17e55db2e17af6d228ae72a](https://explorer-studio.genlayer.com/tx/0xee6a1ff4963c0ad2027db5b35f81465609317cbcd17e55db2e17af6d228ae72a) |
| `add_bid_evidence` | [0x15f0519f7bb86e1585456e3aed815ba0ae20bfd4d4268628b5bbf128c811839a](https://explorer-studio.genlayer.com/tx/0x15f0519f7bb86e1585456e3aed815ba0ae20bfd4d4268628b5bbf128c811839a) |
| `begin_bid_evaluation` | [0xf8e15552f374cfe7c4c2c554d2927bfb51b015f411b77d9572991997b7dddddb](https://explorer-studio.genlayer.com/tx/0xf8e15552f374cfe7c4c2c554d2927bfb51b015f411b77d9572991997b7dddddb) |
| `adjudicate_requirement` (`COMPLIANT`) | [0x4a82390e89d0aa06b4854a34a0587981f0b4ee4dd9af5817bcbf84802cc17f25](https://explorer-studio.genlayer.com/tx/0x4a82390e89d0aa06b4854a34a0587981f0b4ee4dd9af5817bcbf84802cc17f25) |
| `finalize_bid_evaluation` | [0xb179b7ea9b3f99548b5d539b41367ce656a13f621a86c7616448e884086cb9e8](https://explorer-studio.genlayer.com/tx/0xb179b7ea9b3f99548b5d539b41367ce656a13f621a86c7616448e884086cb9e8) |
| `award_bid` | [0xc050e6ff1266ed437bd3fe61848370866bf0bfac09baa6ca376b5ba8bbc23546](https://explorer-studio.genlayer.com/tx/0xc050e6ff1266ed437bd3fe61848370866bf0bfac09baa6ca376b5ba8bbc23546) |
| `accept_award` | [0xde9d6ea98ea143454a0ff0f81f6985ac9f5f46985c406e7a2b4d0e5297462af9](https://explorer-studio.genlayer.com/tx/0xde9d6ea98ea143454a0ff0f81f6985ac9f5f46985c406e7a2b4d0e5297462af9) |
| `create_delivery` | [0x290882df073c07992beffc6fbd69171ffe880cb5a7755320a5b9c8130983f9f8](https://explorer-studio.genlayer.com/tx/0x290882df073c07992beffc6fbd69171ffe880cb5a7755320a5b9c8130983f9f8) |
| `add_delivery_evidence` | [0x447ee32dec8c8d5dcc867affd27a651cac4d128d4afcd452680c8e16f74fbcfd](https://explorer-studio.genlayer.com/tx/0x447ee32dec8c8d5dcc867affd27a651cac4d128d4afcd452680c8e16f74fbcfd) |

## Canonical result

- Adjudication: `COMPLIANT`, `evidence_sufficient: true`, no material conflict.
- Award: `ACCEPTED`; funded and remaining escrow `100000000000000` wei; no payout or refund was made.
- Delivery: `DELIVERED`; one delivered artifact; delivery evidence recorded under the delivery ID.
- Evidence: official GenLayer Labs `genlayer-js@1.1.8` package manifest. The on-chain bytes have SHA-256 `0695982b068f8043a21b6d3ccfc10b5cb7aa5e945186a1e10fbe6f7113dd48cf`, length `2144`, and source URL [pinned package.json](https://raw.githubusercontent.com/genlayerlabs/genlayer-js/1b7f50a3a3f2963ea857941b0fb386081dd5c326/package.json). The source was fetched and verified through both `raw.githubusercontent.com` and jsDelivr.
- New escrow debit: `0.0001 GEN`; actual recorded transaction fees: `0 GEN`.
- Total liability at the candidate contract: `0.0003 GEN`, which includes `0.0002 GEN` of pre-existing unrelated liability.
- Pre-existing escrow balances on the other deployments were unchanged.

## Source and schema

- Contract source SHA-256: `a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac`
- Shared schema SHA-256: `21a63012d333ccb2e29c4cd799034c42b2183f7831f64e61157e75d85bbd1127`
- ABI SHA-256: `97015697a9252c5c2b86f4e72d76a926775eca14ec7add6c743ece0609edd800`
- Typed interface SHA-256: `b32e4393d90962f366a34bfcf6a7e373f324776ba7c95fb6c61a601cf9cdd01f`
- Deployment: [existing Studionet deployment transaction](https://explorer-studio.genlayer.com/tx/0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33); no additional deployment was submitted.

The durable transaction journal with nonces, argument hashes, consensus data, receipts, actual debit, and canonical readbacks is [evidence/qualification/current/procura-v2-studionet-v2-1-2-live.json`](../evidence/qualification/current/procura-v2-studionet-v2-1-2-live.json). Machine-readable release parity is in [evidence/release-provenance.json`](../evidence/release-provenance.json).
