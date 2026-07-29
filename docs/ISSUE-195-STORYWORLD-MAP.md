# Issue #195 — Whole Film to Storyworld Map

Issue #195 converts the existing Whole Film and 96-mini-block wall inside the same Build workspace. It does not add a primary navigation item, a parallel structure editor or a second persistent story model.

The existing wall remains the default and keeps its drag, keyboard movement, undo, redo, recovery, filtering, autosave and canonical inspector behaviour. Two additional display modes read the same mini-block cards:

- Storyworld Map presents the derived PPF relationship index at movie, act, sequence, Block, scene, mini-block and Production Shot levels.
- Accessible table presents the same stable IDs, labels, connection counts, signals and canonical evidence without requiring drag, colour or spatial interpretation.

Semantic zoom groups those same records at movie, act, sequence, Block, scene, mini-block and Production Shot levels. It changes presentation detail only. Map selection and viewport movement cannot call the canonical ordering commands, while the hidden construction cards stop accepting drag operations outside wall mode.

Selectable overlays expose causality, hooks and turns, character arcs, threads, setup and payoff, location and time, visual continuity, render readiness and warnings. “Show why this connects” displays the source IDs and evidence from the existing relationship index.

The warning overlay includes mapped logic, continuity, rights, provenance and broken-reference conflicts reported by the existing dependency engine. The map does not invent a separate warning store.

Map selection never changes canonical story order. Editing remains with the owning Plan, Build, Write, Storyboard and Production operations. Structural movement still uses the established Build commands.

The optional `plotpickle.storyworld-map-layout` PPF extension stores only a versioned shared presentation choice: display mode, semantic zoom, overlays and emphasized canonical IDs. It never becomes a second canonical story graph. Personal pan, zoom, focus, filter and search state remain local.

The map exports structured SVG and self-contained HTML with labels, stable source identity and an accessible table. The existing Pitch Package visual section also includes the current static Storyworld Map.

Dense mini-block and shot views retain the existing content-visibility boundary and scrollable viewport. Reduced-motion rules remove optional movement, and every overlay combines a symbol and label with colour.

Afterglow remains the reference project for the later vertical slice. This phase provides the complete path from whole-movie logic to individual Production Shot identities without introducing Afterglow-specific data or another engine.
