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

## Story Council adapter slice

Source: `modules/story-workflow/story-council.ts`
Target: `modules/story-workflow/council/story-council.ts`

Consumers/path assertions updated:
- `tests/issue-1417-story-council.test.mjs`
- `tests/issue-1417-story-council-afterglow.test.mjs`

Behavior and authority preserved:
- Story Council remains proposal/evidence only and cannot mutate PPF/canon directly;
- specialist selection continues to use approved Agent Profiles and bounded Context packets;
- Responsibility Runs and Graph limits remain unchanged, including zero paid-cloud budget;
- writer approval remains the verification boundary for creative proposals;
- BUZZ signed provenance remains evidence only and never canon authority;
- no compatibility shim remains at the retired root path.

The ratified `phase2-modules-story-council` batch is now complete. Remaining Story Bridge and Story Workflow root moves stay queued as separate coherent #1463 slices.
