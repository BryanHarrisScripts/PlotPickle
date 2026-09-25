# Developer Brief — #2432 Library Load local-resource restore

## Goal

Library → Load becomes the recovery authority for a loaded story plus the durable local resources created around it.

The first supported proof is Storyboard WebP recovery, including the current Afterglow case where generated frames remain under PlotPickle's persistent local assets directory even when session-scoped project metadata is no longer present.

## Product flow

1. Open **Library → Load**.
2. Choose a saved story or **Load Afterglow** directly.
3. PlotPickle loads the base/default project first.
4. PlotPickle records a **Load Session** baseline:
   - session ID;
   - project ID;
   - source identity;
   - base project revision;
   - start time.
5. PlotPickle scans `GET /api/local-ai/assets`.
6. PlotPickle shows a recovery decision:
   - **Use Project Defaults** — continue without attaching any local resource;
   - **Restore Local Resources** — attach explicitly selected local resource groups.
7. Restored resources become draft candidates only.

## Storage truth

Generated media bytes are durable under `persistentHome()/assets`.
On Windows the default is `%LOCALAPPDATA%\PlotPickle\assets`.

The current Storyboard filename format contains recoverable address evidence:

`storyboard-<origin-project-id>-<block>-<mini>-<position>-<request-ts>-<save-ts>.webp`

Legacy recovery uses this filename evidence. The local asset index remains read-only.

## Restore policy

Generated files are immutable.

Restore must:
- never overwrite/delete/move local files;
- never replace packaged/default project media;
- never accept/lock/reject anything automatically;
- preserve multiple candidates for one position;
- skip duplicates already attached by URL or deterministic recovery ID;
- preselect only resources whose origin project ID exactly matches the loaded project;
- require explicit Human selection for unmatched/legacy origin-project groups;
- leave unclassified assets visible as inventory only.

A recovered Storyboard frame is attached as:
- workflow: `storyboard-frame-webp-v2`;
- reviewState: `draft`;
- provider: `local recovery`;
- Block/Mini-Block/position source decision keys reconstructed from the filename;
- original asset URL unchanged.

## Revision / cloud rule

The Load Session base revision is the comparison ancestor for later story-data reconciliation.

Media merge is additive.

Canonical story merge is **not** last-write-wins:
- current revision == base revision: normal save path may continue;
- current/cloud revision != base revision: story/canon changes require explicit three-way reconciliation before overwrite.

This issue does not invent or emulate a cloud persistence provider. It records the merge boundary so a cloud-backed source can plug into it later.

## Afterglow

LOAD exposes the packaged Afterglow reference directly as a base/default source. Examples may continue to expose Afterglow as reference material.

Loading Afterglow creates a normal working copy. Local legacy resources are not assumed to belong to the new working-copy ID; they remain unselected until the Human explicitly chooses the relevant origin group.

## Verification

Focused tests must prove:
- filename parsing and bounds;
- grouping/exact-project preselection;
- additive restore;
- duplicate skipping;
- no auto-accept;
- Load Session base revision;
- revision reconciliation state;
- LOAD exposes Afterglow directly;
- recovery UI offers Use Project Defaults / Restore Local Resources;
- unmatched groups require explicit selection.

Stop before opening the PR.
