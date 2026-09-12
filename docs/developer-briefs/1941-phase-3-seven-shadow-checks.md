# Phase 3: Seven Architecture Shadow Checks

Parent: #1922
Issue: #1941
Depends on: Phase 0 inventory, Phase 1 contracts, and Phase 2 verification core.

## Objective

Expose PlotPickle's seven canonical architecture layers as visible pull-request checks without changing merge authority yet.

The existing `PR Gate` and `Product Gate` remain authoritative. Phase 3 is observational: it proves that the shared verification core can produce seven stable architecture-level check results from the exact PR diff while preserving the old gates for comparison.

The approved visible names remain sourced from `config/verification/phase-0-inventory.json`:

1. Layer 1 Experience Skins
2. Layer 2 Experience Contract
3. Layer 3 Production Orchestration
4. Layer 4 Agent & Skill Mesh
5. Layer 5 Story / Canon / Evidence
6. Layer 6 Provider Runtime
7. Layer 7 Validation & Operations

Their canonical IDs continue to come from `architecture/plotpickle.architecture.json`. No second architecture taxonomy is introduced.

## Why this phase exists

The current two-gate topology still mixes many different architecture concerns. Phase 0 measured that cost and duplication. Phase 1 defined typed catalog, ownership and evidence contracts. Phase 2 moved selection and execution logic below GitHub Actions into a reusable verification core.

Phase 3 now makes that architecture visible without prematurely migrating the existing test estate.

This preserves the core lesson from #1920: more tests are not useful if they do not observe the changed boundary. The eventual architecture checks need to explain why evidence ran and, later, select the correct live/runtime proof. Phase 3 establishes the stable seven-check surface before that migration begins.

## Implementation

### One workflow, seven jobs

`.github/workflows/architecture-shadow.yml` uses one matrix job rather than seven copied YAML implementations.

Every pull request to `main` receives all seven jobs. There are no path filters and `fail-fast` is disabled, so one failing layer does not hide the others.

The matrix contains only canonical layer ID plus approved display name. Selection logic does not live in YAML.

### Shared shadow adapter

`scripts/verification-shadow.mjs` is the GitHub adapter for the Phase 2 core.

For one layer it:

- loads canonical architecture, Phase 0 display names, Phase 1 vocabulary, the test catalog and ownership map;
- computes the exact changed-file set from the PR base SHA to `HEAD`;
- calls `planVerification` in impact mode;
- keeps heavy, network, native and secrets permissions disabled;
- executes only catalog-selected tests for that layer through registered typed runners;
- calls `emitEvidence` with the exact commit SHA;
- writes normalized evidence and a Phase 3 shadow summary under `.artifacts/verification-shadow/`.

The core remains the authority for ownership, tokens and test selection. GitHub Actions is only an adapter/orchestrator.

### Baseline meaning in Phase 3

Every shadow job runs the same deterministic configuration baseline because `planVerification` validates the architecture/display contract, vocabulary, catalog and ownership configuration before it can produce a plan.

This baseline is intentionally not represented as seven duplicated catalog tests. The rule from #1922 still applies: deterministic tests have one primary owner and should not be copied into every layer simply to create green boxes.

Layer 7 currently owns the only live catalog entry, `verification.phase2-core`, so Layer 7 also executes that fast self-test. The other six layers currently have no migrated catalog tests, which is deliberate.

For an unaffected layer with no selected test, `runLayer` returns `not-impacted-beyond-baseline`. The job remains visible and produces exact-head evidence rather than disappearing.

## Unknown production ownership

Unknown production changes continue to fail closed.

If the plan contains an unmapped production file, the shadow adapter does not run selected tests. It writes per-layer evidence plus a summary containing the blocking findings and exits non-zero.

This means architecture debt is visible during the shadow period instead of being silently interpreted as `not impacted`.

Phase 3 does not add broad `app/**`, `lib/**` or other guessed production mappings to make the dashboard look complete. Product ownership will be registered deliberately as architecture boundaries are proven.

## Cost and security

The Phase 3 workflow intentionally does not run `npm ci` seven times. The current selected catalog entry uses Node built-ins and is safe to execute without dependency installation.

The adapter registers only local typed runners for `node-test`, `node-script`, `npm-script` and `build`, and uses process argument arrays with `shell: false`.

Planning always sets:

- heavy: false;
- network: false;
- native: false;
- secrets: false.

Any catalog entry requiring those permissions is skipped with the Phase 2 reason codes rather than being executed silently.

This keeps whisper.cpp, real Pi compatibility, provider/native smoke and similar expensive work out of ordinary Phase 3 shadows.

## Evidence

Each architecture job writes:

- `.artifacts/verification-shadow/<layer-id>.json` — normalized Phase 1 evidence;
- `.artifacts/verification-shadow/<layer-id>.summary.json` — Phase 3 comparison data.

The summary records:

- exact commit SHA;
- layer ID;
- plan status;
- baseline status;
- whether the layer was impacted;
- changed files;
- risk tokens;
- selected tests;
- skipped tests and reasons;
- blocking findings;
- result and duration;
- evidence path.

Each job uploads those files independently. This provides the machine-readable history Phase 4 will need for equivalence and de-duplication work.

## Legacy topology regression update

The old #1747 and #538 tests previously asserted that exactly two workflows could contain a `pull_request` trigger. That assertion represented the pre-Phase-3 topology rather than the actual authority rule.

They are updated narrowly to assert:

- `PR Gate` remains the authoritative Linux gate;
- `Product Gate` remains the authoritative Windows/product gate;
- `Architecture Shadow Verification` is the only additional pull-request workflow introduced by Phase 3;
- existing specialized workflows remain non-PR-triggered.

No existing product test is removed or moved by this change.

## Phase 3 boundaries

This phase does not:

- make the seven architecture checks required;
- change branch protection;
- remove PR Gate or Product Gate;
- de-duplicate security or local-video tests;
- move existing product tests into the catalog;
- run real whisper.cpp, Pi, provider, native or packaged UAT work;
- broaden production ownership mappings;
- change the Layer 7 architecture blueprint text that still describes the current two authoritative gates.

Those changes belong to later phases after shadow evidence proves the new topology.

## Exit criteria

Phase 3 is ready to merge when:

- one workflow exposes exactly seven approved architecture job names;
- all seven are present on the PR regardless of impact;
- unaffected layers report `not-impacted-beyond-baseline`;
- Layer 7 executes the current safe catalog self-test when selected;
- unknown production ownership remains fail-closed;
- exact-head evidence is emitted and uploaded;
- #1747/#538 topology regressions recognize two authoritative gates plus the one shadow workflow;
- the focused #1941 regression is green;
- existing PR Gate and Product Gate are both green on the exact PR head.

Phase 4 will use the measured shadow evidence to begin equivalence analysis, remove proven duplicate execution and register architecture-owned tests incrementally rather than through a big-bang migration.
