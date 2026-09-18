# Developer Brief — #2210 OSS Radar State Separation

## Goal

Move OSS Radar machine memory out of GitHub issue comments and into GitHub-native storage while keeping the daily report Human-readable and preserving deterministic history behavior.

## Architecture

### Human report

The rolling monthly `[OSS RADAR]` issue contains only the daily Human-facing report:

- seven PlotPickle architecture areas;
- up to three findings per area;
- Story-to-Screen public/X digest;
- PlotPickle footer;
- the small day marker used for same-day comment idempotency.

New daily reports do **not** contain `PLOTPICKLE-OSS-RADAR-STATE`.

### Persistent machine state

The Radar uses a dedicated branch:

`oss-radar-state`

with one authoritative snapshot:

`.oss-radar/state.json`

The state file stores:

- reviewed-finding history for duplicate suppression;
- candidate first-seen / last-seen history;
- cumulative query-effectiveness history;
- last successful report metadata;
- a pre-run baseline so same-day reruns remain idempotent.

The branch is created automatically from the repository default branch when absent. Runtime state commits never modify `main`.

### Legacy migration

If the state file is absent, the first run reconstructs the existing state from legacy Radar comments using the historical hidden-state markers.

After the Human report publishes successfully, the run writes the new authoritative snapshot to `oss-radar-state`.

Legacy marker parsing remains supported only for migration/backward compatibility.

### Actions evidence artifact

Every successful workflow run builds and uploads an `oss-radar-<run_id>` artifact containing:

- `result.json`
- `discovery.json`
- `state.json`
- `report.md`
- `public-digest.txt`

Retention is 90 days.

## Authority and permissions

The workflow permissions are:

- `contents: write` — required only to create/update `oss-radar-state`;
- `issues: write` — required to publish/update the monthly Radar issue.

No dependency-install, source-import, pull-request, or third-party code-execution authority is added.

## Same-day and next-day behavior

Same-day reruns use the pre-run baseline preserved in the state snapshot, so rerunning the same date updates the same report without suppressing its own findings or double-counting query history.

On the next date, the committed state becomes authoritative and unchanged previously reviewed repositories remain suppressed under #2194.

## Publish-size guard

The issue publisher has a 240,000-character Human-report guard and includes request-body character count in API errors. The large machine state no longer contributes to that limit.

## Verification

Required evidence:

- existing legacy Base64 markers remain parseable;
- new rendered reports contain no state marker;
- dedicated state branch can be created and state round-tripped;
- same-day baseline and next-day committed histories behave differently as intended;
- Phase 4 full UAT migrates from legacy comments to state-branch memory;
- Actions artifact bundle contains the complete expected evidence files;
- workflow uses `contents: write` and `actions/upload-artifact@v4`;
- all existing #1977, #2034, #2087, #2194 regressions remain green.

Refs #2014 #2034 #2194 #2208 #2210.
