# Developer Brief — #1922 Seven-Layer Evidence-Driven Verification Mesh

## Status

Architecture/design brief only. This brief does **not** authorize immediate removal of `PR Gate` or `Product Gate` and does not require all existing tests to be moved at once.

Implementation must proceed as a measured migration with current gates retained until the replacement has proven equal or stronger coverage on representative changes.

## Purpose

PlotPickle has outgrown two generic CI checks.

The current `PR Gate` and `Product Gate` are useful, but they have become containers for many unrelated concerns. As PlotPickle continues to add Skins, semantic surfaces, Agents, Skills, plugins, provider runtimes, graphs, harnesses, observers, SDK/API surfaces and developer tooling, continuing to append tests to two serial workflows will increase runtime, duplicate work, hide ownership and make failures less informative.

The replacement should mirror PlotPickle's actual architecture.

The target is an **evidence-driven seven-layer verification mesh** with seven stable PR checks, one per canonical architecture layer, backed by a shared verification core that can also be called from local CLI, Full Verification, MCP, future API/SDK integrations and governed developer Agents.

The design goal is:

**Global · Modular · Flexible · Scalable**

The system should make future growth easier rather than require another CI redesign every time PlotPickle adds a new surface, provider, plugin, Agent or capability.

---

# 1. Evidence that motivates the redesign

## 1.1 PlotPickle already has seven canonical architecture layers

The source of truth is:

`architecture/plotpickle.architecture.json`

The generated architecture SVG is a projection of that source. CI must consume these existing IDs rather than invent a second classification system.

The layers are:

1. `experience-skins` — **Experience Skins**
2. `experience-contract` — **Expanded Experience Layer**
3. `production-harness` — **Governed Production Orchestration**
4. `agent-runtime` — **Agent & Skill Mesh**
5. `story-canon` — **Story, Canon & Evidence Core**
6. `provider-runtime` — **AI / Provider Runtime**
7. `verification` — **Validation & Operations**

The architecture already makes a crucial distinction: Layer 7 is outside the production dependency path. Tests consume product contracts; product runtime does not depend on verification clients.

That rule remains non-negotiable.

## 1.2 The current PR Gate is broad and serial

`.github/workflows/pr-gate.yml` currently combines, in one Ubuntu job:

- CI-topology checks;
- development convergence;
- development run-ledger;
- PlotPickle Score;
- DraftLens Reader Simulation Harness;
- Experience architecture tests;
- Skin/navigation regressions;
- LEARN integrity;
- Pi contract checks;
- Sequence Evidence;
- security closeout;
- OSS attribution/registry;
- architecture documentation;
- local voice contract;
- auth/storage contracts;
- local-video/provider tests;
- production web build.

A failure generally appears as **PR Gate**, even though the failed contract may belong to a very specific architecture layer.

The check tells us that something failed. It does not clearly tell us which part of PlotPickle is unhealthy.

## 1.3 The current Product Gate is expensive for unrelated changes

`.github/workflows/product-gate.yml` currently runs, on every PR:

- Skin V1 startup boundary tests;
- security closeout tests;
- Pi 0.85.1 managed compatibility evaluation;
- local-video validation;
- a real `whisper.cpp` installation/smoke fixture;
- focused UAT contracts;
- Windows production build;
- Windows installer source contract.

This is strong evidence, but not every PR changes those boundaries.

A LEARN metadata change should not require a real speech-to-text native install merely because both changes live in the same repository.

Likewise, a Story/Evidence graph change should not have to pay for provider/native setup unless the change actually crosses that boundary.

## 1.4 Some coverage is duplicated

At least two current examples are obvious:

- security-closeout tests run in both normal gates;
- bundled local-video tests run in both normal gates.

Some duplicate coverage may be intentional platform proof, but the current topology does not state that intent. The result is repeated execution without clear ownership.

The new architecture requires one primary owner for every deterministic test. A cross-layer integration test may have many trigger sources, but it should normally execute once under the layer that owns the observed contract.

## 1.5 #1920 proved that more tests are not automatically better evidence

During review of #1918, the local live WebMCP startup UAT failed on PROFILE readiness even though the normal GitHub gates were green.

The cause was verification drift after #1915:

- the real product had moved to direct `User Profile`;
- Local Story Mode and Node Info had moved to Settings;
- the verifier still depended on the removed `Profile menu` hierarchy.

#1920 repaired that drift and added regression coverage.

The larger lesson is more important:

**A static contract test can be green while the live boundary it is meant to protect is wrong.**

The replacement CI architecture must therefore select the correct *kind* of evidence for the changed boundary.

If a surface, navigation path or WebMCP verifier changes, the impact graph should select live rendered WebMCP evidence.

---

# 2. Architectural objective

Expose seven stable PR checks:

- `Architecture 1 · Experience Skins`
- `Architecture 2 · Experience Contract`
- `Architecture 3 · Production Orchestration`
- `Architecture 4 · Agent & Skill Mesh`
- `Architecture 5 · Story / Canon / Evidence`
- `Architecture 6 · Provider Runtime`
- `Architecture 7 · Validation & Operations`

All seven checks should appear on every PR.

An unaffected layer should run its small baseline and report that no additional impacted evidence was required. It should not disappear through a path-level workflow skip, because branch protection and Human review should see a stable seven-check contract.

The seven checks are **not** seven copies of today's monolithic gate logic.

They are seven architecture owners backed by one shared verification engine.

---

# 3. Layer ownership

## Layer 1 — Experience Skins

Architecture purpose: replaceable presentation for any audience or device.

Primary verification ownership includes:

- Skin adapters and Skin definitions;
- global presentation tokens as consumed by Skins;
- screen/surface visual presentation;
- visual continuity;
- presentation accessibility;
- screenshot/readiness evidence;
- Skin-specific rendering regressions;
- visual observers;
- live WebMCP visual verification when presentation or the verifier changes.

Examples of capability tokens:

`skin`, `surface`, `visual`, `design-token`, `accessibility`, `webmcp`, `screenshot`

Layer 1 must validate that presentation remains replaceable and does not silently acquire product/business authority.

## Layer 2 — Expanded Experience Layer

Architecture purpose: the stable semantic product contract behind every Skin.

Primary verification ownership includes:

- semantic intents;
- results/revisions contract;
- capabilities and reasons;
- typed events;
- lean view models;
- surface registry and topology;
- keyboard/navigation semantics;
- use-case pipeline boundaries;
- persistent selection/workspace context exposed through Experience;
- reconciliation as exposed to the client;
- test-client/public Experience contract.

Examples of capability tokens:

`experience`, `intent`, `surface`, `navigation`, `view-model`, `event`, `routing`, `keyboard`, `webmcp`

Layer 2 is the strongest natural owner for integration tests that prove semantic navigation through rendered surfaces.

A test can be triggered by a Layer 1 Skin change or Layer 7 verifier change while still being *executed* by Layer 2 because it validates the semantic Experience contract.

## Layer 3 — Governed Production Orchestration

Architecture purpose: authority, lifecycle, policy and execution control.

Primary verification ownership includes:

- Human/profile/project authority;
- authentication/session boundaries;
- storage authority;
- policy and consent;
- budgets and bounded capability use;
- lifecycle routing;
- capability authorization;
- provenance/reconciliation orchestration;
- Community adapter authority;
- connector trust;
- egress controls;
- credential boundaries;
- governed recovery.

Examples of capability tokens:

`auth`, `session`, `storage`, `authority`, `policy`, `consent`, `budget`, `connector`, `egress`, `credential`, `community`

Security tests should live in the layer whose authority they protect rather than in one generic security bucket whenever practical.

## Layer 4 — Agent & Skill Mesh

Architecture purpose: specialists collaborate within approved scope.

Primary verification ownership includes:

- canonical Agent registry/roster;
- Agent identity/instructions/Skills contract;
- Agent Skill trust and permission boundaries;
- context shaping;
- harness-owned Agent execution;
- Resident Writer and Guide contracts;
- evidence-learning Agent boundaries;
- UI-continuity/QA Agent contracts;
- Pi/Cline developer-agent contracts where they act as replaceable repository workers;
- Agent Plugin contracts;
- MCP usage by Agents as a bounded tool boundary.

Examples of capability tokens:

`agent`, `skill`, `agent-plugin`, `harness`, `context`, `mcp`, `pi`, `cline`, `developer-agent`

The Agent layer does not own provider implementations. It validates that Agents consume provider/runtime choices through governed interfaces.

## Layer 5 — Story, Canon & Evidence Core

Architecture purpose: deterministic story state, scoped context, durable evidence and PPF canon.

Primary verification ownership includes:

- STORY rules kernel;
- PPF canon;
- explicit Human canon admission;
- Context Engine;
- Story/evidence graph;
- references and candidates;
- revision/provenance evidence;
- evidence review;
- deterministic 24/96 structure;
- durable curriculum/integrity data where it functions as knowledge/evidence rather than UI presentation;
- canon/non-canon separation.

Examples of capability tokens:

`story`, `canon`, `ppf`, `graph`, `evidence`, `revision`, `provenance`, `context`, `24-96`, `curriculum-integrity`

Layer 5 tests should strongly favor deterministic inputs/outputs and evidence hashes where appropriate.

## Layer 6 — AI / Provider Runtime

Architecture purpose: replaceable local/cloud inference and media runtime.

Primary verification ownership includes:

- AI source/provider registry;
- provider adapters;
- provider-selection runtime;
- local model integrations;
- compatible cloud APIs;
- hardware detection;
- ComfyUI;
- local video;
- media providers;
- speech-to-text provider/runtime;
- `whisper.cpp` installation/runtime;
- provider/native dependency smoke tests.

Examples of capability tokens:

`provider`, `local-ai`, `cloud-ai`, `native`, `voice`, `whisper`, `video`, `image`, `comfyui`, `hardware`, `windows`

This is the correct owner for real `whisper.cpp` native smoke.

The important change is **selection**, not deletion: the test remains strong when the relevant boundary changes, but it does not execute for unrelated PRs.

## Layer 7 — Validation & Operations

Architecture purpose: verification clients and release operations outside the production dependency path.

Primary verification ownership includes:

- verification catalog/schema;
- impact graph;
- evidence schema;
- test harnesses;
- development convergence;
- run ledger;
- test-selection correctness;
- architecture documentation drift;
- CI workflow integrity;
- build/release contracts;
- Windows packaging/installer contracts;
- Full Verification orchestration;
- artifacts and diagnostics;
- integration with platform scanners such as CodeQL.

Examples of capability tokens:

`verification`, `ci`, `evidence`, `release`, `build`, `installer`, `artifact`, `architecture`, `security-scanner`

Layer 7 must **not** inherit every test simply because the test runs in CI.

It owns the verification system itself.

---

# 4. Core verification primitives

## 4.1 Architecture Test Catalog

Introduce one machine-readable registry, conceptually:

`config/verification/test-catalog.json`

The exact filename may change if an existing registry is a better canonical owner, but there must be one authoritative catalog.

Each test definition should include:

- `id` — stable verification identity;
- `ownerLayer` — one of the seven canonical architecture layer IDs;
- `components` — architecture components protected;
- `triggers` — capability/risk tokens and/or repository ownership patterns;
- `kind` — approved runner type;
- `targets` — test files/scripts/build target;
- `cost` — `fast`, `medium`, `heavy`;
- `mode` — `baseline`, `impact`, `release`, `scheduled`;
- `platforms` — Linux/Windows/etc.;
- `network` — none/required;
- `native` — none/required;
- `secrets` — none/required;
- `evidence` — expected artifact/report type;
- `timeoutClass`;
- `criticality`;
- `replacementFor` or `supersedes` where legacy tests are migrated.

Prefer typed runner kinds over arbitrary shell fragments.

For example, a catalog entry may say:

- run these Node tests;
- run this repository-owned validator;
- run a production build;
- run browser UAT;
- run an approved native smoke fixture.

The catalog should not become a general-purpose remote shell language.

## 4.2 Architecture Impact Graph

Create deterministic mapping from changed repository evidence to required verification.

Conceptually:

`changed file`
→ `architecture component`
→ `layer(s)`
→ `capability/risk tokens`
→ `test triggers`
→ `selected evidence`

This graph should reuse existing registries wherever possible.

Examples already present in PlotPickle include:

- architecture layer source;
- surface/screen registries;
- plugin registry/API;
- provider/source registry;
- Agent/Skill configuration;
- design tokens;
- Story/evidence structures;
- developer-agent stack.

The CI architecture should connect to canonical registries rather than create duplicate lists of product concepts.

### Unknown-file policy

Unknown production files fail closed.

A new production code file with no architecture ownership must never result in `nothing impacted`.

The planner should either:

1. conservatively select broader verification; and/or
2. block with `architecture ownership missing` when the file should have an explicit owner.

Docs-only or generated-document changes can have lower-cost rules where authority is known.

## 4.3 Capability / risk tokens

Use stable tokens as a vocabulary connecting registries, changes and evidence.

Example tokens:

- `surface`
- `skin`
- `navigation`
- `visual`
- `design-token`
- `auth`
- `storage`
- `authority`
- `canon`
- `graph`
- `evidence`
- `agent`
- `skill`
- `plugin`
- `provider`
- `native`
- `voice`
- `video`
- `windows`
- `mcp`
- `api`
- `cli`
- `release`
- `security`

These are architecture labels, not blockchain/crypto tokens.

Tokens provide a scalable way to express that a new component affects an existing class of risk without adding more special-case YAML.

## 4.4 Evidence Graph

Each architecture check emits structured evidence.

Minimum evidence should include:

- schema version;
- exact head SHA;
- base/merge-base SHA;
- layer ID;
- impacted architecture components;
- changed files that caused selection;
- capability/risk tokens;
- selected test IDs;
- baseline tests executed;
- heavy tests selected/not selected and reason;
- platform/runtime;
- pass/fail/blocked;
- duration by test;
- artifact names/locations;
- network/native activity;
- architecture ownership warnings;
- stale/obsolete test warnings.

Conceptually:

`commit`
→ `component`
→ `risk token`
→ `test`
→ `result`
→ `artifact/evidence`

This graph becomes useful far beyond GitHub Actions.

It can power:

- local developer explanation;
- CI diagnostics;
- architecture documentation;
- test optimization;
- flake analysis;
- release evidence;
- future Agent-assisted repair;
- MCP/API/CLI inspection.

---

# 5. One verification core, many adapters

GitHub Actions should not contain the product logic for deciding what PlotPickle architecture means.

Create a repository-owned verification core, conceptually:

`lib/verification-core/`

or another existing verification home if that better fits current structure.

The core should expose functions equivalent to:

- `plan(changes, mode)`
- `explain(plan)`
- `runLayer(layerId, plan)`
- `emitEvidence(result)`
- `validateCatalog()`
- `validateOwnership()`

Adapters can then be thin:

- GitHub Actions adapter;
- local CLI adapter;
- Full Verification adapter;
- developer MCP adapter;
- future HTTP/API adapter;
- SDK adapter;
- governed Pi/Cline integration.

Conceptually:

`verification core`
→ `GitHub`
→ `CLI`
→ `MCP`
→ `API/SDK`

The same plan must mean the same thing regardless of caller.

---

# 6. GitHub Actions shape

Prefer one architecture workflow that exposes seven independent named jobs rather than seven independently maintained workflow implementations.

Possible structure:

`architecture-verification.yml`

with seven stable jobs calling a shared repository action/runner.

Each job should:

1. checkout the exact PR head;
2. determine merge-base/change evidence;
3. call the verification core for its layer;
4. run baseline tests;
5. run impact-selected evidence for that layer;
6. emit normalized evidence artifact;
7. fail on required evidence failure;
8. succeed with explicit `baseline only / layer not impacted` when appropriate.

Do not use top-level path filters that cause required checks to disappear.

## Setup-cost rule

Do not automatically run `npm ci`, install Chromium, download native tools or prepare provider runtimes in all seven jobs.

The selected runner should declare what setup it needs.

A baseline schema check may require only Node from the runner image.

A browser UAT may require the pinned isolated browser toolchain.

A native provider smoke may require Windows and a native download.

This is central to keeping seven checks faster than two monoliths.

---

# 7. Cost model

## Fast baseline — every PR

Expected to be deterministic, cheap and network-free where possible.

Examples:

- schema validation;
- architecture ownership validation;
- registry integrity;
- critical static authority contracts;
- focused deterministic unit tests;
- test-catalog validation;
- evidence-schema validation;
- cheap security boundary tests;
- changed-file classification.

## Impact-selected runtime evidence

Run only when the architecture graph selects it.

Examples:

- live WebMCP/Playwright rendered UAT;
- Windows-specific runtime proof;
- provider integration;
- native executable smoke;
- local media runtime;
- hardware-sensitive checks;
- expensive Agent/provider integration.

## Release / scheduled / Full Verification

Broad acceptance remains valuable, but does not need to be paid on every unrelated PR.

Examples:

- packaged application UAT;
- complete installer execution;
- broad provider compatibility matrix;
- all-native-dependency smoke;
- long-duration acceptance suites;
- full cross-product visual sweep;
- release artifact verification.

---

# 8. Immediate test-placement recommendations

## 8.1 whisper.cpp

Two levels of verification should exist.

### Fast contract

The existing voice contract remains cheap and can run when voice interfaces or architecture are impacted.

### Real native smoke

`scripts/install-whisper-cpp.ps1 -Mode Smoke -Approved`

should run when one or more of these boundaries changes:

- whisper install script/runtime;
- voice native/provider manifest;
- speech-to-text bridge requiring native execution;
- Windows packaging that includes/affects whisper;
- explicit release/Full Verification.

It should **not** run for unrelated LEARN, story, documentation, Agent-only or non-voice provider changes.

This keeps confidence without converting every PR into a native installer test.

## 8.2 Pi managed compatibility

Keep a cheap Agent/developer-tool contract where appropriate.

Run the real managed compatibility/upgrade evaluation when:

- Pi managed installer changes;
- Pi integration/config changes;
- developer Agent stack changes;
- related MCP/process spawn boundaries change;
- release/Full Verification requests broad proof.

## 8.3 local video / ComfyUI / media providers

Keep registry and deterministic configuration tests cheap.

Run runtime/media/native smoke when:

- provider registry changes;
- local-video plugin changes;
- workflow/model packaging changes;
- hardware/provider bridge changes;
- release/full verification requires it.

## 8.4 live WebMCP

Select live rendered WebMCP evidence when changes touch:

- Skin/surface presentation;
- surface registry/topology;
- semantic navigation;
- Profile/Settings/Dashboard routing;
- visual readiness selectors;
- WebMCP audit implementation;
- visual baseline manifest/locking mechanics.

This is a direct regression rule derived from #1920.

## 8.5 Windows build and installer

Windows proof remains important, but distinguish:

- portable web build;
- Windows-sensitive application/runtime change;
- installer source contract;
- packaged installer execution.

A documentation-only change should not require packaged installer proof.

A change to Windows paths, native runtime, packaging or installer definitely should.

---

# 9. Plugins and extensions

PlotPickle already has plugin manifests, permissions, capabilities and registry types. The verification architecture should follow the same philosophy.

A future plugin may contribute verification metadata, but only through a governed host contract.

A plugin must not be able to:

- grant itself permissions;
- change required host tests;
- suppress host verification;
- mark itself trusted through its own test result;
- execute arbitrary CI commands solely because a manifest contains text.

Plugin verification contributions should use approved runner kinds and explicit host validation.

A new plugin should normally add:

- its manifest/capability declaration;
- architecture/risk tokens;
- its owned tests;
- integration evidence where required.

It should not require editing seven workflow files.

---

# 10. Agents, Skills and Harnesses

Agent verification follows the existing authority principle:

`Agent = identity + instructions + Skills + permitted context + provider/runtime`

Verification should distinguish:

- deterministic Agent registration/trust contracts;
- deterministic Skill registration/trust contracts;
- harness behavior;
- provider/runtime behavior;
- creative/evaluative output quality.

An Agent may consume verification evidence and propose a repair.

It must not become final verification authority.

A repair Agent must not:

- modify the test that judges its own change and then self-certify it;
- weaken policy to make a failing repair pass;
- merge itself to `main` without the normal Human/CI authority path.

This keeps Agents useful while preserving evidence independence.

---

# 11. Observers and surfaces

Observers are evidence producers.

Examples include:

- WebMCP rendered observer;
- visual observer;
- accessibility observer;
- runtime diagnostic collector;
- release/package inspector.

Observers should be:

- read-only by default;
- privacy-safe;
- deterministic where possible;
- explicit about the surface/contract observed;
- versioned;
- capable of emitting normalized evidence.

Surface verification should prefer semantic identities and canonical registries rather than brittle historical selectors.

If a surface is renamed or moved, the ownership registry and focused regression should make that drift visible immediately.

---

# 12. Graphs and durable evidence

PlotPickle already thinks in graphs: Story/evidence relationships, architecture flow, surface topology and dependency relationships.

CI should use graph thinking too.

There are two separate graphs:

## Product architecture graph

What depends on what?

`Skin -> Experience -> Production Harness -> Agent -> Story/Canon -> Provider`

with Community and other adapters crossing governed boundaries.

## Verification evidence graph

What change required what proof?

`commit -> changed file -> component -> layer -> risk -> test -> result -> artifact`

Do not merge these into one undifferentiated graph.

Verification reads product architecture; product runtime does not depend on verification.

---

# 13. Security architecture

The verification mesh must improve security while reducing unnecessary runtime.

Required rules:

- default GitHub permissions remain least privilege (`contents: read` unless explicitly justified);
- untrusted/fork PRs do not receive secrets;
- provider/network calls are explicit;
- no silent cloud fallback in tests;
- native downloads are pinned/versioned and preferably checksum verified;
- third-party Actions remain pinned to approved major/commit policy;
- output artifacts contain no credentials;
- visual/UAT artifacts contain no private story text unless explicitly approved and isolated;
- hidden reasoning/prompts are never evidence artifacts;
- test selection derives from repository state, not PR prose or Agent recommendation;
- architecture/test catalog changes receive Layer 7 protection;
- deleting or downgrading a critical test requires explicit review evidence;
- unknown production ownership fails closed;
- CodeQL and other platform security scanners may remain specialized external checks while their results are referenced by the verification evidence model.

Security is cross-cutting, but execution ownership remains architectural.

---

# 14. Stale-test and duplicate-test policy

The migration is an opportunity to remove test debt safely.

Do not delete a test because it is old.

For every candidate stale test, classify it:

1. **still protects current authority** — keep and assign owner;
2. **protects valid behavior but references legacy structure** — rewrite against current authority;
3. **duplicate evidence** — retain one owner and remove duplicate execution after equivalence proof;
4. **historical regression no longer possible because architecture was removed** — retire with recorded rationale;
5. **release-only / scheduled** — move out of normal PR cost;
6. **source-text proxy for a runtime boundary** — replace or supplement with the correct runtime evidence.

This classification is part of Phase 0 and should be recorded, not inferred later.

---

# 15. Migration plan

## Phase 0 — inventory and measurement only

No required-check behavior changes.

Deliverables:

- inventory every test/script executed by normal PR Gate and Product Gate;
- include relevant visual/security workflows that overlap normal PR concerns;
- record owner candidate;
- record runtime duration where available;
- record platform;
- record network/native requirements;
- identify duplicate execution;
- identify stale assumptions;
- identify tests that validate source strings instead of the live boundary;
- identify release-only candidates.

Output should be machine-readable plus a Human-readable report.

## Phase 1 — schemas and catalog

Add:

- test-catalog schema;
- architecture ownership schema;
- capability/risk token vocabulary;
- evidence schema;
- validators that confirm the seven owner IDs exist in the architecture source.

No test movement yet.

## Phase 2 — verification core

Implement deterministic:

- change collection;
- impact mapping;
- layer planning;
- test selection;
- explanation;
- evidence emission;
- local CLI interface.

Keep current gates authoritative.

## Phase 3 — seven shadow checks

Expose all seven architecture checks but do not immediately make them the only required checks.

Run them beside current gates.

Measure:

- coverage agreement;
- total wall time;
- unnecessary selections;
- missed selections;
- platform cost;
- flake rate;
- evidence clarity.

## Phase 4 — tidy and de-duplicate

Use the inventory and shadow evidence to:

- remove duplicate execution;
- rewrite stale regressions;
- retire obsolete tests with rationale;
- move release-only tests;
- classify native/provider/browser tests as impact-selected.

Do this incrementally, one layer at a time.

## Phase 5 — strengthen runtime evidence

Ensure tests protecting runtime boundaries actually observe those boundaries.

Priority lessons:

- live WebMCP for surface/verifier changes;
- native provider smoke for provider/native changes;
- MCP/process-spawn runtime proof for MCP/spawn changes;
- packaging execution where packaging changes.

## Phase 6 — promote seven checks

After enough shadow evidence:

- make the seven architecture checks required;
- leave old PR/Product gates temporarily advisory;
- require exact-head evidence for merge.

## Phase 7 — retire the monoliths

Only after representative equivalence is proven:

- remove normal `PR Gate` / `Product Gate` as required monoliths;
- retain Full Verification/release paths for intentionally broad acceptance;
- update `architecture/plotpickle.architecture.json` Layer 7 to describe the implemented seven-layer verification mesh;
- regenerate architecture projections/documentation;
- lock regression coverage protecting the new verification topology.

---

# 16. Representative change classes to prove before cutover

The shadow period should include or simulate at least these classes:

- documentation-only;
- LEARN/curriculum data;
- Skin CSS/token change;
- semantic navigation/surface change;
- auth/session change;
- Story/canon/PPF change;
- Story/evidence graph change;
- Agent/Skill registration change;
- Pi/Cline developer-agent change;
- plugin manifest/platform change;
- provider registry change;
- whisper/native voice change;
- ComfyUI/local-video change;
- MCP/process-spawn change;
- Windows packaging/installer change;
- verification-core/catalog change.

For each, record:

- expected layers impacted;
- expected tests selected;
- heavy tests selected/not selected;
- old-gate result;
- new-gate result;
- wall-clock comparison.

---

# 17. Success metrics

The redesign should be evaluated by evidence, not aesthetic preference.

Useful metrics:

- median PR validation wall time;
- p95 validation wall time;
- total runner-minutes per PR;
- percent of heavy tests selected for relevant changes;
- percent of heavy tests avoided for unrelated changes;
- duplicate test executions removed;
- unmapped production files;
- stale-test count;
- flaky test rate;
- runtime-boundary regressions caught;
- number of architecture components without owned verification;
- time-to-diagnosis from failed check name/evidence;
- consistency between local CLI and GitHub selection plans.

Faster is good only if confidence remains equal or improves.

---

# 18. Non-goals

This issue does not aim to:

- reduce coverage merely to make CI green faster;
- delete Windows verification;
- delete native/provider smoke tests;
- eliminate Full Verification;
- replace CodeQL;
- move product logic into CI;
- let Agents decide what security tests to skip;
- create seven unrelated workflow silos;
- add a second architecture taxonomy;
- make every plugin capable of arbitrary CI execution;
- hide skipped evidence;
- silently trust unmapped files;
- run every provider against every PR.

---

# 19. Acceptance criteria

1. The seven canonical architecture layer IDs remain the sole product-layer taxonomy for normal PR verification.
2. A complete current-test inventory exists before required-gate migration begins.
3. Every cataloged test has one primary owner layer or an explicit retirement/release classification.
4. Duplicate expensive execution is removed only after replacement/equivalent evidence is demonstrated.
5. Seven stable PR checks remain visible on every PR.
6. Unaffected layers run a cheap baseline rather than disappearing.
7. Changed-file impact selection is deterministic and explainable.
8. Unknown production files fail closed.
9. Every layer emits normalized exact-head evidence.
10. Heavy tests run when relevant and remain available to release/full verification.
11. Real `whisper.cpp` native smoke is no longer universal for unrelated PRs.
12. Real Pi managed compatibility is no longer universal for unrelated PRs.
13. Live WebMCP is selected for the surface/navigation/verifier change class exposed by #1920.
14. Plugins, Agents, Skills, Harnesses, observers, surfaces and providers participate through stable registries/contracts rather than workflow sprawl.
15. Test selection and execution can be invoked through one core from GitHub Actions and local CLI.
16. The architecture permits future MCP/API/SDK adapters without duplicating selection logic.
17. Verification remains outside the product runtime dependency path.
18. Security authority remains deterministic and host-owned.
19. Old gates stay in place during shadow comparison.
20. Old gates are retired only after seven-layer equivalence or stronger evidence is demonstrated across representative change classes.
21. Architecture Layer 7 documentation is updated only after the new topology is actually implemented.
22. Convergence and exact-head merge discipline remain intact throughout migration.

---

# 20. Implementation principle

The most important rule for the entire effort is:

> **Register architecture and evidence; do not grow workflow conditionals.**

A new Skin, Agent, Skill, plugin, provider, surface, graph node, observer or extension should normally contribute metadata and owned verification through a stable contract.

The GitHub workflows should remain thin orchestration around that contract.

That is what makes the verification architecture capable of growing with PlotPickle rather than becoming another system that eventually needs to be rewritten.