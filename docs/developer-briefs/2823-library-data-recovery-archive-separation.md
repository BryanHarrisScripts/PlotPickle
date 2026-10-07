# #2823 — Separate Library resume flow from Data Recovery and Archive

## Summary

PlotPickle currently mixes three distinct Human jobs:

1. opening/resuming a story from Library;
2. intentionally restoring an older project state;
3. restoring an archived story to the Library shelf.

The current Afterglow **Open Example with Your Changes** path exposes an interactive **Restore Local Changes** dialog with resource-selection checkboxes, **Select All**, **Current project resources**, and **Legacy** groups.

That interaction was appropriate when local-resource recovery was being treated as a manual salvage/import step.

It is not appropriate for normal story resume.

The product contract is now:

> Library tells the Human what story state is about to open.

> Settings → Data Recovery is where the Human intentionally chooses an older recovery point.

> Archive is where intentionally shelved stories live and can be restored to Library.

The saved Afterglow project is a snapshot of where the Human left the story. It is not a snapshot of PlotPickle behavior.

Current PlotPickle code and controls remain authoritative whenever any saved, recovered, or archived project state is opened.

## Current implementation findings

### Library currently owns an interactive recovery step

`modules/library/ui/library-workspace.tsx` currently:

- loads the latest profile-local Afterglow project for **Open Example with Your Changes**;
- scans `/api/local-ai/assets`;
- inventories recoverable local resources;
- groups those resources by origin project;
- preselects exact/current-project groups;
- leaves older groups as **Legacy** requiring explicit Human selection;
- renders **Restore Local Changes**;
- renders **Select All**;
- renders per-origin checkboxes;
- runs `restoreLocalStoryboardResources`, `restoreLocalWorldMapPosterResources`, and `restoreLocalWorldMapCharacterResources` only for the selected groups.

This is the workflow that must be simplified.

### Data Recovery already exists but is presently review-only

`Settings → Data Recovery` is already wired through:

- `app/skin-v1/settings-workspace-panel.tsx`;
- `app/skin-v1/settings-review-system-panel.tsx`.

The current Data Recovery surface already reads:

- local storage status;
- local project files;
- rolling backup files;
- backup retention.

It explicitly says it is read-only and that restore operations happen elsewhere.

### Restore machinery already exists elsewhere

`app/github-collaboration-base.tsx` already contains local project recovery behavior that can:

- load a current disk project for preview;
- load a backup through `/api/local-projects/recover`;
- compare it with the active project;
- restore the entire project;
- restore selected project areas;
- preserve the current GitHub collaboration connection when applying a local restore.

This is important: #2823 should consolidate existing recovery behavior into Settings → Data Recovery rather than invent another recovery engine.

### Archive already has distinct semantics

`modules/library/ui/archive-stories-panel.tsx` already:

- lists archived stories;
- shows archived date/time;
- restores archived projects to Library;
- supports permanent deletion with explicit confirmation.

Archive should remain distinct from rolling recovery points.

## Product authority model

### Library authority

Library answers:

> Which story do I want to work on now?

Library normal-load actions must not ask the Human to choose which fragments of their own saved project to reconstruct.

### Data Recovery authority

Data Recovery answers:

> Which earlier saved state do I intentionally want to recover?

Recovery is an exceptional operation and must remain explicit.

### Archive authority

Archive answers:

> Which story did I intentionally put away, and do I want it back on the active shelf?

Archive is reversible shelving, not time-based recovery.

## Afterglow Library contract

### Open Example

**Open Example** means:

- open a fresh working copy of the packaged canonical Afterglow reference;
- do not import the Human's prior profile-local Afterglow working state;
- do not auto-attach unrelated local media;
- do not ask about **Legacy** media;
- apply current PlotPickle runtime/control semantics.

### Open Example with Your Changes

**Open Example with Your Changes** means:

- load the latest durable profile-local Afterglow working project;
- resume the exact Human story state saved in that working project;
- automatically reconnect exact/proven local media expected by that project;
- ignore unrelated local media;
- report missing expected media;
- do not ask the Human to select provenance groups;
- do not show **Current project resources** versus **Legacy** as normal user choices;
- do not show **Select All**;
- do not turn a normal open into a recovery workflow.

## Resume manifest

The existing recovery modal shell can be reused visually if useful, but its role changes completely.

It becomes a concise resume manifest.

Example:

> Afterglow: Reflections of Sentience  
> Last saved: Oct 7, 2026 · 7:42 AM  
> 13 Storyboard images · 25 character references · 18 locked shots  
> Opening your latest saved working state.

Actions:

- **Open Story** / **Continue**
- **Cancel**

No resource checkboxes.

No origin project IDs as the primary explanation.

No **Legacy** decision.

### Resume manifest should communicate

At minimum:

- story title;
- last saved date/time;
- whether this is the latest saved state;
- media counts useful to the Human;
- missing expected media count, if any;
- provenance status when the active working state was itself restored from recovery or Archive.

## Load provenance

Library should transparently identify how the current working state came to exist.

### Latest saved working state

> Opening your latest saved Afterglow state from Oct 7, 2026 · 7:42 AM.

### Restored from recovery

> Opening Afterglow restored from recovery point Oct 5, 2026 · 9:18 PM.

### Restored from Archive

> Opening Afterglow restored to Library from Archive on Oct 4, 2026.

This is informational provenance only.

It must not trigger another recovery decision.

## Automatic local-media reconciliation

The local-resource scanner remains useful as internal infrastructure.

For normal **Open Example with Your Changes**, the system should:

1. load the latest durable saved project;
2. determine which local-media resources the project expects;
3. scan the local asset inventory;
4. reconnect exact/proven matches automatically;
5. preserve current metadata precedence established by #2821;
6. ignore unrelated local assets;
7. report expected-but-missing resources;
8. persist the reconciled current project;
9. open the story.

### Matching criteria

Automatic reconnection must require deterministic evidence such as:

- exact asset URL;
- exact content hash;
- exact stable artifact/media identity;
- proven recovery-origin + content-hash chain where needed;
- exact saved Library provenance.

Do not attach media merely because it shares a Block, Mini-Block, Shot position, filename shape, or historical origin.

### Current state remains authoritative

For any artifact already present in the current saved working state:

- current Save marker wins;
- current Lock/Unlock state wins;
- current rejection/deletion state wins;
- current prompt/provenance wins;
- historical local-resource snapshots are fallback evidence only.

This preserves the #2821 fix.

## Missing media behavior

If the saved project expects a local media file that cannot be found:

- keep the project metadata intact;
- do not substitute an older/unrelated file;
- report the missing count in the Library resume manifest;
- allow normal opening where safe;
- provide a route to Settings → Data Recovery if the Human wants to investigate earlier versions.

Example:

> 2 expected Storyboard images are unavailable on this computer. Your saved story state will still open; missing media will remain marked unavailable.

## Data Recovery contract

Settings → Data Recovery becomes the single intentional time-based recovery surface.

### Required recovery list

Recovery points should be presented newest-to-oldest.

Each entry should expose Human-readable metadata where available:

- story/project title;
- recovery date/time;
- project revision/version;
- integrity status;
- size;
- recovery source/type:
  - rolling backup;
  - current local project file;
  - restored-from-Archive state where applicable;
  - other explicit supported recovery source.

Opaque filenames may still be available as technical detail, but not as the primary label.

## Recovery preview

Selecting a recovery point must not mutate the active project.

The Human first previews the candidate.

Preview should show meaningful differences such as:

- story fields changed;
- Blocks changed;
- scenes changed;
- screenplay elements changed;
- characters changed;
- Story Threads changed;
- relevant production/project areas changed.

Reuse the existing comparison/recovery machinery where practical.

## Recovery actions

After preview, Data Recovery may offer:

- **Restore Entire Story**
- **Restore Selected Areas**

Selected-area restore remains available only where the project model and current code can safely support it.

All destructive recovery operations require explicit Human confirmation.

## Reversible recovery requirement

Before applying a recovery that replaces current active project material:

1. persist the current active Library project;
2. create/preserve a new recovery point for the current state;
3. verify that point is durable;
4. only then apply the selected older recovery state.

This ensures:

> Recovering from a mistake must not make the current state unrecoverable.

## Recovery provenance

After an intentional restore, persist enough project metadata to identify:

- recovery performed;
- source recovery point/date;
- restored-at date/time.

Library can then display that provenance next time the story opens.

Do not make this provenance dictate runtime behavior.

## Archive contract

Archive remains separate from Data Recovery semantics.

### Archive means

- remove the story from the active Library shelf;
- retain the complete local project;
- keep archived date/time;
- allow **Restore to Library**;
- allow explicit permanent delete.

### Archive does not mean

- choose an earlier project revision;
- merge selected project areas;
- reconstruct missing local resources;
- select a rolling recovery point.

Data Recovery may surface Archive as a neighboring recovery/safety concept, but the UI and labels must keep them distinct.

## Library Archive provenance

When a previously archived story is restored to Library, preserve enough state to allow a normal load summary to say:

> Restored to Library from Archive on Oct 4, 2026.

Again, this is informational only.

## UI changes

### Remove from normal Library resume

Remove from **Open Example with Your Changes**:

- **Restore Local Changes** as a recovery action;
- **Changes found locally** fieldset;
- **Select All**;
- local-resource group checkboxes;
- **Current project resources** choice;
- **Legacy** choice;
- **requires your explicit selection**.

### Replace with

A resume/load manifest containing:

- title;
- latest saved date/time;
- current state provenance;
- automatic media reconciliation summary;
- missing media warnings;
- **Open Story/Continue**;
- **Cancel**.

## Settings → Data Recovery UI

Promote the current read-only Data Recovery review into an actionable recovery centre.

The normal flow should be:

1. choose/identify project;
2. choose recovery point by date/time;
3. preview;
4. compare;
5. choose entire-story or selected-area restore;
6. confirm;
7. preserve current state;
8. restore;
9. record provenance;
10. report success.

## Archive UI

Current Archive behavior may remain largely intact, but should be reviewed for:

- clear archived date/time;
- clear **Restore to Library** language;
- explicit permanent-delete distinction;
- restored-from-Archive provenance.

## Implementation phases

### Phase 1 — Library resume simplification

- Remove interactive origin/resource selection from the normal Afterglow resume path.
- Add deterministic automatic media reconciliation.
- Add resume manifest with save date/time and counts.
- Add missing-media warning.
- Preserve #2821 current-state precedence.

### Phase 2 — Load provenance

- Introduce/normalize durable provenance for:
  - last-saved working state;
  - restored-from-recovery;
  - restored-from-Archive.
- Expose Human-readable provenance in Library.
- Ensure provenance never controls runtime behavior.

### Phase 3 — Data Recovery activation

- Move/reuse local project/backup preview and comparison behavior inside Settings → Data Recovery.
- List recovery points by date/time.
- Support preview.
- Support entire-story restore.
- Support selected-area restore where already safe.
- Preserve current state before destructive restore.

### Phase 4 — Archive alignment

- Preserve current Archive semantics.
- Add/verify restore-to-Library provenance.
- Ensure Archive remains distinct from recovery points.

### Phase 5 — Integrated UAT

Exercise:

1. work in Afterglow;
2. save/lock media;
3. unload safely;
4. open Library;
5. choose **Open Example with Your Changes**;
6. observe resume manifest;
7. open without any resource-selection step;
8. verify exact state/media;
9. go to Settings → Data Recovery;
10. choose an older recovery point by date;
11. preview without mutation;
12. preserve current state;
13. restore;
14. verify Library reports recovery provenance;
15. archive story;
16. restore it to Library;
17. verify Archive provenance remains distinct.

## Required behavioral regressions

### Library

Prove:

- normal **Open Example with Your Changes** does not render interactive resource-selection controls;
- current/proven media reconnect automatically;
- unrelated local media is not attached;
- missing expected media produces a warning;
- latest saved date/time is shown;
- no opaque origin project decision is required from the Human.

### Data Recovery

Prove:

- recovery points are sorted newest-to-oldest;
- date/time is Human-readable;
- preview does not mutate active state;
- entire restore requires confirmation;
- selected-area restore requires confirmation;
- current state is safely preserved before replacement;
- restore provenance is persisted.

### Archive

Prove:

- archive removes story from active shelf;
- restore returns story to Library;
- archived date remains available;
- recovery points and Archive remain distinct concepts;
- restore-from-Archive provenance is Human-readable.

### Cross-cutting

Prove:

- current PlotPickle runtime/control behavior remains authoritative regardless of whether the story was loaded normally, restored from recovery, or restored from Archive;
- #2821 current Storyboard artifact precedence remains intact;
- Storyboard Save/Lock/Unlock markers are not downgraded;
- authenticated session state is not altered by any of these load paths.

## Likely files

Primary:

- `modules/library/ui/library-workspace.tsx`
- `modules/library/local-resource-recovery.ts`
- `modules/library/ui/archive-stories-panel.tsx`
- `app/skin-v1/settings-review-system-panel.tsx`
- `app/skin-v1/settings-workspace-panel.tsx`
- `app/github-collaboration-base.tsx`
- `build/local-storage-safety-gateway.ts`
- project/library/profile persistence modules as needed for restore provenance.

Tests should extend the existing Library, local-resource recovery, Settings organization, local-project recovery, Archive and #2821 coverage rather than replacing those contracts with source-only checks.

## Non-goals

- Do not remove local-resource inventory infrastructure.
- Do not make automatic time-based rollback part of normal Library load.
- Do not treat Archive as a backup revision.
- Do not attach unrelated local media.
- Do not weaken deterministic provenance matching.
- Do not weaken Human confirmation for destructive restore.
- Do not change Afterglow story content.
- Do not reintroduce historical-state precedence fixed by #2821.

## Acceptance criteria

#2823 is complete when:

- **Open Example with Your Changes** behaves as a normal resume action;
- no interactive resource-selection recovery dialog appears;
- saved/proven media reconnect automatically;
- Library tells the Human when and what state is about to open;
- restored/recovered provenance is visible when relevant;
- Settings → Data Recovery owns deliberate restore-by-date/version;
- recovery preview is non-mutating;
- current state is preserved before rollback;
- Archive remains reversible shelving and distinct from recovery;
- the current PlotPickle runtime remains authoritative under every load path;
- behavior-level tests prove the full flow.

## Delivery sequence

Developer brief → build → focused tests → fix → PR → exact-head verification → fix until green → merge when green.

Related: #2016, #2432, #2473, #2509, #2603, #2751, #2817, #2819, #2821, PR #2822.
