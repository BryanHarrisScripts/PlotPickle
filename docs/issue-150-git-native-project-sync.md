# Issue #150 — Git-native canonical project synchronization

## Purpose

Phase 3 moves PlotPickle’s GitHub collaboration source of truth from one portable `.ppf` file to the existing modular project-folder engine.

The local application remains the writer’s private working environment. GitHub receives human-readable, deterministic project files only when the user explicitly compares, pulls or publishes them.

## Canonical repository layout

The repository-level `plotpickle-project.json` manifest now identifies:

- `project/` as the canonical modular project root;
- `project/manifest.json` as the canonical project-folder manifest;
- PlotPickle project-folder format `2.3.0`;
- the former `.ppf` location as a legacy migration and exchange path;
- portable release snapshots as optional files under `exports/releases/`.

The canonical folder reuses `createProjectFolder` and `parseProjectFolder`. Phase 3 does not introduce another story schema or duplicate the existing module engines.

## Compatibility with Phases 1 and 2

The GitHub App connection record retains its existing `projectPath` field so Phase 1 readiness checks and Phase 2 repository selection remain compatible. Under manifest `1.1.0`, that transitional field is populated from `portableProject.path`; canonical synchronization reads `canonicalProject.root` and `canonicalProject.manifestPath` instead.

Repositories using manifest `1.0.0` remain readable. PlotPickle inspects them as migration candidates, preserves their legacy `.ppf`, and upgrades the repository contract only after explicit Project Lead approval. New and upgraded repositories use manifest `1.1.0`.

## Deterministic synchronization

Before GitHub comparison, PlotPickle:

1. Creates the canonical modular project files through the existing folder engine.
2. Sorts JSON object keys recursively while preserving array order.
3. Normalizes text files to LF line endings.
4. Adds a final newline where appropriate.
5. Calculates SHA-256 for every managed file.
6. Classifies each path as new, changed, removed or unchanged.

This keeps Git history readable and prevents formatting noise from appearing as creative changes.

## Remote validation

PlotPickle reads the approved branch commit and full Git tree. It then:

- validates `plotpickle-project.json`;
- rejects unknown repository-manifest versions;
- loads only blobs under the declared canonical project root;
- validates `project/manifest.json` as PlotPickle project-folder format `2.3.0`;
- reconstructs the project through `parseProjectFolder`;
- refuses malformed or incomplete projects before anything is applied locally.

Getting the approved version creates a review candidate. It does not replace the active local project automatically.

## Atomic publishing

Project Lead publishing uses GitHub’s Git Data API:

1. Read the approved branch commit and tree.
2. Require it to match the commit recorded by the synchronization preview.
3. Create blobs only for new or changed managed files.
4. Add deletion entries only for paths under the canonical `project/` root.
5. Use the approved tree as `base_tree`, preserving unrelated repository content.
6. Create one new tree.
7. Create one commit with the approved commit as its parent.
8. Update the branch reference with `force: false`.

If the approved branch moved after preview, PlotPickle stops before writing and asks the user to get and review the latest approved version.

## Legacy `.ppf` migration

Manifest `1.0.0` repositories are recognized as legacy projects.

PlotPickle:

- reads and integrity-checks the legacy `.ppf`;
- loads it for review without changing the repository;
- previews the exact canonical folder files that would be created;
- requires explicit migration approval;
- preserves the legacy `.ppf` for recovery;
- updates `plotpickle-project.json` to manifest `1.1.0`;
- makes `project/` canonical in one guarded commit.

An incompatible manifest is never overwritten.

## Portable release snapshots

A Project Lead can optionally create a timestamped `.ppf` under `exports/releases/`.

Release snapshots are portable exchange artefacts. They are not used for canonical synchronization, file comparison or remote divergence checks.

## Credential and deletion boundaries

- GitHub credentials remain in PlotPickle’s protected local credential store.
- Tokens are never serialized into a project module, manifest, `.ppf`, report, log or commit.
- PlotPickle never deletes outside the managed canonical project root.
- Assets, unrelated folders, documentation and repository automation remain untouched.
- GitHub file writes are not issued concurrently as separate commits.

## Phase boundary

Phase 3 supplies canonical folder synchronization and migration. Phase 4 will move Story Proposal branches to this file-level engine and add semantic review and selective approval inside PlotPickle.
