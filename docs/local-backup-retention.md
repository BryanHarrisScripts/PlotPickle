# Local backup, restore and retention

PlotPickle keeps project backup local by default. The portable `.ppf` remains the project payload; the complete `.ppbackup` archive adds an outer manifest, SHA-256 checksums and optional sanitized evidence.

## Two local safety nets

PlotPickle now has two complementary local backup mechanisms:

1. **Timestamped `.ppf` restore points** — the existing quick local snapshots, currently bounded to a configurable count with a default of 20.
2. **Complete `.ppbackup` archives** — explicit writer-created archives containing a complete portable PPF plus optional recent Responsibility Run, Verification and selected-report evidence.

The complete archive does not replace the PPF format. `project.ppf` inside the archive is validated with the normal PPF manifest/checksum reader during restore.

## Complete backup manifest

A `.ppbackup` manifest records:

- backup format/version;
- backup ID;
- project ID and title;
- canonical project revision;
- backup timestamp;
- source PlotPickle application version;
- included evidence categories;
- explicit exclusion categories;
- every archived file path, byte length and SHA-256 checksum;
- a manifest/archive checksum.

Restore validates the outer archive and inner `project.ppf`. A project-ID or canonical-revision mismatch fails validation.

## What is included

Always:

- complete portable project PPF;
- PPF project extensions, including revision-aware proposal/history data already stored in the project;
- project candidate/asset/provenance data that is part of the PPF.

Optional, writer-selected:

- recent Responsibility Run records and their safe structured telemetry;
- recent Verification Inbox records;
- selected report objects supplied to the backup workflow.

The backup sanitizer removes credential-like fields/values and private-internal-deliberation fields from optional JSON evidence before archive creation.

## What is deliberately excluded

Normal PlotPickle project backup does **not** include:

- API keys, provider credentials or authorization headers;
- PlotPickle protected credential files or OS keychain/DPAPI/Secret Service entries;
- PlotPickle Studio private signing keys;
- developer shell/GitHub credentials;
- BUZZ private keys;
- BUZZ-owned private agent memory/instructions;
- BUZZ Agent Defaults, ACP runtime/provider/model configuration;
- BUZZ Studio membership or relay history.

BUZZ-owned data must be backed up separately using a BUZZ-supported export/backup mechanism when one is available. PlotPickle must not crawl `~/.buzz`, `.agents` global state, relay caches, or other external app-support directories to make a project backup.

## Restore safety

Restore is a two-step writer action:

1. **Preview** validates all checksums/version/project identity and returns the backup title, canonical revision, timestamp, source version and included evidence summary. It does not change the active project.
2. **Restore** requires explicit confirmation. Only then does the validated project return to the browser, where PlotPickle replaces the active local project.

A cancelled preview/confirmation does not modify current work. The UI warns the writer to create a fresh backup of current work first when appropriate.

Unsupported backup format versions fail safely. Corrupt/tampered file checksums fail safely. A malformed inner PPF fails safely.

## Retention defaults

Retention applies to operational evidence, not canon:

| Evidence | Default maximum age | Default maximum count | Minimum kept automatically |
|---|---:|---:|---:|
| Responsibility Runs | 30 days | 100 | 10 |
| Verification Inbox records | 90 days | 100 | 10 |
| Raw Full Verification logs | 14 days | 50 | 5 |
| Complete `.ppbackup` archives | 180 days | 20 | 5 |

Pinned records are never removed by automatic cleanup. The writer can pin/unpin, explicitly delete, export backups, export safe storage diagnostics, or run cleanup for old unpinned evidence.

**Canonical PPF revision history, accepted creative mutations, candidate provenance and asset provenance inside the project are never automatically pruned by this retention policy.**

## Storage visibility and diagnostics

Diagnostics shows:

- total bytes across managed Run/Verification/raw-verification-log/complete-backup stores;
- reclaimable bytes under the current retention defaults;
- planned deletion count;
- individual managed evidence records with pin/delete controls.

Safe diagnostics export includes storage metadata only: IDs/file names, categories, timestamps, sizes and pin state. It excludes project content, prompts, model request bodies, credentials, provider secrets, signing keys and BUZZ private data.

## Signing-key recovery is separate from project restore

A project archive cannot recreate the PlotPickle Studio private signing key. That separation is intentional.

If a Studio private signing key is lost, recovery must use the Studio identity/key recovery flow defined by the connector/federation trust boundary. A project restore must never silently generate a replacement key or claim the old Studio cryptographic identity was restored.
