# Issue #1648 Deterministic Validation and Bounded Repair

Slice D of #1644 integrates existing PlotPickle validators with the canonical lifecycle. It does not create another validation framework.

The normalization and repair adapter is `core/lifecycle/lifecycle-validation.mjs`. Existing gate ownership is recorded in `config/lifecycle-validation-gates.json`.

## Validation evidence

Every lifecycle validation result records:

- stable check identity;
- `pass`, `fail` or `blocked` result;
- scope reference;
- exact revision/head reference;
- authoritative validator reference;
- reason reference;
- evidence references;
- authoritative rerun reference;
- safe next action;
- stable failure fingerprint for non-pass results.

The evidence is reference-only. It does not copy logs, prompts, credentials, private story data or hidden reasoning into lifecycle state.

## Existing validators

The lifecycle map points to the existing BEN, LEARN, Visual Readiness, Autonomous QA, Repository Architecture Inventory, Story Workbench, Story Decisions, Hardware-Aware Local AI, Windows Installer and Full Verification workflows. These validators retain their current implementation and ownership.

Adding a gate to the lifecycle does not create a weaker duplicate check. The existing validator remains authoritative.

## Repair rule

A deterministic `pass` advances toward Approve/Persist. A deterministic `blocked` result stops; an AI worker cannot waive it.

A deterministic `fail` may authorize one bounded repair attempt only while the lifecycle repair budget remains. The repair instruction preserves the original check identity, validation authority and rerun route.

After repair, the same authoritative check must run against a fresh exact revision/head. A different validator cannot certify the repair merely because it passes.

A repair actor cannot be the authoritative validator for its own output.

## Stop conditions

Repair stops instead of looping when:

- retry budget is exhausted;
- the same failure fingerprint repeats without resolution;
- failure fingerprints cycle, indicating repair churn;
- the authoritative validator reports `blocked`.

No lifecycle code automatically weakens, skips or waives a deterministic failure.

## Relationship to existing verification findings

`scripts/verification-findings.mjs` remains the existing finding/dedupe/repair-cluster mechanism. The lifecycle adapter does not replace it. Its failure fingerprint is only the cross-lifecycle identity needed to decide whether bounded repair is progressing, repeating or churning.

## Stopping rule

#1648 ends at the validation-evidence and bounded-repair handoff. It does not rewrite BEN, LEARN, Visual Readiness, autonomous QA, story checks or packaging. #1649 uses these contracts in the real autonomous Guest end-to-end reference journey.