# Issue #114 — Build workspace foundation

## Objective

Create Build as a visual construction workspace between Plan and Write while preserving one canonical PlotPickle project model.

## Existing reuse boundary

- `app/build-workspace.tsx` already provides the live Build route and persistent submenu.
- `project.blocks` remains the only persisted Block collection.
- `project.structure.sequences` remains the canonical 12-sequence structure.
- `StoryBlock.scenes`, `StoryScene.miniBlocks`, screenplay links, visuals, review anchors and production references remain attached to their existing stable IDs.
- `app/page.tsx` continues to own project commits, autosave and cross-workspace synchronization.

## Foundation added

`lib/build-workspace-model.ts` derives:

- whole-film Block cards;
- four act lanes;
- twelve sequence lanes;
- search, act, sequence, status and label filtering;
- character focus and location labels from canonical IDs;
- scene and mini-block totals;
- derived card readiness without adding a persisted Build-only status record;
- immutable canonical Block-field updates that preserve the Block ID.

## Reorder safety requirement

Block reordering is intentionally separated from the first foundation commit. A Block move changes its canonical number, act and sequence and therefore must remap every numeric reference that follows that Block, including screenplay elements, thread milestones, arc checkpoints, review labels, production records and any structure sequence ranges. Reorder will be added only with explicit reference-remapping and undo tests so existing projects cannot silently lose links.

## Next implementation slices

1. Replace the current Build summary with whole-film, act, sequence and 24-Block views using the derived model.
2. Add the Block inspector using existing `StoryBlock` fields and canonical commit callbacks.
3. Add a reference-aware move operation and keyboard alternative.
4. Add local undo/redo history around canonical project snapshots.
5. Reuse the existing debounced project persistence in `app/page.tsx`.
6. Add contextual routes to guidance, visuals, diagnostics and Feedback.

## Non-negotiable rules

- No Build-only story database or duplicate Block records.
- Stable Block, scene and mini-block IDs survive edits and moves.
- Plan, Build, Write, Storyboard, Feedback and Reports read the same updated project.
- All core operations remain available without AI, GitHub or Google.
