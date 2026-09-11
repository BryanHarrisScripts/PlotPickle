# Developer Brief — #1909 README UPDATES Living Architecture

## Purpose

Add one first-class `## UPDATES` section to the root `README.md` that shows PlotPickle's current living-architecture status and links to five supporting views:

1. Architecture Knowledge Map
2. Architecture Documentation
3. Documentation Drift Detection
4. Agent Context
5. C4 Diagrams

README contains the current entry only. Prior current entries are preserved under repository history so the README does not become a changelog.

This is a repository/documentation capability only. It adds no PlotPickle app screen, Dashboard card, Settings entry, navigation key, runtime service or second architecture authority.

## Design origin and decision

The discussion began by reviewing `sopaco/deepwiki-rs` / Litho and its evolution toward Terrain. The useful pattern was not the external runtime itself, but the repository knowledge layer around it:

- current architecture documentation;
- documentation freshness/drift awareness;
- compact repository context for agents;
- C4-style views;
- historical architecture status that remains inspectable.

PlotPickle should adopt those useful ideas natively. It should not install Terrain/Litho as a required authority, daemon, Docker/WSL dependency or second development system.

The essential product decision is:

`one canonical PlotPickle architecture source -> multiple generated/validated views -> one compact README current update`

## Existing owner to reuse

The current architecture owner already exists:

- `architecture/plotpickle.architecture.json` — canonical machine-readable Architecture Knowledge Map;
- `architecture/plotpickle.architecture.schema.json` — map schema;
- `architecture/generate-architecture.mjs` — existing generator/check owner;
- `architecture/architecture-skin.css` — architecture presentation skin;
- `architecture/plotpickle-architecture.svg` — full blueprint;
- `architecture/plotpickle-architecture-overview.svg` — compact README blueprint;
- existing managed README `ARCHITECTURE` block;
- `node architecture/generate-architecture.mjs --check` and its focused regression.

Issue #1909 composes this owner. It does not replace it and does not introduce another architecture JSON/database.

## Authority boundaries

The living-architecture capability is evidence/documentation, not authority.

- `AGENTS.md` remains the repository development constitution.
- Repository source and canonical contracts remain implementation truth.
- `architecture/plotpickle.architecture.json` remains the architecture map.
- GitHub Issues remain the Human-visible work tracker.
- Developer briefs preserve non-trivial design contracts.
- Convergence, PR Gate and Product Gate remain merge evidence/verification.
- PPF remains story/canon authority.
- Generated architecture documents grant no permissions.

## README UPDATES contract

Add stable markers:

`<!-- PLOTPICKLE:UPDATES:START -->`

`<!-- PLOTPICKLE:UPDATES:END -->`

The managed section must show exactly one current update and include:

- architecture version/status/date and deterministic source fingerprint;
- documentation freshness/drift summary;
- Agent Context freshness status;
- C4 freshness status;
- concise current architecture/migration summary;
- links to the five supporting views;
- link to archived history.

`ARCHITECTURE` answers what PlotPickle's architecture is. `UPDATES` answers what the current architecture/documentation state is and where to inspect the live evidence. Both sections remain.

## Current linked views

### Architecture Knowledge Map

Canonical source remains:

`architecture/plotpickle.architecture.json`

No second architecture map is introduced.

### Architecture Documentation

Reuse the existing Human-readable owner:

`architecture/README.md`

and the existing full/overview SVG projections. Human-authored architecture prose is not silently rewritten by drift detection.

### Documentation Drift Detection

Generate:

`docs/updates/documentation-drift.md`

V1 statuses are:

- `CURRENT` — deterministic evidence matches the declared source;
- `STALE` — governed source/output changed underneath the committed projection;
- `MISSING` — a required owner/output is absent;
- `CONFLICT` — deterministic evidence proves malformed/contradictory managed state;
- `REVIEW` — semantic correctness cannot be established deterministically and Human review remains appropriate.

Detection and modification stay separate. `REVIEW` is advisory. Only deterministic stale/missing/conflict conditions block the architecture check.

Deterministic evidence includes:

- source fingerprints;
- generated-file equality;
- existing architecture generator `--check` result;
- managed-block marker integrity;
- expected generated projections;
- required-path existence;
- archive identity validation.

### Agent Context

Generate a compact repository-aware context at:

`docs/architecture/agent-context.md`

It contains architecture layers, durable authority boundaries and exact evidence pointers. It explicitly remains subordinate to `AGENTS.md` and canonical repository files. It contains no project story material and grants no authority.

The purpose is to reduce repeated rediscovery by Pi, Cline, connected GitHub/ChatGPT tooling, BEN or future bounded developer agents without turning the generated context into another constitution.

### C4 diagrams

Generate:

`architecture/plotpickle-c4.md`

The document contains System Context, Container and Component views derived from the same architecture JSON. The C4 projection is generated and carries the same architecture fingerprint; it is not a second hand-maintained model.

## Generator ownership

Keep the existing `architecture/generate-architecture.mjs` unchanged as the owner of the existing full SVG, overview SVG and README ARCHITECTURE block.

Add an architecture-owned companion:

`architecture/generate-living-architecture.mjs`

This is composition, not a competing generator. It always reads the existing canonical JSON and, on explicit refresh, invokes the existing generator first so the original architecture outputs remain synchronized.

Modes:

`node architecture/generate-living-architecture.mjs --refresh-update`

- runs the existing architecture generator;
- computes deterministic source fingerprint;
- regenerates Agent Context and C4 projection;
- creates deterministic drift evidence;
- archives the previous README UPDATES block only when the current entry changes;
- writes the new README current entry and history index.

`node architecture/generate-living-architecture.mjs --check`

- recomputes expected projections;
- verifies the existing architecture generator check;
- verifies Agent Context, C4, drift report, README managed block and history index;
- validates archive identity;
- never creates or rewrites archive history.

No default write mode exists; mutation requires the explicit `--refresh-update` flag.

## Fingerprint contract

The architecture fingerprint is SHA-256 over the parsed canonical architecture object serialized deterministically with `JSON.stringify`.

The fingerprint appears in:

- README current UPDATES block;
- Agent Context;
- Documentation Drift Detection;
- C4 projection.

This lets generated projections detect source changes without requiring a self-referential final commit SHA.

## Archive contract

Repository history lives under:

`docs/updates/archive/YYYY-MM-DD-<stable-id>.md`

The filename is deterministic from the prior managed update block bytes. Re-archiving an unchanged block returns the existing identity without duplicating history. An identity collision with different content is an error.

Normal `--check` never writes archive files.

The navigation index is:

`docs/updates/README.md`

It points only to historical entries. Root README remains the only current Human-facing UPDATES surface.

For the first #1909 update there is no prior managed UPDATES entry, so the archive starts empty and the history index states that no archived entry exists yet.

## External-tool and OSS boundary

The implementation is independent PlotPickle code using Node built-ins and existing repository architecture evidence. No Terrain/Litho/deepwiki-rs source code is copied or adapted, so #1909 does not add a runtime dependency or require an OSS-registry change for copied code.

The external project remains reference methodology only.

## Windows/dependency boundary

The implementation uses Node built-ins already required by PlotPickle:

- `fs` / `path`;
- `crypto`;
- `child_process` for invoking the canonical architecture generator/check.

No Rust binary, WSL, Docker, background daemon, external database or new npm dependency is required.

## Non-goals

- no app UPDATES screen;
- no Dashboard card;
- no Settings entry;
- no new navigation key;
- no second architecture JSON/database;
- no replacement for existing ARCHITECTURE block or SVGs;
- no replacement for `AGENTS.md`;
- no replacement for Pi, Cline, Mastra, BEN, GitHub Issues, convergence or CI gates;
- no automatic Human-document rewrite from semantic opinion;
- no agent permission expansion;
- no PPF/story/canon change;
- no README historical changelog;
- no archive mutation in check mode.

## Focused regression contract

`tests/issue-1909-living-architecture.test.mjs` must prove:

- one canonical Architecture Knowledge Map remains;
- exactly one README current UPDATES managed block exists;
- all five view links are present;
- source fingerprint/current entry generation is deterministic;
- UPDATES insertion preserves the existing ARCHITECTURE managed owner;
- `CURRENT`, `STALE`, `MISSING`, `CONFLICT`, `REVIEW` are machine-testable;
- Agent Context is compact, generated, `AGENTS.md`-subordinate and free of obvious secret material;
- System Context / Container / Component C4 views derive from the current architecture map;
- unchanged archive writes do not duplicate history;
- changed entries receive distinct stable archive identities;
- check mode does not mutate archive bytes;
- existing architecture generator/check remains synchronized.

PR Gate runs these regressions together with the existing architecture blueprint generator test.

## Acceptance mapping

1. README gets one managed current UPDATES section.
2. No product UI surface is added.
3. `architecture/plotpickle.architecture.json` remains the single Architecture Knowledge Map.
4. README current entry links to map, docs, drift, Agent Context and C4.
5. Replacement archives the previous entry under deterministic history identity.
6. Check mode never rewrites old archive entries.
7. Drift supports all five required statuses without automatic Human-doc repair.
8. Agent Context is compact and subordinate to `AGENTS.md`.
9. C4 projections derive from the same architecture object/fingerprint.
10. Existing ARCHITECTURE generator/output stays independently synchronized.
11. Focused regression covers managed block, archive, drift, context and C4.
12. This brief preserves the complete design discussion and boundaries.
13. `config/development-convergence/1909.json` must report converged evidence before merge.
14. PR Gate and Windows Product Gate must be green on the exact final head before merge.

## Completion definition

#1909 is complete when PlotPickle has one README-visible current architecture/documentation update, generated living evidence underneath it, deterministic freshness checks, compact agent context, C4 projections and preserved historical update entries — all built from the existing architecture owner with no competing authority or app surface.
