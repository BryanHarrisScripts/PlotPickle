# Issue #2016 — Settings UX consolidation

#2016 is the single implementation authority for the Human-facing review of DATA, DEPLOY, REPOS and AUTH.

The goal is not to preserve those four taxonomy bins. The goal is to recover a coherent Settings experience built around Human jobs, using the established pre-taxonomy Settings surfaces as the UX/design authority and the newer architecture only as an implementation layer behind them.

## Review-state rule

- Yellow means active, openable and ready for Human testing.
- Yellow never means disabled.
- Gray means unavailable, unwired or not yet testable.
- Green means Human-reviewed, accepted and production-ready.
- Yellow belongs on the Settings navigation marker, not repeated across the interior surface.
- Promotion is yellow → implementation → focused tests → visible Human UAT → accepted → green.

## Design authority

The last task-oriented Settings design immediately before the eight-bin taxonomy was introduced on July 31, 2026 is the reference UX. Its implementation was preserved as `app/settings-panel-legacy.tsx` when the taxonomy shell was added.

That surface grouped Settings by Human task:

- Workspace: General, Appearance / Accessibility, Project Defaults.
- Integrations: Story & Art, Repository & Collab, Scheduling & Meetings, Media & Film Engines.
- Data Storage: Storage & Backups.
- Security: Privacy & Permissions, About & Licensing.

The newer taxonomy introduced Local, Cloud, Data, Deploy, Repos, Auth, Agents and Open Source as organizational bins. Those bins are evidence, not product truth. A bin does not earn a permanent Human-facing menu entry merely because the architecture contains it.

When a generic taxonomy/reference surface conflicts with an earlier task-specific Settings surface, reuse the earlier surface hierarchy, spacing, typography, keyboard model, status language and working controls unless a concrete Human-facing improvement justifies a change.

## Phase 1 — evidence and Human-job mapping

### DATA

Current taxonomy rows:

1. `PPF Projects & Backups`
   - Existing Human job: keep projects safe, know where they live, recover them.
   - Prior surface authority: `Storage & Backups`.
   - Working recommendation: retain as `Project Files & Backups` or a broader `Project Data & Recovery` area.

2. `Databases & Migrations`
   - Existing Human job: none in normal operation beyond knowing data is current/healthy.
   - Ordinary UI: simple status such as `Data format: Current` or `Needs attention`.
   - Technical database/schema/migration details: Advanced Data Diagnostics only.

3. `Retrieval & Embeddings`
   - Existing Human job: find scenes, characters, notes and story information quickly.
   - Ordinary UI: `Project Search`.
   - Embeddings, vectors, Chroma, retrieval pipelines and executor/index internals: Advanced Data Diagnostics only.

4. `Asset Cache`
   - Existing Human job: understand/remove replaceable temporary working data without risking owned project content.
   - Ordinary UI: `Media & Preview Cache`.
   - Canonical project assets must never be presented as disposable cache.

Phase 1 disposition: DATA contains a real Human job and is likely to survive, but under task language rather than storage-engine language.

### DEPLOY

Current taxonomy rows:

1. `Build Runtime`
   - Current content: build compatibility, Vite/runtime boundaries, streaming/schema implementation details.
   - Human job in ordinary PlotPickle use: none identified.
   - Disposition candidate: Advanced / Diagnostics / About & Updates, not ordinary Settings.

2. `Cloudflare & Edge`
   - Current content: worker bindings and edge-hosting targets.
   - Human job: only meaningful if PlotPickle exposes an explicit supported hosting/deployment workflow the Human chooses to operate.
   - Current status: architecture/planning material rather than an ordinary configuration task.
   - Disposition candidate: Advanced / Developer diagnostics until a real publish/host product flow exists.

3. `Publishing Pipelines`
   - Current content: hosted builds, worker environments and release packages.
   - Human job: no ordinary product action currently identified.
   - Disposition candidate: Advanced / Developer diagnostics.

Prior-surface evidence: no equivalent Human-facing DEPLOY destination existed immediately before the eight-bin taxonomy.

Phase 1 disposition: DEPLOY is not currently justified as a top-level Human Settings destination. Keep it yellow and openable during review, but treat removal/consolidation as the leading hypothesis.

### REPOS

Current taxonomy rows:

1. `GitHub Story Repository`
   - Existing Human job: optional project history, proposals, permissions, collaboration and multi-machine recovery.
   - Prior surface authority: `Repository & Collab`.
   - Existing product boundary: Settings owns connection/recovery; formal story proposals and owner decisions belong in Collab.
   - Disposition candidate: return to a Human task such as Project History & Sync / Repository & Collab, or live within the already-established Cloud Story Mode connection flow. Do not duplicate GitHub setup across REPOS and AUTH.

2. `PlotPickle Code Repository`
   - Human job in ordinary Settings: none.
   - Purpose: product source/release/native-package reference and support diagnostics.
   - Disposition candidate: About / Updates / Advanced Diagnostics.

3. `Afterglow Repository`
   - Evidence: the original Afterglow example is protected/read-only; `Make My Own Copy` creates an editable local project without turning the original repository into a working-project destination.
   - Human job: access/recover the pristine example and create an editable personal copy without overwriting user work.
   - Disposition candidate: Project Data & Recovery / example-project recovery, not a generic REPOS bin.
   - Guardrail: never overwrite or erase a Human-modified copy when restoring/reopening the canonical example.

4. `MCP Server Definitions`
   - Human job: configure/inspect agent tool connectivity only when the Human deliberately works with MCP.
   - Disposition candidate: Agents → Tools & MCP → Advanced, not ordinary repository management.

Prior-surface evidence: GitHub was previously a coherent `Repository & Collab` task surface. PlotPickle code repo, Afterglow repo and MCP definitions were not separate ordinary Settings destinations.

Phase 1 disposition: REPOS is an architecture bucket containing several unrelated Human jobs. It is unlikely to survive as a permanent top-level menu.

### AUTH

Current taxonomy rows:

1. `Google Account`
   - Existing Human job: connect Calendar/Meet permissions.
   - Prior surface authority: `Scheduling & Meetings`.

2. `GitHub Authorization`
   - Existing Human job: authorize the same GitHub project-history/collaboration connection represented in REPOS.
   - Prior surface authority: `Repository & Collab`.
   - Duplication finding: GitHub connection and GitHub repository purpose are currently split across AUTH and REPOS.

3. `OpenAI Credentials`
   - Existing Human job: connect a chosen cloud AI provider.
   - Prior surface authority: `Story & Art`; current product authority may now be Cloud Story Mode.
   - Should follow the provider/task surface rather than force the Human to understand credential architecture separately.

4. `Credential Vault`
   - Existing Human job: understand/remove locally stored credentials and their protection state.
   - Prior surface authority: `Privacy & Permissions`.
   - Technical OS encryption detail may remain available when useful, but the ordinary job is account/key safety.

Phase 1 disposition: the functions are real, but `AUTH` is largely a cross-cutting technical category that splits account setup away from the task where the account is used. Keep it yellow and active while reviewing whether a consolidated `Accounts & Connections` destination genuinely improves clarity or whether authorization should stay inside each task-specific surface.

## Phase 1 cross-menu findings

1. The current four-bin model duplicates concepts instead of grouping complete Human jobs.
2. DEPLOY is almost entirely implementation/developer material.
3. REPOS combines four unrelated concerns: user project history, PlotPickle source, example recovery and MCP tool definitions.
4. AUTH contains real controls, but several are the authorization half of jobs already represented elsewhere.
5. The pre-taxonomy design was stronger when it kept configuration with its purpose: Repository & Collab, Scheduling & Meetings, Story & Art, Storage & Backups, Privacy & Permissions.
6. The preserved legacy component gives us a real implementation/design reference rather than requiring a visual redesign from scratch.

## Working consolidation hypotheses

Do not lock the final menu yet. Phase 1 supports testing these candidate outcomes:

### Candidate A — two Human destinations

- `Project Data & Recovery`
  - project files/backups;
  - project search;
  - media/preview cache;
  - example-project recovery;
  - advanced data diagnostics.

- `Accounts & Connections`
  - account connection overview;
  - Google authorization;
  - GitHub authorization;
  - provider credentials;
  - credential safety/removal.

GitHub project workflow remains in Cloud Story Mode / Repository & Collab, Agents owns MCP, and deployment/runtime/source machinery moves to Advanced Diagnostics.

### Candidate B — one Human destination plus task-local connections

- Keep `Project Data & Recovery` as the only survivor of DATA/DEPLOY/REPOS/AUTH.
- Put Google/GitHub/provider authorization directly inside the task surface that uses it.
- Keep credential safety under Privacy & Permissions.
- Move all deployment/runtime/source/MCP internals to Advanced Diagnostics or their owning product areas.

This is closer to the pre-taxonomy design principle: configure the connection where the Human uses it.

### Candidate C — retain an Accounts surface

- `Project Data & Recovery` survives.
- `Accounts & Connections` survives only if Human testing proves that a single account/key overview materially improves discoverability without duplicating Cloud Story Mode, Repository & Collab and Scheduling & Meetings.

Phase 1 currently favors Candidate B or C over preserving four separate top-level bins.

## Next implementation phases

Phase 2 — DATA / Project Data & Recovery.

Phase 3 — DEPLOY disposition. Do not build ordinary DEPLOY controls unless Phase 1 evidence identifies a real Human job.

Phase 4 — REPOS relocation/consolidation.

Phase 5 — AUTH/account-connection disposition.

Phase 6 — whole-Settings consolidation and duplicate removal.

Phase 7 — focused tests, exact-head Architecture Verification, visible Human UAT and one-at-a-time yellow → green promotion.

## Guardrails

- Preserve existing working functionality while changing information architecture.
- Do not invent capabilities simply to fill a menu.
- No functionality may become unreachable because a taxonomy label disappears.
- Keep ordinary language Human/job-oriented.
- Keep vendor/framework/runtime terminology behind Advanced / Diagnostics unless the Human deliberately chooses that technology.
- Reuse established pre-taxonomy surfaces before designing new generic ones.
- Keep DATA, DEPLOY, REPOS and AUTH yellow and openable until their final disposition is Human-approved.

Authority: https://github.com/BryanHarrisScripts/PlotPickle/issues/2016
