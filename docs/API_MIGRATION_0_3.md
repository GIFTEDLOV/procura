# Procura API migration 0.3

Status: contract migration frozen; live value qualification blocked before funding.

The production contract was migrated from the legacy `1jb` runner/API to the
Studio-dev `5jyc` API without changing business logic, access control,
accounting, state transitions, or the public interface.

| Legacy | Current |
| --- | --- |
| `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| `gl.Contract` | `gl.contract.Contract` |
| bare `allow_storage` | `gl.storage.allow` |
| legacy `DynArray` | `gl.storage.DynArray` |
| `gl.message_raw` | `gl.message.raw` |

Migration commit: `20cad7f76d6dd01342879b6276d03d3d993540da`.

Old source SHA-256:
`6d8e29e0de7c0ab01e1555ef81b59f682d6fdeb2a8597a797ed04f4d59747e76`

Frozen migrated source SHA-256:
`2db6fb65105b9dd330fd4dedec8c8995ee904cc54597465144e2e4695214efb4`.

The target compatibility probes for custom storage, contract base,
`TreeMap`, and `DynArray` passed. Studio-dev schema-from-code returned 39
methods and non-transactional `gen_call` deploy returned result `00`.
Static differential review classified every production hunk as runner pin or
API namespace compatibility; no ABI or business semantic change was found.
