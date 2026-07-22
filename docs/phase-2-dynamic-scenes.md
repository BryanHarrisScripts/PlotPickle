# Phase 2: Dynamic scenes

Phase 2 turns PlotPickle's original 48-scene layout into a starting template rather than a structural limit. The 24 Blocks and 96 mini-blocks remain the stable story framework, while the number and placement of screenplay scenes can change to match the pace and style of the film.

## Scene operations

The Structure Engine supports:

- adding a scene before or after the current movement;
- duplicating scene content without duplicating a structural mini-block;
- deleting a scene while preserving its mini-block assignments;
- reordering scenes within a block;
- moving a scene to another block;
- assigning zero to four mini-blocks to a full scene; and
- placing multiple short scenes inside one mini-block for montages, transitions, intercuts and rapid sequences.

Every block must retain at least one full scene. Every block must also retain exactly one copy of mini-blocks 1–4 across its scenes. A scene may temporarily have no mini-block when more than four full scenes are used in one block; the Structure Engine flags this as an intentional assignment decision rather than deleting or inventing structure.

## Complete scene record

A full scene stores:

- scene type: action, dialogue, suspense, revelation, montage, transition or other;
- entry and exit conditions;
- objective, opposition, action, reversal, resolution and outcome;
- participating characters;
- characters entering and leaving;
- locations;
- duration in seconds;
- page estimate; and
- assigned mini-blocks.

A short scene inside a mini-block stores the same essential dramatic movement at a lighter level: type, entry condition, objective, opposition, action, reversal, outcome, entrances, departures, seconds and pages.

## Stable scene identity

Scene numbers change when a writer reorders or moves material, so numeric position cannot be the permanent link between planning and screenplay pages.

Phase 2 adds a stable `sceneId` to screenplay draft elements. `synchronizeScreenplaySceneReferences()` rebuilds the global scene index after structural edits and updates each linked screenplay element with:

- its current global scene number;
- its current block number;
- its current mini-block assignment; and
- the unchanged stable scene ID.

When an older project has no scene IDs, PlotPickle attaches them from the existing global scene number, block and mini-block positions. If a linked scene is deleted, the material is reassigned to the closest surviving scene rather than becoming orphaned.

## Scene health

The Structure Engine now reports:

- whether the total scene count is below, inside or above the common 40–60 feature range;
- scenes without a mini-block assignment;
- blocks with missing or duplicated mini-blocks;
- characters marked entering or leaving without appearing in the scene cast;
- unmarked entrances between adjacent scenes;
- unresolved departures; and
- total planned runtime and page estimates.

These are diagnostic prompts, not rigid screenplay rules. The writer can intentionally depart from the common range or use an unassigned scene when the story requires it.

## Compatibility

The canonical compatibility schema still identifies the project as schema 1.6 while the larger Phase 1 additive model remains schema 1.7. The 1.6 normalizer upgrades older fixed-scene projects into the flexible scene shape and now validates one or more scenes per block instead of exactly two.

## Validation

Phase 2 includes source, schema and interface regression tests for flexible scene counts, stable screenplay links, short scenes, global numbering, scene-health diagnostics and backward-compatible project loading. The standard PlotPickle quality workflow runs linting, a production build, smoke tests and the complete test suite before merge.
