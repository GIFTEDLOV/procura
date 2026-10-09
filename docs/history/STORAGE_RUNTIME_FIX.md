# Studio-dev 5jyc storage runtime fix

## Defect

Deployment #3 finalized with the migrated 5jyc API and 39-method schema, but
its first business write failed in `create_tender` because the 5jyc runtime
does not permit user construction of a generic persistent collection:

`TypeError: this class can't be instantiated by user`

The failing expression was `gl.storage.DynArray[str]()`. Deployment #3 remains
historical and is not the canonical Procura address.

## Remediation

A text and AST inventory found 11 direct generic storage constructors, all
`DynArray[str]()` expressions. Persistent `DynArray` and `TreeMap` fields were
left as annotations. The 11 runtime expressions were replaced with ordinary
empty sequence values at the read-only fallback/record-initialization sites;
no persistent collection was instantiated by user code.

Studio-dev 5jyc non-transactional probes passed for persistent DynArray,
persistent TreeMap, in-memory DynArray allocation, in-memory TreeMap
allocation, storage-allowed records containing each collection, nested
Procura-shaped records, and the complete allocation harness. The permanent
static regression rejects unsupported direct `DynArray[T]()` and
`TreeMap[K,V]()` calls.

## Artifact proof

- Storage fix commit: `c51aa2ae578ed84b3d681a15610010af45a1e6e1`
- Corrected source SHA-256:
  `81708da07492a1d0b6fd26ee804479d9cd371861bf3de4ed62283d65dceb4143`
- Schema-from-code: PASS, 39 methods
- Corrected deploy simulation: PASS, result `00`
- Full allocation harness: PASS, result `00`
- Contract business logic, access control, accounting, state machine, and ABI:
  unchanged

Deployment #4 of the corrected bytes finalized at
`0xf74cee6667f2c57282df15976e661fc78c31cf6ab7b034df4e4856c4c17107fd`,
address `0x0DAC4cbc32052c07641645c94997cc27EdE9CAbA`.

The subsequent live refund qualification passed create, requirement, freeze,
and funding, proving the storage defect was removed. Qualification stopped at
the single cancel/refund write because Studio-dev required a message allocation
tree for the fee-bearing external transfer. That later fee-accounting blocker
does not change this storage result.
