# Harness lifecycle presentation

Issue #1650 projects the canonical #1644 lifecycle into plain language without creating another lifecycle owner.

## Authority rule

`core/lifecycle/lifecycle-contract.mjs` remains authoritative for lifecycle shape and transitions. `core/lifecycle/lifecycle-authority.mjs` remains authoritative for capability, persistence and continuation decisions. `core/lifecycle/lifecycle-validation.mjs` remains the projection boundary for deterministic validation and bounded repair.

`core/lifecycle/lifecycle-presentation.mjs` is presentation-only. It first normalizes the supplied canonical lifecycle envelope and then derives labels. It cannot transition a run, grant a capability, approve persistence, change authority or certify validation.

## Plain-language states

The presentation projection has six user-facing states:

- `normal` — the run is moving through an ordinary lifecycle stage.
- `repairing` — authoritative validation failed and a bounded repair attempt remains.
- `paused` — the canonical stop reason says the run is safely paused and a continuation reference may be retained.
- `awaiting-policy` — persistence is pending an existing harness policy decision.
- `failed` — validation is blocked, a stop reason is active, or the bounded repair budget is exhausted.
- `completed` — the run reached Package / Present / Continue with a valid continuation action.

These are labels over canonical state, not new state values stored alongside it.

## What the user can see

The projection exposes:

- current plain-language state;
- current lifecycle stage and seven-stage progress;
- active authority class in plain language;
- validation status;
- persistence status;
- stop reason code when present;
- the next safe action;
- whether continuation exists.

A separate `technicalEvidence` object retains bounded references to validation authority, evidence, approval and continuation. The lifecycle contract already rejects credential, private-key, hidden-reasoning, prompt/transcript and raw-story-text fields before presentation can occur.

## Human versus autonomous approval

A Guest persistence decision is always presented as autonomous policy and explicitly not Human approval. A Human actor is labelled as Human authority. Presentation does not infer or manufacture Human approval from a generic approval reference.

## Resume and packaged results

`presentLifecycleProof()` accepts the canonical stage envelopes already preserved by the autonomous reference proof and returns one current presentation plus the complete presentation history. A packaged result therefore restores status by re-projecting the preserved canonical envelopes; the UI/report never needs its own lifecycle database.

Consumers should persist the canonical envelope/proof and recompute presentation when opened. Do not persist a presentation label as an authority source.

## Existing reference status surface

The existing one-command Afterglow autonomous reference controller now writes both the canonical `lifecycleProof` and its derived `lifecyclePresentation` into `autonomous-story-reference.json`. Its existing Markdown report renders the derived plain-language status, stage/progress, active authority, validation, persistence, stop reason and next safe action, followed by the bounded technical evidence.

The report does not infer lifecycle state from the active workspace, route name, provider health or visual appearance. If the canonical proof cannot be constructed, the presentation is unavailable and the run remains failed rather than manufacturing a plausible status.

## UI rule

Existing Experience surfaces may render this projection when they have a canonical lifecycle envelope or proof. If no canonical lifecycle source is available, the surface must say that no active lifecycle status is available rather than guessing from workspace navigation, provider activity or visual appearance.

This is intentionally narrower than a new status service or workspace. It gives existing status and result surfaces one vocabulary while keeping lifecycle truth in Core.
