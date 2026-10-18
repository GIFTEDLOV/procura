# Current deployment provenance

The current release targets the already deployed Procura V2.1.2 contract on Studionet. The qualification reused the verified contract and submitted no deployment transaction.

| Artifact | SHA-256 |
| --- | --- |
| `contracts/Procura.py` | `a74ae78774ea37d06af2b509d5c728d18c8f9a640a539a2f3575a17e1a28fdac` |
| `contracts/schema.v2.evidence.json` | `21a63012d333ccb2e29c4cd799034c42b2183f7831f64e61157e75d85bbd1127` |
| `contracts/abi.v2.evidence.json` | `97015697a9252c5c2b86f4e72d76a926775eca14ec7add6c743ece0609edd800` |
| `contracts/interface.v2.evidence.json` | `b32e4393d90962f366a34bfcf6a7e373f324776ba7c95fb6c61a601cf9cdd01f` |

Contract and schema parity was checked against Studionet chain `61999` at `0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929`. The current deployment transaction is [`0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33`](https://explorer-studio.genlayer.com/tx/0x82cc2deec80db1f383200ad46e8c1062a64108782eced48a7ad7fc9e49f7ec33).

The complete 13-write journal records signer, nonce, method, argument hash, submission hash, consensus, execution, EVM receipt, actual fees, transferred value, and canonical readback for each operation. It is stored in [`evidence/qualification/current/procura-v2-studionet-v2-1-2-live.json`](../evidence/qualification/current/procura-v2-studionet-v2-1-2-live.json). [`evidence/release-provenance.json`](../evidence/release-provenance.json) freezes the release artifact hashes and reconciled accounting.

Qualification accounting records `0.0001 GEN` transferred to escrow and `0 GEN` in actual transaction fees. Contract liability totals `0.0003 GEN`, including `0.0002 GEN` predating this qualification. The recorded balances of historical deployments were unchanged. Historical Studio-dev deployment and value records are preserved in [`docs/history/DEPLOYMENT_PROVENANCE_STUDIODEV.md`](history/DEPLOYMENT_PROVENANCE_STUDIODEV.md) and `evidence/qualification/historical/`.
