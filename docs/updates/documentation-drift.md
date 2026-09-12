# PlotPickle Documentation Drift Detection

Deterministic repository-native freshness evidence. Detection is separate from modification; this report never rewrites Human-authored documentation.

Source: `architecture/plotpickle.architecture.json`  
Source fingerprint: `sha256:92ad6f9591530ef3b5fb161edb5051f92d624f83da8c3d939f8d038ea9efee9c`  
Overall status: **REVIEW**

## Status model

| Status | Meaning |
|---|---|
| CURRENT | Deterministic evidence matches the declared current source. |
| STALE | A governed dependency or generated projection changed underneath the committed output. |
| MISSING | A required/current owner or generated output is absent. |
| CONFLICT | Deterministic evidence proves contradictory or malformed ownership/managed-block state. |
| REVIEW | Deterministic evidence cannot establish semantic correctness; Human review remains appropriate. |

## Current evidence

| Surface | Status | Evidence |
|---|---|---|
| Architecture Knowledge Map | CURRENT | architecture/plotpickle.architecture.json is the canonical machine-readable owner (sha256:92ad6f9591530ef3b5fb161edb5051f92d624f83da8c3d939f8d038ea9efee9c). |
| Architecture Documentation | REVIEW | architecture/README.md is Human-authored guidance; deterministic generation does not rewrite its semantics. |
| Generated architecture bundle | CURRENT | Existing architecture generator check is synchronized. |
| Agent Context | CURRENT | Generated from architecture/plotpickle.architecture.json at sha256:92ad6f9591530ef3b5fb161edb5051f92d624f83da8c3d939f8d038ea9efee9c. |
| C4 projections | CURRENT | Generated from architecture/plotpickle.architecture.json at sha256:92ad6f9591530ef3b5fb161edb5051f92d624f83da8c3d939f8d038ea9efee9c. |

Blocking drift is limited to STALE, MISSING and CONFLICT. REVIEW is advisory and must not become automatic document rewriting or merge authority.
