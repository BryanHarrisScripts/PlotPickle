# Require approved truth for future tests across all seven layers

## Human authority and outcome

“Can we continue then, so that all future tests are conducted by approved truth, beyond just Save/Lock.”

This extends issue #2932 and merged PR #2933. All future test additions and revisions must start from approved meaning, preserve it, and report only the evidence actually collected. More green tests are not the success criterion.

## Existing owners and assessment

GO: evolve the existing canonical `config/verification/test-catalog.json`, its schema, the seven-layer CI adapter, local verification CLI and evidence contracts. The catalogue currently has 49 groups and 233 targets. Add a mandatory admission check before layer execution, not a parallel Product Truth engine or a replacement test runner.

The approved white paper v3.0 supplies independent-verification and preservation obligations. Existing approved PP-SAVE-001 and PP-NARR-001 v1.0.0, plus the Human-established PP-COMP-002 source edition, supply product obligations. Proposed PP-NARR-SEQ-001 cannot acquire approval by appearing in a test binding. Do not invent a semver for an unversioned approved document; record its exact content-addressed edition.

## Implementation contract

1. Extend the catalogue with an index of existing approved sources and test-to-obligation bindings. Each source records its canonical document, exact edition/hash, approval provenance and named obligation anchors. The index is a reference to approved meaning, not another authority that can rewrite it.
2. Each binding records the complete target/source digest, owning catalogue groups/layers, specific approved obligations, evidence scope, and explicit limits. The normative oracle is extracted from the pinned approved document, never from implementation output or a model's success explanation. A file binding governs all cases in that file; changing or adding a case changes the complete file digest and requires renewed binding/review. This is not a claim that every assertion's semantic fidelity can be proved automatically.
3. Block any new or modified test source, helper/fixture source input, or newly introduced runner target without a valid binding. A helper/input can be declared by its owning bound test rather than incorrectly becoming a runnable target. Require new runnable tests to be registered under the existing catalogue. Renames, changed sources, missing obligations, wrong editions, unregistered targets and stale bindings cannot silently inherit permission.
4. Enforce the same admission decision before execution in each of the seven architecture layers and in local run-layer commands. CI compares the PR with its trusted base; local execution also checks working-tree test edits. Missing comparison authority is BLOCKED, not an empty green plan.
5. Approval cannot be manufactured by adding a new document/APPROVED label in the implementation PR. Normative documents must already exist unchanged in the trusted base. Existing indexed approval/source descriptors remain immutable in an ordinary implementation change; a changed promise needs a separate explicit Human-approved contract amendment before tests may rely on its successor edition.
6. Retain untouched legacy tests as bounded execution-only evidence. Every future change/new target is admitted under approved truth. This prospective gate does not pretend to have audited every historical assertion. Seed additional concrete bindings for Local Writing and narration/source identity to demonstrate adoption beyond Save/Lock.
7. Emit the selected test's approved source/version/obligation references and declared evidence scope with the existing execution claims. Binding admission and test exit zero never imply real device/provider/restart success or Human artistic acceptance. Product outcomes remain subject to independent Casebook/DSDD evidence.

## Validation and acceptance

Use deterministic positive and adversarial tests for all seven layers: missing binding, new unregistered test, modified case/source, changed helper, stale digest, proposed/unapproved oracle, wrong obligation/version, source changed in the same PR, altered approval metadata, missing base, and rename. Valid bindings using pre-existing approved sources must still execute. Retain skip/blocked/unproven scope.

Run the admitted governance regression through the existing Layer 7 catalogue, focused narration/Local Writing regressions, focused UAT contracts, production build, convergence and exact-head GitHub checks. The guard is necessary governance, not an automatic proof that a test correctly expresses the Human's meaning; review still examines expected outcomes and meaningful negative controls.

## Scope and delivery

No provider calls, paid media, story-data migration, changes to approved narration/provider/Save semantics or new runtime dependency. No silent reclassification of proposed truths. No full historical suite rewrite solely to make this PR green.

Prepare the implementation PR after local validation. Merge authority for the prior PR does not automatically authorize merge of this new change. Independent live DSDD receipt integration, actual Windows Save/Lock recovery and measured reduction in escaped user failures remain separate evidence work under #2932.
