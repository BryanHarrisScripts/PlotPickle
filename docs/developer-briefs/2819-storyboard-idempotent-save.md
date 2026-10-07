# #2819 — Storyboard idempotent Save across Lock/Unlock and reload

## Context

Live UAT after #2817 / PR #2818 showed that the Storyboard Save contract is still incomplete.

#2818 improved save durability by writing against the latest persisted project state, but it did not remove the older rule that disables Save whenever the selected artifact is already marked `savedLocally`.

That older rule came from the #2806 Lock/Unlock work and is also explicitly protected by the #2806 regression test.

The Human intent is different:

> Save is idempotent.

If the exact same Storyboard artifact/file is already durably saved, pressing Save again must remain valid. PlotPickle does not need to duplicate, overwrite, or rewrite the file. It can detect that the artifact is already saved and return immediately, but the UI must continue to show that the artifact is Saved.

Lock and Unlock are separate review-state actions. They must not erase, invalidate, or block the saved state.

## Observed failure

The current sequence can behave incorrectly:

1. Save a Storyboard version.
2. Lock the version.
3. Unlock the version.
4. Attempt to Save again.
5. Save is disabled because `savedLocally === true`.

This can leave the Human unable to explicitly re-confirm Save and can surface a contradictory or confusing status even though the exact same artifact is already saved.

The merged code currently treats `savedLocally` as a Save-button disable condition, and the existing #2806 regression test asserts that behavior.

## Intended product contract

For the same Storyboard artifact:

- Save remains available when an artifact is already saved.
- Repeated Save is harmless and idempotent.
- Repeated Save does not create another visual artifact.
- Repeated Save does not duplicate the underlying local resource.
- Repeated Save does not unnecessarily overwrite the same file.
- If the exact artifact is already saved, PlotPickle may return `Already saved`, `Saved locally`, or equivalent.
- The persistent state must remain Saved.
- Lock and Unlock remain independent from Save.
- Unlocking a saved artifact does not remove its local-save marker.
- Re-locking a saved artifact reports `Locked · Saved locally`.
- Reloading the story preserves the saved state.
- Local-resource restoration preserves the saved state.
- Previs continues to accept the saved+locked artifact as an authoritative saved Storyboard image.

## Required implementation

### 1. Save button availability

Remove `savedLocally` as a reason to disable Save.

Save should only be unavailable when there is no valid selected artifact or when another legitimate boundary applies, such as QA-only access, inaccessible Storyboard state, or an active conflicting operation.

### 2. Idempotent save handler

Update `saveFrameVersion` so it resolves the latest persisted project and exact current artifact.

If the exact artifact already contains `STORYBOARD_LOCAL_SAVE_MARKER`:

- treat the Save as successful;
- do not create a second artifact;
- do not duplicate or rewrite the same local resource unnecessarily;
- preserve the current review/lock state;
- preserve the exact artifact identity;
- keep the selected version pointing at the same artifact;
- set visible feedback such as `Already saved locally with this story.`

If the marker is not present:

- preserve the #2818 behavior of saving against the latest persisted project;
- add the marker once;
- persist the resulting project;
- preserve current lock/review state.

### 3. Lock/Unlock independence

Save must not issue accept/unaccept operations.

Lock/Unlock must not remove or invalidate the save marker.

The following sequences must all be supported:

- Save → Save
- Save → Lock
- Save → Lock → Unlock
- Save → Lock → Unlock → Save
- Save → Lock → Unlock → Save → Lock

### 4. Status behavior

The UI must derive status from durable state.

Expected examples:

- saved + unlocked: `Saved locally`
- saved + locked: `Locked · Saved locally`
- unsaved + unlocked: `Ready to save`
- unsaved + locked: `Locked · Save confirmation pending`

Pressing Save on an already-saved artifact must not downgrade any of these states.

## Regression root cause

The current test suite protects the wrong rule.

`tests/issue-2806-storyboard-lock-toggle.test.mjs` currently requires a Save-button disable expression that includes `savedLocally`.

That assertion must be replaced with the opposite contract: `savedLocally` must not disable Save.

The #2817 test also only proves source-pattern presence. It does not execute the complete Human workflow.

## Required behavioral regression coverage

Add focused behavior-level coverage that proves:

1. Unsaved artifact → Save → saved marker present.
2. Saved artifact → Save again → successful Saved state.
3. Repeated Save preserves artifact ID.
4. Repeated Save does not increase visual artifact count.
5. Repeated Save does not duplicate the local resource.
6. Save → Lock → Unlock → Save works.
7. Save → Lock → Unlock → Save → Lock ends as `Locked · Saved locally`.
8. Unlocking does not remove the save marker.
9. Reload after repeated Save preserves the marker and selected artifact.
10. Local-resource restoration preserves the marker.
11. Previs recognizes the resulting saved+locked artifact.
12. Existing #2817 stale-project protection remains intact.
13. Existing review-state authority remains intact.
14. No paid-provider, media-routing, or image-generation behavior changes.

Where practical, the regression should execute the domain/state transition rather than merely match source strings.

## Non-goals

This issue does not:

- change image generation;
- create a new Storyboard version on repeated Save;
- force a file overwrite on repeated Save;
- change Lock/Unlock semantics except to keep them independent from Save;
- change Timeline generation;
- change Previs narration authorization;
- change cloud provider routing.

## Acceptance criteria

The Human can press Save repeatedly on the same Storyboard image before or after Lock/Unlock.

If the artifact is already saved, PlotPickle treats the operation as an idempotent success and reports Saved/Already saved without creating duplicates or unnecessary overwrites.

The saved status survives Lock/Unlock, reload, and local-resource restoration, and remains valid for Previs.

## Delivery sequence

build → focused behavioral tests → fix → PR → exact-head verification → fix until green → merge when green

Related: #2806, #2817, PR #2813, PR #2818.
