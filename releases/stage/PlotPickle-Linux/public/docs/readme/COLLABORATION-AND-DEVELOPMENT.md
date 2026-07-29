PlotPickle Playhouse
====================

This is one selectable tab from the complete PlotPickle README. The canonical root README links all three tabs.

## PlotPickle 1.0 candidate — Collaboration and Release Engineering

Settings → GitHub & Backups now provides a disk-backed `.ppf` project library, rolling backups, canonical pulls, and owner-controlled collaboration proposals. Every local PlotPickle server submits changes through a unique GitHub branch and pull request; only an owner or maintainer merge changes the canonical story. Afterglow: Reflections of Sentience links directly to its current GitHub source repository. Windows, macOS and Linux release candidates are clean-machine tested and published with SHA-256 checksums, while local-only writing continues to require no PlotPickle or cloud account.

## Whole-app Lighthouse review package

A complete local Lighthouse audit can be created without sending a story project to a remote audit service.

### Windows

1. Open the extracted PlotPickle source folder in File Explorer.
2. Double-click `Run-Lighthouse.bat`.
3. Choose desktop and mobile, desktop only, mobile only, or ZIP the latest completed audit.

The launcher uses native Windows tools. It does not open Ubuntu and does not require Windows Subsystem for Linux. If the project dependencies are missing, it installs them with `npm ci` before starting the audit.

PlotPickle builds once, starts a private preview server on `127.0.0.1`, discovers the registered application pages, audits every accessible route in desktop and mobile modes, and creates an uploadable ZIP automatically.

The command window prints the final ZIP path. Reports are stored under:

```text
reports\lighthouse\<timestamp>\
```

The ZIP contains a route summary plus each page's Lighthouse JSON, HTML and command log. Dynamic routes that require a real project identifier are listed separately instead of being silently skipped.

The launcher also accepts command-line modes:

```bat
Run-Lighthouse.bat all
Run-Lighthouse.bat desktop
Run-Lighthouse.bat mobile
Run-Lighthouse.bat zip
```

The equivalent npm commands remain available:

```bat
npm run audit:lighthouse
npm run audit:lighthouse:desktop
npm run audit:lighthouse:mobile
npm run audit:lighthouse:zip
```

Node.js 22.13.0 or newer and a locally installed Chrome or Chromium browser are required. The first audit may download the pinned Lighthouse command package. The report folder is ignored by Git so private local audit results are not committed accidentally.

## Project data and migration

Released projects use canonical schema `1.7.0`. Imports from schemas 1.0 through 1.6 are upgraded non-destructively.

Migration preserves existing story, world, character, dialogue, note, screenplay, block, scene, mini-block, and visual data while adding dynamic scene fields, Story Threads, Character Arc Matrices, rights and provenance records, and revision history.

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

PlotPickle separates software, instructional material, user work, and brand rights.

### User-created work

Users retain the rights they hold in their original stories, screenplays, characters, dialogue, images, notes, and exported `.plotpickle.json` project files. Using PlotPickle does not transfer that material to Bryan Harris, PlotPickle, a contributor, or a server operator.

### Software

PlotPickle software is licensed under **GNU AGPLv3 or later** (`AGPL-3.0-or-later`). The full licence text is included as `LICENSE`.

### Method and documentation

Unless otherwise marked, the written 24 Blocks method, documentation, diagrams, and reusable non-software instructional material are licensed under **Creative Commons Attribution-ShareAlike 4.0 International** (`CC BY-SA 4.0`).

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

A modified version made available to remote users must prominently offer those users the corresponding source code for that version at no charge, as required by AGPLv3 section 13. Hosted editions must preserve legal notices, identify modifications, respect user ownership, and avoid implying that an unofficial edition is the official PlotPickle service.

A server operator should provide their own privacy and data-retention terms because a hosted edition may store user projects differently from the official local edition.

## Brand assets

The PlotPickle Playhouse logo kit is in `public/brand`. Brand assets may not be used to misrepresent an unofficial or modified edition as the official PlotPickle project. See `TRADEMARKS.md`.
