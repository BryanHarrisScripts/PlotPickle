# Issue #115 — 96 mini-block whole-film wall

## Objective

Extend the canonical Build workspace from the 24-Block overview into a responsive construction wall that can display all 96 mini-blocks without creating a second story model.

## Canonical reuse boundary

The wall derives every card from:

- `project.blocks` and stable Block IDs;
- `StoryBlock.scenes` and stable scene IDs;
- `StoryScene.miniBlocks` and stable mini-block IDs;
- canonical characters, locations and story threads;
- existing storyboard frames, screenplay draft elements and production shots.

Filtering, diagnostics, colour modes, zoom and pan do not alter canonical ordering or create persisted wall records.

## Foundation added

`lib/mini-block-wall.ts` provides:

- whole-film, act, sequence, Block, character and storyline views;
- colour-mode contracts for character, storyline, location, status, setup/payoff and custom labels;
- canonical 1–96 global positions derived from current Block, scene and mini-block order;
- filters for character, storyline, location and status;
- storyboard frame, screenplay element and production-shot links;
- restorable selection, expansion scope, filters, zoom and pan state;
- derived card status without adding a persisted mini-block-wall status field.

## Diagnostics foundation

The model currently identifies:

- empty mini-blocks;
- overloaded Blocks;
- missing escalation;
- repeated adjacent beats;
- setup without payoff;
- payoff without setup;
- absent character focus across the wall;
- storyline gaps;
- scenes with no mini-blocks;
- missing storyboard frames.

These are warnings only. They never rewrite story content automatically.

## Next implementation slices

1. Render the 96-card wall inside Build with expand/collapse at Block, sequence, act and whole-film levels.
2. Add responsive pan and zoom controls using the existing workspace-context fields.
3. Add focused colour modes, legends and filters.
4. Add the mini-block inspector and canonical editing callbacks.
5. Add keyboard movement and pointer movement while preserving stable IDs and synchronized screenplay, storyboard and report references.
6. Restore board state when leaving and returning to Build.

## Non-negotiable rules

- No duplicate mini-block database.
- Filtering never changes canonical order.
- Stable Block, scene and mini-block IDs survive moves and edits.
- Plan, Build, Write, Storyboard, Refine and Reports continue to read the same project.
- All primary operations work without AI, GitHub or Google.
