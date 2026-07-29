# Issue #195 — Whole Film becomes the Storyworld Map

Phase 2 converts the existing Build Whole Film / 96-mini-block wall into PlotPickle's interactive Storyworld Map. It does not add a workspace, navigation item, structure editor or persistent graph.

## Canonical boundary

The map reads the deterministic PPF relationship index introduced in Issue #194 and resolves every visible item back to the current Block, scene, mini-block, Storyboard frame, Production Shot, character, location, Story Thread, asset, revision or provenance record that owns it.

- The construction wall and Storyworld Map are display modes in the existing Build view.
- Dragging and the existing move controls remain the only path that changes canonical order.
- Map selection, semantic zoom, overlays, search, focus and pan do not rewrite canonical data.
- The relationship index stays rebuildable and disposable.
- No node or edge database is introduced.

## Relationship overlays

The map exposes causality and escalation, hooks and turns, character movement, Story Threads, setup/payoff, location and presentation order, visual continuity, render readiness, and logic/rights/provenance warnings.

Each selected connection includes a “show why this connects” explanation, its explicit or derived source, and stable source IDs. The user can follow the connection without losing the current Build context.

## Accessibility and performance

The existing keyboard-safe card navigation remains available. A complete table alternative exposes the same 96 canonical positions, connections, markers, visuals and Production Shot coverage without drag interaction or colour dependence. Reduced-motion rules remain active, and the existing content visibility boundary continues to virtualize off-screen Block groups.

Semantic zoom changes presentation detail only. At movie, act, sequence, Block and scene levels, non-focused mini-blocks collapse to compact nodes. Mini-block and Production Shot levels expose full card detail.

## Shared and personal layout

The optional `plotpickle.storyworld-map-layout` PPF extension stores only the shared display mode, semantic level, overlays and emphasized stable IDs. It is versioned and round-trips with the project.

Temporary search, filters, selection, viewport pan and viewport zoom remain local session state. They are never written to PPF.

## Export

The existing visual export boundary now has two Storyworld Map outputs:

- structured SVG with accessible title, description, stable node IDs, labelled connection paths and colour-independent tooltips;
- self-contained HTML containing the SVG plus a readable table alternative.

Both are derived from the current PPF and can be carried into the existing Pitch and Reports flow. They do not become another canonical project format.

## Afterglow verification

Afterglow remains the reference project. Its complete 96-mini-block structure can be explored from whole-film story logic through characters, turns, frames and Production Shots while every selection resolves to the current canonical record.
