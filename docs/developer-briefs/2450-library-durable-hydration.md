# Developer Brief — Durable Library Hydration for MindMap + WorldMap

Issue: #2450

## Goal

A Human-owned Library working story must survive a complete PlotPickle close/restart with its full `LibraryPPFProject` intact.

That includes MindMap discovery cards and WorldMap approved character visual packages.

## Phase 1 — Profile-private project inventory

The authenticated profile-private GET response must expose:
- `project`: current active project for compatibility
- `activeProjectId`
- `projects`: readable saved project snapshots plus their private summaries

Read from the existing encrypted private project files. Do not introduce another durable store.

## Phase 2 — Canonical session hydration

Add a canonical project-library-core hydration primitive that:
- accepts the saved private project inventory
- normalizes every project
- preserves ids
- writes session project entries
- reconstructs the session registry
- restores the requested active id
- does not generate a fresh id or clone a story
- returns one active project/result

The browser wrapper emits one Library change event after the hydration is complete.

## Phase 3 — Full shape + legacy preservation

Profile browser code must treat persisted stories as `LibraryPPFProject`, not foundation-only `PPFProject`.

Legacy browser migration must call `normalizeLibraryProject` so these extended fields survive:
- structure
- sourceEvidence
- writing
- discovery
- worldMap

## Phase 4 — MindMap / WorldMap durability proof

Add a focused integration fixture representing Afterglow with:
- MindMap Act 1 agent proposal/pinned cards
- Wren WorldMap eight governed visual refs
- all Wren refs approved
- approvedAt
- asset URLs under /api/local-ai/assets/

Prove:
1. full project normalizes
2. encrypted private storage save/load preserves it
3. browser-style hydration preserves it
4. active id remains the same
5. all saved working projects remain listed

## Phase 5 — Live refresh contract

No second surface-local authority.

Keep and test the existing Dashboard host listeners:
- open MindMap reloads active Library project on `PROJECT_LIBRARY_CHANGED_EVENT`
- open WorldMap reloads active Library project on the same event

## Phase 6 — LOAD clarity

Keep packaged Afterglow as a fresh-copy action.

Add explicit copy that saved working stories below are the place to Resume/Open existing MindMap/WorldMap work.

## Non-goals

- no image-byte embedding in PPF
- no provider changes
- no WorldMap/MindMap redesign
- no automatic reuse of packaged Afterglow
- no cloud sync
- no change to local asset authority

## Merge bar

Focused tests first. Then exact-head Architecture Verification, CodeQL and language analysis. Fix only failures. Merge when green and stop.
