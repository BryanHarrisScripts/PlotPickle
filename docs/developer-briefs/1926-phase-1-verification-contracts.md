# Developer Brief — #1926 Phase 1 Verification Contracts

## Parent
#1922 — Seven-Layer Evidence-Driven Verification Mesh

## Dependency
Phase 0 inventory PR #1925 merged before this build. The Phase 0 measurements remain historical evidence. Main has already applied one immediate optimization from that evidence: the real Pi compatibility evaluation and whisper.cpp native smoke are manual `workflow_dispatch` work rather than ordinary pull-request work.

## Goal
Define the deterministic data contracts needed by the seven-layer verification mesh without moving tests, renaming required checks, or changing current PR Gate/Product Gate authority.

## Canonical architecture authority
The only architecture taxonomy remains `architecture/plotpickle.architecture.json`:

1. `experience-skins`
2. `experience-contract`
3. `production-harness`
4. `agent-runtime`
5. `story-canon`
6. `provider-runtime`
7. `verification`

Phase 1 validators reject owner layer IDs that do not resolve to those seven IDs.

## Human-facing check names
The seven planned Human-facing layer names remain stored once in configuration, in `config/verification/phase-0-inventory.json#displayChecks`. `config/verification/phase-1-vocabulary.json` points to that source instead of duplicating the names.

This is a configuration authority decision only. Current visible required checks remain `PR Gate` and `Product Gate` until the later shadow/proven cutover phases in #1922.

## Phase 1 contracts

### Vocabulary
`config/verification/phase-1-vocabulary.json` defines the governed vocabulary for risk tokens, typed runner kinds, cost classes, execution modes, platforms and evidence types. It also fixes the unknown-production ownership policy to `fail-closed`.

### Test catalog
`schema/verification/test-catalog.schema.json` defines the future catalog record shape. A catalog record declares:

- one primary owner architecture layer;
- architecture components;
- trigger/risk tokens;
- a typed runner and stable targets, not arbitrary shell text;
- cost;
- one or more modes;
- platform requirements;
- network/native/secrets requirements;
- evidence outputs;
- optional migration metadata such as `replacementFor` and `supersedes`.

`config/verification/test-catalog.json` is intentionally empty in Phase 1. Existing tests still execute exactly where they do today. Phase 0 entries are validated as translatable through the `legacy-workflow-step` runner type so traceability is preserved before execution moves.

### Ownership
`schema/verification/ownership.schema.json` defines path-ownership records. Phase 1 only registers verification/test/docs ownership used by this contract build. It does not guess broad production ownership.

Unknown production ownership is therefore explicitly blocked with evidence code `unmapped-production-ownership`. Phase 2 will implement deterministic change-to-ownership matching and expand governed production mappings.

### Evidence
`schema/verification/evidence.schema.json` defines normalized layer evidence for:

- exact commit SHA;
- owner layer and architecture components;
- trigger reasons;
- selected tests;
- skipped tests and reasons;
- platform/runner;
- result and duration;
- artifact locations;
- whether network, native execution or secrets were used.

The evidence object is closed and does not include story text, prompts, credential values or hidden reasoning.

## Runtime validators
`lib/verification/verification-contracts.mjs` validates the Phase 1 contracts without introducing a new package or remote schema dependency.

`scripts/validate-verification-phase-1.mjs` validates repository configuration and proves every Phase 0 inventory entry can be translated into the typed catalog contract without moving execution.

## Guardrails
- Do not rename or remove PR Gate/Product Gate.
- Do not add seven workflow silos in Phase 1.
- Do not move existing tests into the new catalog yet.
- Do not make Agent output authoritative over selection.
- Do not permit runner `command`, `shell`, `run` or free-form script text.
- Do not infer safe ownership for unknown production files.
- Do not expose secrets or private story material in evidence.
- Preserve exact-head CI behavior already used by the current gates.

## Regression coverage
`tests/issue-1926-verification-schemas.test.mjs` proves:

- seven display names align one-to-one with the seven canonical architecture layer IDs;
- duplicate test IDs are rejected;
- unknown owner layers are rejected;
- invalid runner kinds and shell-like runner targets are rejected;
- all Phase 0 inventory entries are translatable;
- unmapped production ownership fails closed;
- normalized evidence requires an exact 40-character commit SHA and canonical layer ID;
- the JSON schemas are closed draft-2020-12 contracts.

## Acceptance boundary
Phase 1 is complete when the focused validator/test are green under the existing gates. The next issue is Phase 2: shared verification core functions for plan, explain, runLayer, emitEvidence and deterministic ownership/catalog validation. No seven-check cutover happens here.
