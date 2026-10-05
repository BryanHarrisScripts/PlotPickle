# #2759 Timeline simplification implementation note

## Product boundary

Timeline is the story-alignment and assembly workspace between Previs and Rough Cut.

Outline → Storyboard → Previs → Timeline → Rough Cut

Timeline consumes stable Previs Mini-Block source snapshots. It does not generate Storyboard Images, create a second Shot count, or become a screenplay editor.

## Existing capability inventory reused

The implementation reuses:

- the canonical PPF `production` authority rather than introducing a second database;
- Storyboard's locked `storyboard-frame-webp-v2` artifacts as the authoritative visual source that Previs already presents;
- `storyboardAnchorEvidence` for screenplay/Scene/Beat provenance;
- the existing Skin V1 Act / Block / Mini-Block navigation shell;
- the existing project command/reducer/persistence path;
- existing Rough Cut contracts as the downstream stage, without overloading `RoughCutRevision` with Timeline decisions;
- existing optional `PlotPickleMediaEngine` / FFrames infrastructure as future media mechanics only.

No new media engine, transport dependency, OSS package, cloud provider, or mandatory runtime dependency is added.

## Smallest clean persisted boundary

The existing `RoughCutRevision` placement model is Shot/take-centric and represents a downstream committed cut. Reusing it directly for Timeline would collapse two Human decisions.

The smallest clean boundary is therefore a revisioned `TimelineAssemblyRevision` inside the existing `PrevisProductionState`. It stores only PlotPickle-owned placement intent and stable Previs source snapshots:

- Block/Mini-Block address;
- source revision and source key;
- source kind;
- ordered locked Storyboard Image artifact identities for Shot 01–25;
- planning duration;
- placement order.

Earlier Timeline revisions remain preserved. When upstream Previs changes, a placed source becomes stale. The Human must explicitly update that placement; the source is never silently replaced.

## Playback semantics

The initial source kind is the existing Previs Flip Book. It is playable directly from the saved Shot 01–25 Storyboard Image snapshot, so no manual media re-import is required.

The ~3-second Shot and ~75-second Mini-Block values remain planning targets from #2757. Timeline playback uses them for the Flip Book rehearsal only; it does not claim final rendered timing.

## Downstream

Rough Cut remains downstream. #2759 does not redesign Rough Cut or replace the provider-neutral media-engine boundary. A future Rough Cut handoff can consume the persisted Timeline assembly intent without turning Timeline into a render engine.
