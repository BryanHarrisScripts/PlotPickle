# PlotPickle 1.0 candidate — Collaboration and release engineering

Phase F makes PlotPickle safe for a real screenplay that may remain active for months or years. Local disk projects remain the primary copy. GitHub is optional collaboration and off-computer revision history.

## Portable `.ppf` project files

A `.ppf` file is a JSON-based PlotPickle Project File containing:

- the complete canonical schema 1.7 project;
- screenplay, 24 Blocks, flexible scenes and 96 mini-blocks;
- Story Threads, Character Arc Matrices, rights and provenance;
- reviews, pitch packages, production plans and revision snapshots;
- an asset manifest for linked local files;
- a deterministic integrity hash.

The format contains no API keys or GitHub credentials. Any current PlotPickle Server may import, normalize, validate and restore it.

## Local project library

The private local server stores projects under the current computer account:

```text
PlotPickle home/
├── projects/       current .ppf files
├── backups/        rolling timestamped safety copies
├── assets/         generated local assets
├── runtimes/       reusable package-lock-specific dependencies
└── secrets/        AI and GitHub credentials, never exported
```

Saves use a temporary file, flush it, and atomically rename it into place. Before replacement, the existing project is copied into the backup folder. The newest 20 backups per project are retained. Integrity failures block a damaged file from silently replacing a healthy story.

## GitHub collaboration

Settings → Collaboration connects to a repository controlled by the writer.

- Pull downloads the repository `.ppf` into a review candidate.
- PlotPickle reports changed story fields, Blocks, scenes, screenplay elements, characters and Story Threads.
- Nothing changes until **Apply reviewed version** is selected.
- Push first creates a local rolling backup, then commits the current `.ppf` to the configured branch and path.
- Commit history is visible inside PlotPickle.
- Collaborators use normal GitHub repository permissions, branches and pull requests.
- The GitHub token is stored in the local server's private secrets folder, not in the project.

GitHub may be disconnected at any time without affecting local projects or backups. A GitHub or cloud account is never required for local-only writing.

## Afterglow repository link

The bundled **Afterglow: Reflections of Sentience** project records its source repository:

`https://github.com/BryanHarrisScripts/Afterglow-Echoes-of-Sentience`

Project Overview and Settings → Collaboration show an **Open this story's GitHub repository** link. This source link does not imply that GitHub synchronization is enabled or that a `.ppf` file already exists in that repository.

## Supported release packages

The release-candidate workflow produces:

- `PlotPickle-Windows.zip`
- `PlotPickle-macOS.zip`
- `PlotPickle-Linux.zip`
- individual `.sha256` files and a tagged-release `SHA256SUMS.txt`

Each package is extracted on a clean GitHub runner for its operating system, installed from the committed lockfile, checked for the correct launcher, verified as loopback-only, and smoke-tested with Vite before publication.

The candidate launchers require Node.js 22.13 or newer. Dependencies are installed into a persistent package-lock-specific runtime outside the replaceable application folder, so code-only upgrades preserve the runtime, projects, exports and backups.

## Migration, recovery and corruption contract

The normal project migration continues to accept schemas 1.0 through 1.7 and outputs canonical schema 1.7. The Phase F suite additionally verifies:

- `.ppf` format and integrity metadata;
- atomic-write behaviour;
- a 20-copy rolling backup limit;
- detection of a project changed without a matching integrity hash;
- restoration of a recent healthy backup;
- package extraction and first-install behaviour on Windows, macOS and Linux.

## Completion standard

PlotPickle can be used for a real screenplay over months of revisions because the same canonical project moves between browser memory, disk `.ppf` files, rolling backups and optional GitHub commits. Recovery never depends on an AI provider, a PlotPickle account or a hosted PlotPickle service.
