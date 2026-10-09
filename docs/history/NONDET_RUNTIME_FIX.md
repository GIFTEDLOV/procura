# Procura 5jyc semantic runtime fix

The frozen deployment reached `adjudicate_requirement` but failed before
semantic validation because 5jyc does not expose
`gl.vm.run_nondet_unsafe`. ClearLC established the compatible replacement:
`gl.vm.run_nondet_default`.

The remaining failure was transport-level. Procura requested text from
`gl.nondet.exec_prompt` while its strict semantic validators expected JSON;
Studio-dev consequently returned fenced JSON text and `json.loads()` rejected
it. The production fix is limited to the two bounded semantic paths:

- `run_nondet_unsafe` -> `run_nondet_default`;
- `exec_prompt(prompt)` -> `exec_prompt(prompt, response_format="json")`.

The 5jyc runner at commit
`acb37c7bf7b1e6d9fbfe004414a93fb6306135c0` decodes JSON responses with
`_decode_nondet_json`, and its official `call_llm_json` integration fixture
uses `response_format="json"`. The returned dictionary is accepted by the
existing transport branch; exact field sets and strict boolean types remain
fail-closed. No prompt, equivalence rule, business rule, payment policy,
state transition, storage layout, or ABI was changed.

The corrected temporary probe deployed once at
`0xAD920928752539Cf7f1f877B39BFEF6e4feEB342` and both requirement and delivery
transactions finalized with consensus and strict JSON payload readback. The
probe is runtime compatibility evidence only; an `INCONCLUSIVE` business
result would not require redeployment.

## Final Deployment #5 qualification

The authoritative 5jyc runner source at commit
`acb37c7bf7b1e6d9fbfe004414a93fb6306135c0` exposes the JSON-only
`response_format="json"` overload, returns a parsed dictionary through
`_decode_nondet_json`, and the official `call_llm_json` fixture uses that
mode. Procura's two bounded semantic paths now use that native transport and
`gl.vm.run_nondet_default`; strict payload validation remains unchanged.

Deployment #5 finalized at
`0x8fa58c5e6e956831f56eb402d38d0fefdb6e16b625e875fcd85ce1086a289154`,
address `0xE9f1319e98F25E301ee167aF41f82E25cC4f8770`, with source SHA-256
`95f7cc706decbb3e38eb0a1f6f0014ffc2279ac6c3d07d883199b44cacc36fed` and
39-method schema parity.

The corrected probe requirement and delivery transactions both finalized with
`MAJORITY_AGREE` and valid strict dictionaries. A one-wei requirement smoke
and one-wei delivery smoke also reached real semantic consensus. The final
fresh payout tuple reached compliant requirement and accepted delivery
consensus, then settled exactly `1000000000000000` wei to the frozen supplier.
The first final-payout diagnostic tuple reached `MAJORITY_DISAGREE`; it was
not retried or redeployed, and its funded escrow remains included in the
final conservation accounting.
