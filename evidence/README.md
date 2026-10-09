# Evidence hierarchy

Evidence is separated by truth and use, not by convenience.

- `qualification/current/` — current canonical deployment qualification journals.
- `qualification/historical/` — superseded deployment and earlier qualification journals.
- `runtime-probes/` — diagnostic/runtime compatibility probes that are not current business qualification.
- `controlled/` — explicitly controlled demo fixtures and screenshots.
- `raw/` — original generated material retained for provenance when a normalized report is also published.

Every current claim must identify its deployment, transaction hash, source SHA, and mode. Historical records may be retained, but they must never be used as LIVE application state or current accounting.
