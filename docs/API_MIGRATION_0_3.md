# Procura API migration 0.3

Status: contract migration and storage-allocation remediation frozen; live value
qualification is blocked at the first value-exit attempt by Studio-dev fee
accounting.

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
Storage remediation commit: `c51aa2ae578ed84b3d681a15610010af45a1e6e1`.

Old source SHA-256:
`6d8e29e0de7c0ab01e1555ef81b59f682d6fdeb2a8597a797ed04f4d59747e76`

Pre-remediation source SHA-256:
`2db6fb65105b9dd330fd4dedec8c8995ee904cc54597465144e2e4695214efb4`.

Corrected frozen source SHA-256:
`81708da07492a1d0b6fd26ee804479d9cd371861bf3de4ed62283d65dceb4143`.

The target compatibility probes for custom storage, contract base,
`TreeMap`, and `DynArray` passed. Studio-dev schema-from-code returned 39
methods and non-transactional `gen_call` deploy returned result `00`. A whole
contract inventory found 11 direct generic `DynArray[str]()` constructions;
all 11 were replaced with runtime-safe empty sequence values for read-only
fallbacks. Persistent `DynArray`/`TreeMap`, in-memory allocation, nested
storage-record probes, and the full Procura-shaped allocation harness passed
against 5jyc.
Static differential review classified every production hunk as runner pin or
API namespace compatibility; no ABI or business semantic change was found.

Deployment #4 used the corrected bytes and finalized successfully at
`0xf74cee6667f2c57282df15976e661fc78c31cf6ab7b034df4e4856c4c17107fd`,
address `0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA`. The prior deployment
`0x25cDb9C8Bf6A647Cf964dA999d82fD802057f835` remains historical and
runtime-incompatible.

The new-address create-tender raw `gen_call` type=`write` preflight returned
`00`. The first controlled refund case then completed create, requirement,
freeze, and funding. Funding finalized with escrow and global liability of
`1000000000000000` wei. The single cancel/refund transaction
`0x17afb3ef3cd14c90960f5ea0e19534325a4bf6702d4f357cf9da3567790cf321`
finalized with `FINISHED_WITH_ERROR`:
`Mode1MessageFeesRequireGenVMPerEmissionSupport: fee-bearing GenVM messages
require a message allocation tree`. No refund effect was emitted and payout
qualification was not started. No retry was sent.
