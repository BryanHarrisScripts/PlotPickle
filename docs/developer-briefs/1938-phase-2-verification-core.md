# #1938 Phase 2 — Shared Seven-Layer Verification Core

Parent: #1922

## Purpose

Phase 2 turns the Phase 1 schemas and vocabulary into one reusable deterministic verification core. It does not expose the seven shadow PR checks yet and it does not replace `PR Gate` or `Product Gate`.

The core owns planning, explanation, typed layer execution and normalized evidence construction below GitHub Actions so the same logic can later be consumed by CI, local CLI, Full Verification, MCP/API adapters and bounded developer Agents.

## Inputs and authority

Selection comes only from repository-controlled inputs:

1. changed file paths;
2. `config/verification/ownership-map.json`;
3. `config/verification/test-catalog.json`;
4. `config/verification/phase-1-vocabulary.json`;
5. the seven canonical layer IDs in `architecture/plotpickle.architecture.json`.

PR descriptions, issue prose, Agent output and model responses are not selection inputs.

## Core flow

`changed file -> ownership rule(s) -> owner layer(s) + risk tokens -> catalog match -> permission/cost/platform decision -> selected/skipped test -> typed runner -> exact-head evidence`

A file may match more than one governed ownership rule. This is how a single change can affect multiple canonical layers without duplicating architecture taxonomy.

Planning output is sorted and deterministic so the same governed inputs produce the same plan regardless of changed-file argument order.

## Fail-closed behavior

Phase 2 deliberately does not assign broad product folders such as `app/**` or `lib/**` to guessed owners.

Known verification infrastructure is registered to Layer 7. An otherwise unmapped changed file is treated conservatively as production and blocks planning with:

`unmapped-production-ownership`

This exposes architecture debt rather than silently reporting that nothing is impacted.

## Catalog state

Phase 1 intentionally left the live catalog empty. Phase 2 adds only one real entry:

`verification.phase2-core`

It is a fast Layer 7 baseline/impact node test for the shared verification core. Product-layer tests are not migrated in this phase.

Synthetic test fixtures prove multi-layer planning and provider-heavy behavior without prematurely registering production ownership.

## Heavy/native/network/secrets policy

Impact matching alone does not authorize risky execution.

The planner records explicit skips when a selected boundary requires permissions not granted by the caller:

- `heavy-not-authorized`;
- `network-not-authorized`;
- `native-not-authorized`;
- `secrets-not-authorized`;
- `platform-not-selected`.

The existing Product Gate optimization remains unchanged: real Pi and whisper.cpp probes are still manual-only in normal PR runs.

## Shared operations

`lib/verification/verification-core.mjs` provides:

- `planVerification` — deterministic changed-file/risk/catalog planning;
- `explainPlan` — stable Human-readable selection explanation;
- `runLayer` — executes only catalog-selected tests through injected typed runners;
- `emitEvidence` — produces normalized exact-head evidence and validates it against the Phase 1 contract boundary;
- ownership/path helpers and configuration validation.

The core does not spawn processes itself. Execution is adapter-owned.

## Local CLI

`scripts/verification-core.mjs` is the first adapter and supports:

- `plan`;
- `explain`;
- `run-layer <layer-id>`.

Changed files may be supplied explicitly with repeated `--changed-file` arguments or resolved locally from `--base-ref` using `git diff --name-only`.

The CLI uses argument-array process spawning with `shell: false`. It currently registers safe local adapters for `node-test`, `node-script`, `npm-script` and `build`. Other runner kinds remain typed in the catalog but are not silently executed by this local adapter.

Risky execution permissions remain opt-in: `--allow-heavy`, `--allow-network`, `--allow-native`, `--allow-secrets`.

`run-layer` writes normalized evidence to `.artifacts/verification/<layer-id>.json`.

## Evidence

Evidence records include:

- exact 40-character commit SHA;
- canonical layer ID;
- architecture components;
- changed-file and risk-token reasons;
- selected test IDs;
- skipped tests with stable reason codes;
- runtime platform/adapter;
- result and duration;
- artifact paths;
- observed network/native/secrets activity.

Evidence contains no story text, prompts, credentials, private profile data or hidden reasoning.

## Current ownership registration

Phase 2 registers only unambiguous verification infrastructure:

- `.github/workflows/**`;
- `config/development-convergence/**`;
- `config/verification/**`;
- `schema/verification/**`;
- `lib/verification/**`;
- the Phase 1 validator and Phase 2 CLI;
- `tests/**`;
- `docs/**`.

This registration is intentionally narrow.

## Regression coverage

`tests/issue-1938-verification-core.test.mjs` proves:

- glob/path normalization;
- one file affecting multiple canonical layers;
- fail-closed unmapped production;
- cheap mapped docs/verification changes;
- heavy/native/network authorization and explicit skip reasons;
- deterministic output ordering;
- invalid catalog/ownership configuration blocks planning;
- injected typed `runLayer` execution;
- exact-head normalized evidence;
- local CLI exposes plan/explain/run-layer without PR/Agent/model selection inputs.

## CI migration boundary

Phase 2 adds one focused regression step to the existing `PR Gate`. `Product Gate` is unchanged. Both old gates remain the authoritative normal PR checks.

Phase 3 may expose the seven stable architecture checks as non-required shadow jobs only after this shared core is green.
