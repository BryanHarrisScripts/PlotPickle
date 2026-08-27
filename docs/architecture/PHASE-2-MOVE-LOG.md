# Architecture Phase 2 Move Log

Issue #1463 consolidates Story Workflow, Council, Decisions and Workbench ownership under the ratified Phase 0 target without changing product behavior or authority boundaries.

## Story Council runtime slice

Source: `modules/story-workflow/story-council-runtime.ts`
Target: `modules/story-workflow/council/story-council-runtime.ts`

Consumers/path assertions updated:
- `tests/issue-1417-story-council-runtime.test.mjs`

Behavior and authority preserved:
- local Story Council runtime remains proposal/evidence only;
- PPF/canon mutation authority is unchanged and remains Human-gated;
- BUZZ is not introduced as a local runtime dependency;
- Agent Profile and bounded Context contracts remain unchanged;
- no compatibility shim remains at the retired root path.

This is the first bounded Phase 2 structural slice and does not close #1463. Remaining ratified Story Council, Story Bridge and Story Workflow root moves stay queued for subsequent coherent slices.
