# #2603 — Blank startup + canonical Afterglow example migration

Parent: #2601  
Depends on: #2602

## Product state

At login there are only two entry states:

1. **Blank** — default, detached, empty project values with the full reusable PlotPickle structure/capability.
2. **Example** — explicitly opened from Library, currently the canonical packaged Afterglow reference.

Local changes are not a third entry state.

## Blank runtime

The existing empty PPF factory was already clean. The missing product behavior was that Mind Map refused the detached blank and World Map required an active Library project.

Phase 2 makes both surfaces consume the same workspace loader:

`loadWorkspaceLibraryProject()`

When no Library project is selected, that loader returns the detached empty runtime project. When a project/example has been explicitly selected, it returns that durable project.

The detached blank is not persisted and does not become the user's project merely because they opened Mind Map or World Map.

## First save

A first explicit save from Blank now uses:

`saveDetachedLibraryProjectAs(...)`

The surface asks **Save as New Project**, then the storage boundary creates a fresh Library identity and copies the current blank working state into it. The transient blank id is never promoted directly.

Agent proposals in a blank Mind Map can remain runtime-local until the Human chooses Save/Lock. Generating a proposal does not silently create a project.

Library → New creates the same empty project shape but assigns a durable identity immediately.

## Afterglow boundary

Afterglow remains explicit:

`Library → Examples → Open Example`

The loader uses the promoted repository package, not the blank factory and not a startup fallback.

The current approved package already carries:
- populated Foundations decisions/brief;
- logline, premise/stakes and theme/tone evidence used by World Map projection;
- Character Truth for Ren, Amy, Summer/Isobel and the other approved principals;
- the 24-Block structure;
- repository-backed poster/character visual resources.

The promoted package currently has no approved `world.lessons`, World brief, Discovery cards, or Writing entries. This phase deliberately leaves those empty instead of inventing content. They remain migration candidates so later approved Afterglow work can be promoted losslessly through the existing package pipeline.

## Resource rule

Packaged resources use normal repository URLs under:

`/assets/library/examples/afterglow/current/`

The promotion pipeline continues to reject Base64/data URLs, file URLs, and unmapped local asset URLs.

## Follow-on

Phase 3 (#2604) will make Mind Map the full canonical create/edit surface. Phase 4 (#2605) will make World Map read/review-only with Learn deep-links. This phase only establishes the entry-state and data-ownership boundary.
