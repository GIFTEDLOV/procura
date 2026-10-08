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
