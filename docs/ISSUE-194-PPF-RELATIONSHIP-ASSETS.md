# Issue 194: PPF Relationship Index and Shared Asset Identity

Issue 194 converts existing PlotPickle foundations. It does not introduce a second story graph, a second asset library, or a new visual workspace.

## Canonical ownership

The PlotPickle project remains the sole canonical source for story, structure, logic, screenplay, visual, production, rights, and collaboration data.

`lib/story-dependencies.ts` is upgraded in place to relationship-index version 2.0.0. It derives nodes, edges, reverse references, conflicts, and health checks from the current project. The index is a rebuildable derived read model and never becomes a second canonical story graph. Its folder metadata explicitly records `derived: true` and `canonicalDataStoredHere: false`.

Stable project IDs connect characters, locations, threads, acts, sequences, Blocks, scenes, mini-blocks, screenplay elements, visual frames, Graphic Novel panels, Production Shots, cues, revisions, provenance records, story-logic evidence, and retained assets.

## Shared visual asset identity

The optional `assets` module gives retained media one project-level identity:

- one asset can be used by a Graphic Novel panel, Visual Frame, and Production Shot;
- each render or edit becomes a variation of that asset instead of a competing record;
- an approved variation, provider, model, prompt, provenance IDs, media type, portable path, and content metadata can travel with the project;
- clearing or removing a visual target detaches its reference without deleting retained history used elsewhere.

The existing `imageSrc`, `src`, and `keyframeSrc` fields remain compatibility mirrors. Legacy projects load without an `assets` module, migrate those values into shared references, and keep the legacy strings so older PlotPickle readers can still display the work.

## Format boundary

This is an additive, compatibility-safe module. The canonical monolithic schema remains 1.7.0, the folder format remains 2.3.0, and the portable PPF container remains format version 1.

Project folders add optional `assets/index.json` and a `dependencies/index.json` descriptor. The latter points to the existing derived graph, references, reverse index, conflicts, and health artifacts.

PlotPickle rejects or reports duplicate stable IDs, unresolved references, duplicate asset records, credentials in portable sources, absolute machine paths, contradictory ordering or continuity links, missing hook/turn evidence, unresolved threads, and incomplete render context.

## Conversion path

- Whole Film can consume the derived relationship index when it becomes the Storyworld Map.
- Graphic Novel and Storyboard can compile render packages from the same canonical targets and assets.
- Production and Animatic can reuse approved asset variations rather than copying image URLs.

Afterglow is the reference migration project. Loading or exporting it normalizes legacy visual data, derives the relationship index, and preserves shared asset identity without changing its default local-loading behaviour.
