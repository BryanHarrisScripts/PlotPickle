# Issue #114 — Live Build workspace slice

This slice mounts Build as a real workspace between Plan and Write.

## Included

- persistent Build view switcher for Whole film, Acts, Sequences and 24 Blocks;
- canonical cards derived from `project.blocks` and `project.structure.sequences`;
- search and act, sequence, status and label filters;
- inspector editing title, purpose, conflict, emotional movement, setup, payoff, character focus and notes;
- linked scene and mini-block context;
- edits routed through the existing `onProjectChange` project commit path;
- existing 300 ms local autosave remains the only persistence mechanism;
- stable Block IDs are preserved.

## Deferred to the reorder slice

Block movement, keyboard move controls and undo/redo require complete block-number reference remapping. They remain intentionally disabled until screenplay elements, thread milestones, arc checkpoints and production records can be updated atomically and covered by undo tests.
