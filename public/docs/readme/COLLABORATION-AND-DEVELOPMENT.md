PlotPickle Playhouse
====================

This is one selectable tab from the complete PlotPickle README. The canonical root README links all three tabs.

## PlotPickle 1.0 candidate — Collaboration and Release Engineering

Settings → Repository & Collab provides a disk-backed `.ppf` project library, rolling backups, canonical pulls and owner-controlled collaboration proposals. Every local PlotPickle server submits changes through a unique GitHub branch and pull request; only an owner or maintainer merges changes into the canonical story. Afterglow: Reflections of Sentience links directly to its current GitHub source repository. Windows, macOS and Linux release candidates are clean-machine tested and published with SHA-256 checksums, while local-only writing continues to require no PlotPickle or cloud account.

## Windows packaged interaction release gate

The Windows release artifact is accepted only after the ZIP has been created, extracted into a clean temporary folder and supplied with a fresh dependency installation. The gate launches the same local Vite runtime and configuration files shipped in the download instead of testing a detached static preview.

The browser opens every supported static screen and the main workspace. It then discovers and exercises every visible same-origin control that is safe to activate, including navigation entries, tabs, pills, buttons, menus, expandable summaries, checkboxes, radio controls, select menus and internal links. Newly revealed interface states are revisited so nested Settings panels, dialogs and secondary controls are included.

The gate fails when it detects an uncaught JavaScript exception, rejected promise, React runtime overlay, serious console error, failed same-origin request, empty page, missing title or description, missing required brand asset, control timeout or an incomplete state/action inventory. Settings → Repository & Collab is included, so the asynchronous GitHub account-status transition that produced the `removeChild` runtime error is exercised by the packaged build.

The browser and server use an isolated temporary PlotPickle data home. External authentication, real GitHub repository changes, publishing, paid generation, downloads, system-folder actions and direct destructive controls are listed in the evidence report but are not executed. Safe local changes, such as switching a tab or saving isolated temporary preferences, may be exercised.

A hard total timeout, per-action timeout and state/action limits prevent a stuck control from consuming an unlimited CI run. Reaching an inventory limit fails the gate rather than silently claiming complete coverage. Cleanup force-terminates the complete browser and server process trees.

Evidence is stored under:

```text
reports\windows-interaction-smoke\
```

The evidence contains JSON and Markdown summaries together with browser and server logs. The Windows package workflow uploads this folder even when the gate fails.

## Lighthouse runner is retired

PlotPickle's earlier Lighthouse runner never provided a trustworthy packaged-runtime release gate. It tested the wrong runtime, produced misleading local API and font failures, and could leave child processes running after the audit had already ended.

The runner is no longer used by CI or release packaging. `Run-Lighthouse.bat` and the npm Lighthouse commands now exit immediately with a retirement notice instead of launching a long or misleading audit. The Windows packaged interaction gate is the supported release test.

## Project data and migration

Released projects use canonical schema `1.7.0`. Imports from schemas 1.0 through 1.6 are upgraded non-destructively.

Migration preserves existing story, world, character, dialogue, note, screenplay, block, scene, mini-block and visual data while adding dynamic scene fields, Story Threads, Character Arc Matrices, rights and provenance records, and revision history.

Phase C reuses those existing schema 1.7 capabilities. Research entries use source attributions, AI and asset records use AI provenance, and approved specialist passes use revision snapshots with embedded before/after metadata.

The source of truth is:

- `schema/plotpickle-project.schema.json`
- `schema/plotpickle-project-v1.7.schema.json`
- `lib/project.ts`
- `lib/project-phase-one.ts`
- `lib/structure.ts`
- `lib/craft-diagnostics.ts`
- `lib/specialist-labs.ts`

Portable `.ppf` projects and optional GitHub collaboration now build on schema 1.7 revisions and provenance without changing local-only use. Multiple local servers submit reviewable pull requests rather than writing directly to the canonical branch.

## Copyright, ownership, and licences

PlotPickle separates software, instructional material, user work and brand rights.

### User-created work

Users retain the rights they hold in their original stories, screenplays, characters, dialogue, images, notes and exported `.plotpickle.json` project files. Using PlotPickle does not transfer that material to Bryan Harris, PlotPickle, a contributor or a server operator.

### Software

PlotPickle software is licensed under **GNU AGPLv3 or later** (`AGPL-3.0-or-later`). The full licence text is included as `LICENSE`.

### Method and documentation

Unless otherwise marked, the written 24 Blocks method, documentation, diagrams and reusable non-software instructional material are licensed under **Creative Commons Attribution-ShareAlike 4.0 International** (`CC BY-SA 4.0`).

### Contributions

Contributors retain copyright in their original contributions. By submitting material for inclusion, software contributions are licensed under AGPL-3.0-or-later and documentation or method contributions are licensed under CC BY-SA 4.0.

See:

- `LICENSE`
- `LICENSES.md`
- `NOTICE.md`
- `CONTRIBUTING.md`
- `TRADEMARKS.md`
- `docs/licensing-and-ownership.md`

These project documents provide practical information and are not a substitute for legal advice.

## Self-hosted server editions

PlotPickle’s official distribution remains the downloadable local edition. Downstream users may adapt PlotPickle for compatible server infrastructure, including Plesk or a WordPress-connected architecture, under the applicable licences.

A modified version made available to remote users must prominently offer those users the corresponding source code for that version at no charge, as required by AGPLv3 section 13. Hosted editions must preserve legal notices, identify modifications, respect user ownership and avoid implying that an unofficial edition is the official PlotPickle service.

A server operator should provide their own privacy and data-retention terms because a hosted edition may store user projects differently from the official local edition.

## Brand assets

The PlotPickle Playhouse logo kit is in `public/brand`. Brand assets may not be used to misrepresent an unofficial or modified edition as the official PlotPickle project. See `TRADEMARKS.md`.
