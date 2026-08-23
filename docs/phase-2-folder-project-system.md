# PlotPickle 2.0 Phase 2 — Folder Project System

Phase 2 changes the canonical local working format from one monolithic `.ppf` JSON file to an open project directory.

## Canonical storage

Local projects are written under the private PlotPickle data folder in `projects-v2/<project-key>/`.

Each project contains:

- `manifest.json`
- `project/identity.json`
- `story/module.json`
- `world/module.json`
- `characters/module.json`
- `screenplay/module.json`
- `blocks/module.json`
- `review/module.json`
- `production/module.json`
- `reports/revisions.json`
- `collaboration/module.json`
- `canon/rights.json`

The files are formatted JSON and can be read, backed up and version-controlled without PlotPickle.

## Compatibility

The browser-facing local project API remains compatible with the current interface. A virtual `<project-key>.ppf` filename is returned so existing project selectors continue working while the underlying canonical project is a directory.

Existing `.ppf` backup and recovery files remain supported. Before a folder project is overwritten, PlotPickle reconstructs the previous canonical project and stores a portable `.ppf` backup. The newest twenty backups are retained.

The existing legacy local-project gateway remains mounted after the folder gateway because it still supplies GitHub synchronization endpoints. Folder routes are handled first.

## Atomicity

Every module is written to a temporary file, flushed, and renamed into place. `manifest.json` is part of the same module set and identifies the canonical project format as `plotpickle-project` version `2.0.0`.

## Scope boundary

Phase 2 establishes local folder storage and round-trip reconstruction. Git-native commits, branches and semantic proposal review remain Phase 5 work. `.ppf` ZIP packaging remains a later implementation phase; current `.ppf` recovery snapshots retain the established JSON-compatible portable representation during migration.
