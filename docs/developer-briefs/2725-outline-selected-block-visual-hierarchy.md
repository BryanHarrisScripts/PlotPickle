# #2725 — Outline selected-Block workspace and visual hierarchy

Issue: #2725

## Human intent

Outline should be a readable selected-Block workspace, not six narrow working cards. Block and Mini-Block selection remain navigation. The selected Block uses the available horizontal space and Mini-Block selection swaps the selected slice inside that workspace.

Outline owns two distinct representative visual layers:

1. Block Visual Anchor — one representative image for the selected Block.
2. Mini-Block Visual Anchor — one representative image for the selected Mini-Block.

These are not the 25 Storyboard shots. Storyboard remains the next stage and owns the 25-shot sequence for each Mini-Block.

Mind Map and World Map should not repeat the application shell. Their duplicate in-surface title and duplicate Back to Dashboard control are removed. The Act rail becomes the first row inside each surface.

## Reuse decisions

- Reuse the existing foundations visual-artifact store and Human accept/lock semantics.
- Reuse the existing Mini-Block Storyboard anchor authority already used by Outline.
- Reuse bundled Afterglow block-cover references as Block-anchor candidates when the loaded project is Afterglow.
- Do not create a second image store.
- Do not manufacture 25 shot records in Outline.
- Keep generation explicitly Human-approved.

## Acceptance

- The Outline readiness area renders only the selected Block.
- Selected story-card and written-story content expand to full width.
- A Block Visual Anchor appears before the Mini-Block Visual Anchor.
- Block and Mini-Block anchors have different labels and different stable decision keys.
- Existing Afterglow block-cover assets can appear without a new generation request.
- Existing Mini-Block visual references continue to appear through the shared Storyboard anchor model.
- Mind Map and World Map shared header renders Act/topic navigation only; shell identity and return chrome are not duplicated.
- Focused source tests cover the boundaries before PR creation.
