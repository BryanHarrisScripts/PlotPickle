# Developer Brief — #1943 Phase 4 Shadow Equivalence and De-duplication

Parent: #1922

## Purpose

Phase 4 begins the tidy/de-duplicate stage of the seven-layer verification migration. Phases 0–3 established the inventory, typed catalog/evidence contracts, shared verification core, and seven visible shadow checks. This phase must now prove that selected architecture-owned tests can replace duplicate legacy execution without weakening merge authority or silently expanding shadow permissions.

This is deliberately not a wholesale migration. PR Gate and Product Gate remain merge-authoritative, the seven architecture checks remain shadow/non-required, and the architecture blueprint wording stays unchanged until the later promotion/retirement phases.

## Phase 3 evidence entering this phase

PR #1942 proved the first seven-shadow topology on exact head `1bbfaa041290e7d4a1280ceb6d49a9323454547d`:

- PR Gate passed;
- Product Gate passed;
- Architecture Shadow Verification passed;
- exactly seven shadow jobs were visible;
- all seven jobs produced layer evidence artifacts;
- ordinary shadow execution used no network/native/secrets authorization;
- normal Product Gate continued to skip Pi managed compatibility and the real whisper.cpp native smoke.

That proof is sufficient to begin migration, but not sufficient to remove arbitrary legacy coverage. Each removed execution must now have a named catalog owner and passing exact-head shadow replacement evidence.

## First migration candidate

The Phase 0 inventory identified `Validate bundled local video setup` as duplicated in both PR Gate and Product Gate. The legacy step runs two tests:

- `tests/ltx-bundled-default.test.mjs`
- `tests/local-ai-plugin-registry.test.mjs`

These are not equally safe to migrate.

### Migrate now: local AI plug-in registry

`tests/local-ai-plugin-registry.test.mjs` is a pure Node/file-contract test. It reads the governed provider/plugin registry and related TypeScript source files as text. It does not require npm packages, network access, native execution, secrets, provider credentials, or hardware.

It therefore becomes a fast Layer 6 baseline catalog entry:

`provider.local-ai-plugin-registry` -> `provider-runtime`

It runs once in the Layer 6 shadow check on every PR. Its two duplicate legacy target executions are removed from PR Gate and Product Gate.

### Retain for now: LTX bundled-default contract

`tests/ltx-bundled-default.test.mjs` imports the `typescript` package and exercises more substantial local-video provider behavior. Moving it into the current dependency-light shadow job would require package installation or a new dependency-aware runner path.

Phase 4 does not add npm installation to every shadow job. The LTX test therefore remains in both legacy gates until a later Phase 4 slice proves an efficient single-owner execution path.

### Retain for now: security closeout duplicate group

The security bundles overlap between PR Gate and Product Gate but include broader platform and authority concerns. They require test-by-test ownership/equivalence review. Phase 4 records that duplicate group as retained rather than removing it prematurely.

## Machine-readable migration proof

`config/verification/phase-4-migration.json` records:

- merge-authoritative workflows;
- shadow workflow identity;
- migrated catalog test ID and owner layer;
- exact legacy workflow/step/target executions being removed;
- required shadow result;
- retained duplicate groups and why they remain.

`scripts/verification-shadow.mjs` now produces a third per-layer artifact:

`.artifacts/verification-shadow/<layer>.comparison.json`

For each migration owned by that layer, the comparison record reports:

- exact commit SHA;
- catalog test ID;
- legacy executions being replaced;
- actual shadow result;
- required result;
- proof status: `replacement-proven`, `replacement-failed`, or `not-selected`;
- still-retained duplicate groups for that layer.

A removal is considered proven only when the architecture-owned selected test actually returns the required passing result on the exact PR head. Configuration intent alone is not proof.

## Workflow changes

### Architecture Shadow Verification

No new job is added. The existing seven-job matrix remains intact. Each job still runs the shared Phase 2 core with heavy/network/native/secrets disabled. Artifact upload now includes the comparison JSON.

### PR Gate

PR Gate remains authoritative. It:

- keeps the LTX local-video contract;
- removes only `tests/local-ai-plugin-registry.test.mjs` from the duplicated local-video step;
- runs the focused #1943 regression alongside the Phase 2/3 verification tests.

### Product Gate

Product Gate remains authoritative. It:

- keeps the LTX local-video contract;
- removes only `tests/local-ai-plugin-registry.test.mjs` from the duplicated local-video step;
- otherwise retains its existing Windows/UAT/build/installer behavior.

No Product Gate native/provider expansion is introduced.

## Security and authority invariants

- PR Gate and Product Gate remain the only merge-authoritative gates.
- Seven architecture checks remain shadow/non-required.
- No PR text, Agent output, or model response influences selection.
- No arbitrary shell runner is added.
- No network/native/secrets permission is enabled in ordinary shadow jobs.
- Unknown production ownership remains fail-closed.
- No broad product-folder ownership is guessed.
- Phase 4 migration metadata cannot itself grant product authority.
- Existing production tests are removed from legacy execution only when a replacement owner and exact-head evidence exist.

## Expected exact-head proof before merge

The Phase 4 PR is merge-ready only when:

1. PR Gate passes on the exact head.
2. Product Gate passes on the exact head.
3. All seven architecture shadow jobs are present and pass meaningfully.
4. Layer 6 selects and passes `provider.local-ai-plugin-registry`.
5. Layer 6 comparison evidence reports `replacement-proven` for `provider.local-ai-plugin-registry` on the exact head.
6. The comparison artifact still lists the LTX and security duplicate groups as retained.
7. The focused #1943 regression passes.
8. No unrelated product or architecture reshuffle appears in the diff.

## Follow-on Phase 4 work

After this first migration proves the process, continue test-by-test rather than step-by-step:

- design a dependency-aware single-owner path for `ltx-bundled-default.test.mjs` without installing the full dependency tree seven times;
- decompose the security overlap into individually owned contracts and keep platform-specific proof where it is actually required;
- use measured shadow evidence to identify obsolete regressions whose protected architecture no longer exists, rewriting valuable historical intent against current authority instead of deleting it blindly;
- move expensive provider/native/UAT work only after deterministic impact selection and replacement evidence are demonstrated.

Phase 5 remains responsible for expanding live runtime evidence, especially the #1920 WebMCP class and provider/native/plugin/MCP boundaries.
