# Qualification evidence

`studionet_evidence_qualification.mjs` is the resumable Studionet qualification
runner for the verified V2.1.2 source and canonical deployment. It verifies the
network, signer, source, method schema, existing transaction journal, finality,
execution result, and canonical readback before proceeding. Run it only with the
matching explicit qualification authorization.

`reconcile_v212_read_only.mjs` is the read-only Studionet transaction and state
reconciler.

`studio_live_qualification.py` and `_run_procura_json_semantic_probe.py` are
historical Studio-dev chain 61997 tools for a different deployment. They are
not the current qualification runner and their addresses, fees, or journal do
not apply to Studionet. Their original records remain under
`evidence/qualification/historical/`.

Current Studionet journals and the completion checkpoint are in
`evidence/qualification/current/`. Historical records and runtime compatibility
probes are preserved in their respective evidence directories; none grants
authorization for a new live write.
