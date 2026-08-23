# Phase A — Activate the core model (PlotPickle 0.13)

PlotPickle 0.13 promotes schema 1.7 from a development adapter to the canonical project model.

## Completed

- schema 1.7 is used by blank projects, imports, exports, Afterglow and the Structure Engine;
- schemas 1.0 through 1.6 are upgraded non-destructively during normalization;
- all expanded screenplay element types are editable and export through Fountain and Final Draft mappings;
- Story Threads include characters, scenes and milestones, with reciprocal scene links;
- every character has an Arc Matrix and scene/block checkpoints;
- Rights & Provenance records ownership, collaborators, sources and retained AI operations;
- named revision snapshots include deterministic hashes, comparison and restoration;
- Story Planner, Writer, Structure, Settings and Reports use the same records;
- the canonical schema file and the Phase A reference schema are synchronized.

## Compatibility

API keys and provider secrets remain outside project data. Existing project files from schemas 1.0–1.6 open as 1.7 projects without discarding story, screenplay, character, scene, mini-block, note or visual content.

## Superseded branches

The useful concepts in draft PR #1 and PR #3 are tracked separately. Their old schema/runtime branches are not merged into 0.13 because they predate the current application architecture. Act I Launch, Opening Move, Scene Pulse and disk-backed release packaging will be ported from fresh current-main branches.
