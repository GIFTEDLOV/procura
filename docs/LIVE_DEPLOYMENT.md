# Current LIVE deployment

The production target is the existing V2.1.2 Studionet deployment. Qualification reused it and did not deploy a contract.

| Field | Value |
| --- | --- |
| Network | GenLayer Studionet |
| Chain | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | `https://explorer-studio.genlayer.com` |
| Contract | [`0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929`](https://explorer-studio.genlayer.com/address/0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929) |
| Source SHA-256 | `a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac` |
| Deployment transaction | [`0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33`](https://explorer-studio.genlayer.com/tx/0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33) |
| Runtime schema | 39 methods; exact deployed parity verified |
| Frontend SDK | `genlayer-js@1.1.8` stable |

The deployment transaction finalized with `MAJORITY_AGREE`, successful execution, successful EVM receipt, and exact source parity. The qualification journal also reconciles the current contract, signer nonce, all 13 new writes, and pre-existing escrow. See [`release-provenance.json`](../evidence/release-provenance.json) and [LIVE proof links](LIVE_PROOFS.md).

Studio-dev chain 61997 and Bradbury chain 4221 are not the current release network. Their old source, fees, addresses, balances, and proofs are not reused for this Studionet deployment. Previous Studio-dev deployments are archived in [history](history/README.md).
