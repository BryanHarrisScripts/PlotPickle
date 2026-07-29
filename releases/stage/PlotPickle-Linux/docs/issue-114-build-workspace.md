# Issue #114 — Build workspace foundation

## Objective

Create Build as a visual construction workspace between Plan and Write while preserving one canonical PlotPickle project model.

## Existing reuse boundary

- `app/build-workspace.tsx` provides the live Build route and persistent submenu.
- `project.blocks` remains the only persisted Block collection.
- `project.structure.sequences` remains the canonical 12-sequence structure.
- `StoryBlock.scenes`, `StoryScene.miniBlocks`, screenplay links, visuals, review anchors and production references remain attached to their existing stable IDs.
- `app/page.tsx` continues to own project commits, debounced autosave and cross-workspace scene synchronization.

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

## Reference-safe ordering

`lib/build-workspace-order.ts` moves Blocks by stable ID and then atomically updates the canonical project:

- Block `number`, `act` and `sequenceNumber` fields;
- screenplay element `blockNumber` references;
- story-thread introduction, resolution and milestone Block numbers;
- character arc checkpoint Block numbers;
- production shot, cue and breakdown Block numbers;
- leading `Block N` text in review anchors while preserving their stable target IDs.

Sequence `blockNumbers` ranges remain fixed because they describe positional lanes, not a particular Block identity. Scene, mini-block, visual and review target IDs remain unchanged.

## Movement and undo

The Build workspace provides:

- pointer drag-and-drop between Block cards;
- Move earlier and Move later buttons;
- direct movement to any Block position;
- keyboard-operable controls that remain the accessible alternative to drag-and-drop;
- order-only undo and redo history;
- autosave through the existing project commit path.

Every movement path calls the same stable-ID remapper. Undo stores only the stable-ID ordering, so text edits made after a move are preserved when the previous order is restored.

## Remaining implementation slices

1. Add contextual routes to guidance, visuals, diagnostics and Feedback.
2. Add focused interaction tests for repeated cross-act moves in a rendered browser environment.

## Non-negotiable rules

- No Build-only story database or duplicate Block records.
- Stable Block, scene, mini-block and review target IDs survive edits and moves.
- Plan, Build, Write, Storyboard, Feedback and Reports read the same updated project.
- Existing projects continue to normalize without data loss.
- All core operations remain available without AI, GitHub or Google.
