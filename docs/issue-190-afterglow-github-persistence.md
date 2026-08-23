# Issue #190 — Optional GitHub-backed Afterglow persistence

## Product boundary

PlotPickle keeps its current bundled Afterglow example as the default. Loading that example with GitHub mode off continues to recreate the bundled project in browser storage.

The Dashboard reports one current state:

- Afterglow not loaded
- Afterglow loaded locally
- Afterglow GitHub repository connected

“Loaded locally” is deliberately not described as connected.

## Opt-in persistence

The Dashboard switch `Use Afterglow GitHub repository` is off by default. Enabling it:

1. Verifies `BryanHarrisScripts/Afterglow-Echoes-of-Sentience` through the existing GitHub connection.
2. If the repository has no PlotPickle manifest, asks before adding only the missing bootstrap files.
3. Confirms the stable Afterglow project ID against the repository manifest.
4. Saves Afterglow under the existing `projects-v2/afterglow-echoes-of-sentience/` folder.
5. Records the opt-in preference under the current PlotPickle data folder, outside the installed application.

The repository connection is reported only after the exact owner, repository and green readiness result have been verified.

## Saving and recovery

While GitHub mode is enabled, active Afterglow edits also save through the canonical folder-project gateway. The existing atomic module writes and rolling backups remain responsible for durability.

Loading Afterglow first opens the persistent local folder. If that folder is absent and the verified repository has canonical project files, PlotPickle restores the approved repository version and saves it locally.

If GitHub is unavailable, PlotPickle keeps and opens the persistent local project, reports that GitHub needs repair and never removes local work.

Disabling the switch does not delete the persistent project or backups. The next ordinary local load returns to the bundled-example behaviour.

## Repository safety

This integration reuses existing controls:

- missing repository setup requires explicit confirmation;
- existing repository files are preserved;
- project identity is checked before synchronization;
- pull and publish remain reviewed actions;
- no automatic publish, force-push or unmanaged deletion is introduced.
