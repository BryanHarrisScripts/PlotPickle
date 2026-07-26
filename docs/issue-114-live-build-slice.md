# Issue #114 — Live Build workspace slice

This slice mounts Build as a real workspace between Plan and Write.

## Included

- persistent Build view switcher for Whole film, Acts, Sequences and 24 Blocks;
- canonical cards derived from `project.blocks` and `project.structure.sequences`;
- search and act, sequence, status and label filters;
- inspector editing title, purpose, conflict, emotional movement, setup, payoff, character focus and notes;
- linked scene and mini-block context;
- pointer drag-and-drop between Block cards;
- Move earlier, Move later and direct-position keyboard controls;
- order-only undo and redo using stable Block IDs;
- atomic remapping of screenplay, thread, arc, review-label and production Block-number references;
- edits routed through the existing `onProjectChange` project commit path;
- existing 300 ms local autosave remains the only persistence mechanism;
- stable Block, scene, mini-block and review target IDs are preserved.

Drag-and-drop is a convenience layer only. All movement remains available through keyboard-operable controls and does not depend on AI, GitHub or Google.
