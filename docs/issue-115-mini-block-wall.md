# Issue #115 — 96 mini-block whole-film wall

## Objective

Extend the canonical Build workspace from the 24-Block overview into a responsive construction wall that can display and edit all 96 mini-blocks without creating a second story model.

## Canonical reuse boundary

The wall derives every card from:

- `project.blocks` and stable Block IDs;
- `StoryBlock.scenes` and stable scene IDs;
- `StoryScene.miniBlocks` and stable mini-block IDs;
- canonical characters, locations and story threads;
- existing storyboard frames, screenplay draft elements and production shots.

Filtering, diagnostics, colour modes, zoom and pan do not alter canonical ordering or create persisted wall records.

## Delivered model

`lib/mini-block-wall.ts` provides:

- whole-film, act, sequence, Block, character and storyline views;
- colour-mode contracts for character, storyline, location, status, setup/payoff and custom labels;
- canonical global positions derived from current Block, scene and mini-block order;
- filters for character, storyline, location and status;
- storyboard frame, screenplay element and production-shot links;
- restorable selection, expansion scope, filters, zoom and pan state;
- derived card status without adding a persisted mini-block-wall status field.

`lib/mini-block-wall-edit.ts` locates and updates mini-blocks by stable ID. It preserves the canonical mini-block ID and number, returns the unchanged project when no value changes, and writes through the same project consumed by Plan, Write, Storyboard, Refine and Reports.

## Delivered Build workspace

`app/mini-block-wall.tsx` and `app/mini-block-wall.module.css` provide Build’s fifth view:

- all mini-block cards grouped by four acts and twenty-four Blocks;
- whole-film, act, sequence, Block, character-arc and storyline focus;
- expanded whole-film, selected-act, selected-sequence and selected-Block scopes;
- zoom, directional pan and wall reset controls;
- colour legends for character, storyline, location, status, setup/payoff and custom labels;
- character, storyline, location and status filters;
- storyboard thumbnails, scene names, screenplay counts and production-shot counts;
- setup/payoff badges and direct related-card navigation;
- empty, overloaded and unresolved indicators;
- a canonical mini-block inspector for dramatic function, objective, resistance, action, revelation, turn, entry/exit state, visual beat, dialogue intention, setup, payoff and notes;
- roving keyboard focus with Arrow, Home and End navigation;
- pointer selection and accessible button/select alternatives;
- per-project restoration of view, filters, selection, expansion, zoom and pan when Build is left and reopened;
- direct pointer drag-and-drop across scenes and Blocks, plus equivalent earlier/later and position controls;
- bounded order-only undo and redo with a pre-move local recovery snapshot;
- synchronized screenplay, storyboard, Feedback and production references keyed from each stable mini-block ID;
- responsive desktop, tablet and mobile layouts with a scrollable whole-film viewport.

The wall is mounted by `app/build-workspace.tsx`. The original 24-Block views, filters, inspector, drag-and-drop, reference-safe reordering and undo/redo remain unchanged.

## Diagnostics

The model identifies:

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

Warnings are navigable signals only. They never rewrite story content automatically.

## Non-negotiable rules

- No duplicate mini-block database.
- Filtering never changes canonical order.
- Stable Block, scene and mini-block IDs survive moves and edits.
- Plan, Build, Write, Storyboard, Refine and Reports continue to read the same project.
- All primary operations work without AI, GitHub or Google.
