# Phase 3 — Modular Story Architecture

Phase 3 advances the live folder format from `2.0.0` to `2.1.0`. The browser continues to work with the normalized schema 1.7 project, while local storage is divided into small, human-readable modules.

## Core result

A saved project now contains independent files for story, development, threads, world, screenplay, production, research, canon, review, revisions, collaboration, imports and plugins.

Collections are split further:

- each character has its own `characters/<name>.json` file;
- each character voiceprint has its own `voiceprints/<name>.voice.json` file;
- each of the 24 Blocks has its own numbered JSON file;
- available mini-block records receive individual files under `96-blocks/`;
- storyboard frames are registered independently of the screenplay;
- the screenplay retains structured JSON and a readable `main.fountain` representation.

## Manifest registry

`manifest.json` now declares module type, path, schema version, required status, dependencies and collection patterns. Unknown modules are discovered by the folder reader but are not inserted into the normalized legacy project object. Their files remain on disk until a future writer intentionally replaces the project directory.

The plugin registry is structural only in this phase. Plugins cannot execute code or mutate projects yet.

## Canon foundation

The Canon module begins with:

- `canon/index.json`
- `canon/rules.json`
- `canon/continuity.json`
- `canon/timeline.json`
- `canon/glossary.json`
- `canon/rights.json`

These files establish stable destinations for approved facts and continuity without asking AI to remember project truth.

## Compatibility

PlotPickle reads Phase 2 `2.0.0` folders and migrates them in memory. The next save writes the Phase 3 `2.1.0` modular layout. Existing portable `.ppf` backups remain readable and continue to be created before overwrite.

## Save safety

A complete modular project is written to a temporary sibling directory. Only after every file succeeds does PlotPickle replace the active folder. This avoids leaving a half-written mixture of old and new modules.

## Deferred work

Phase 3 does not yet provide module-specific editing screens, executable plugins, Git commits per module, semantic dependency propagation or PDF screenplay extraction. Those build on this storage contract in later phases.
