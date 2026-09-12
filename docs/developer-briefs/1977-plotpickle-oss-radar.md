# Developer Brief — #1977 PlotPickle OSS Radar

## Purpose

Build a daily OSS discovery system that helps PlotPickle evolve as an **AI-native agentic Story Operating System**.

The radar is not a generic trending feed and not primarily a replacement hunter. It should find useful open-source projects, methods, teaching ideas, interaction patterns and architecture concepts that may:

- save work;
- strengthen something already built;
- reveal something PlotPickle missed;
- add a valuable capability;
- help writers write better stories;
- help users create stronger visual stories;
- improve STORY / the deterministic game engine;
- improve how students learn;
- expand Writers' Craft / LEARN knowledge;
- expose useful new AI architecture;
- improve creative UX, collaboration, provenance, testing or local-first operation.

The governing question is:

> **What changed in OSS that could save PlotPickle work, strengthen what we already have, reveal something we missed, help writers, improve visual storytelling, improve STORY/gameplay, help students learn better, expose better AI architecture, teach us something new, or add a valuable capability to the evolving Story Operating System?**

The product philosophy is **evolutionary**. Prefer bounded improvements, additive learning and proven extensions over repeatedly rebuilding working systems.

## Human-facing daily contract

The normal daily report targets **5 genuinely interesting findings**.

- Show five when five candidates genuinely clear the threshold.
- Never pad with weak findings merely to reach five.
- If fewer than five qualify, show the smaller number and explain that no other candidate cleared the threshold.
- `PASS` candidates are filtered evidence, not daily-report filler.

Each surfaced finding receives one simple primary disposition:

- **SAVE** — materially reduces work PlotPickle would otherwise build.
- **IMPROVE** — strengthens something PlotPickle already has.
- **ADD** — reveals a useful capability/workflow/architecture PlotPickle is missing.
- **LEARN** — teaches something worth incorporating into Writers' Craft, LEARN, student practice, story craft or professional knowledge.
- **WATCH** — strategically relevant, but no action yet.

Every surfaced finding must answer:

> **What can PlotPickle learn from this?**

## Discovery is broader than adoption

A repository can be valuable without being installed or copied.

The radar must distinguish between:

1. **Adopt a component** — use a compatible OSS component where it saves meaningful work.
2. **Adapt an idea** — borrow an architecture, UX, workflow or interaction concept and implement it in PlotPickle's own architecture.
3. **Independently author teaching** — use a project as a research/gap-analysis input, then write original PlotPickle curriculum in PlotPickle's own language.
4. **Add a capability** — identify a new Story Operating System feature worth designing.
5. **Watch only** — retain awareness without current implementation.

No external repository creates work automatically. Human approval remains required before implementation, dependency installation, curriculum changes or architecture changes.

## Internal evolution categories

Use richer machine-facing categories for search and scoring:

- `SAVE WORK`
- `STRENGTHEN`
- `MISSING PIECE`
- `NEW CAPABILITY`
- `WRITER CRAFT`
- `VISUAL STORY`
- `STORY / GAME ENGINE`
- `LEARN / EDUCATION`
- `AI ARCHITECTURE`
- `CREATIVE UX`
- `AGENT / AI`
- `ARCHITECTURE`

A candidate may carry more than one internal category while still producing one simple Human-facing disposition.

## Discovery lanes

### Writers and story craft
Search for projects or teaching patterns that could improve:

- premise and story promise;
- character, conflict, stakes and arcs;
- scene craft;
- dialogue and subtext;
- structure;
- worldbuilding;
- drafting and revision;
- adaptation;
- television / series / writers' rooms / comedy;
- professional writing practice;
- reader simulation and critique.

Relevant discoveries may map into the permanent **OPEN JOURNEY / 6 PATHS / 24 CRAFT MODULES** framework. The 6 Paths and 24 Craft Modules remain durable navigation containers, not curriculum-size limits.

### Visual storytelling
Search for OSS and patterns that could improve:

- storyboard;
- previs;
- shot planning and shot language;
- cinematography planning;
- scene blocking and spatial continuity;
- visual continuity;
- character/location/object reference systems;
- image and video generation workflows;
- multimodal creative pipelines;
- ComfyUI tooling;
- visual review and comparison;
- downstream visual development from accepted story state.

### STORY / game engine
Search for ideas that could improve:

- deterministic story simulation;
- finite rules and resolution;
- Story Pieces;
- world/state models;
- game validation and playability;
- replay and checkpoints;
- creator tooling;
- agent-character interaction;
- knowledge isolation;
- narrative game UX;
- large-world sparse activation;
- interactive fiction and narrative-design systems.

Do not let discoveries weaken STORY's existing authority rule: AI may propose/interpret; deterministic code authorizes mechanical state transitions.

### LEARN / student learning
Search for improvements in:

- learning science;
- tutoring patterns;
- self-directed learning;
- exercises and practice;
- feedback;
- reader simulation;
- reflection;
- mastery evidence without rigid gating;
- curriculum organization;
- accessibility;
- case-study learning;
- project-based learning;
- spaced/retrieval practice where it suits creative learning.

The radar must respect PlotPickle's guided-not-gated learning principle.

### New AI architecture
AI architecture is a first-class lane, not a model-news feed.

Look for architecture that could improve how PlotPickle composes intelligence, including:

- agent/runtime separation;
- deterministic core + agent proposal patterns;
- graph/workflow/event-driven orchestration;
- context assembly and Context Engine design;
- RAG/retrieval architecture;
- short/long-term memory and evidence ledgers;
- skill/capability registries;
- bounded tool permissions;
- Human-in-the-loop authority;
- multi-agent coordination and disagreement;
- model/provider routing;
- hardware-aware local/cloud execution;
- MCP/agent interoperability;
- evaluation, simulation and self-checking harnesses;
- observability of agent actions and decisions;
- inference cost/latency efficiency;
- privacy-preserving/local-first approaches.

A new AI framework should not score highly merely because it is new. It must expose a concrete useful capability or architectural lesson for PlotPickle.

### Platform / engineering
Also search where relevant for:

- local-first architecture;
- Windows desktop/app infrastructure;
- browser automation and WebMCP;
- UI/visual testing;
- documentation/architecture/drift detection/C4 tooling;
- provenance/evidence systems;
- community/presence/BBS/collaboration;
- security and verification patterns;
- speech-to-text/local voice workflows.

## Search configuration

Discovery queries must live in one versioned configuration owner rather than being scattered through workflow code.

The configuration should support:

- lane/category;
- query text/topic terms;
- optional recency window;
- optional star/activity floor;
- positive terms;
- negative terms;
- lane weighting;
- enable/disable state.

The configuration must remain easy to extend as PlotPickle discovers new areas worth watching.

## Deterministic pre-filter

Before any optional AI analysis, reject or down-rank candidates that are:

- archived;
- obvious forks with no meaningful divergence;
- stale/unmaintained;
- missing a usable/understandable license;
- clearly only a demo/tutorial with no reusable lesson, pattern or component;
- recently reviewed with no meaningful change;
- unrelated to PlotPickle's writing, learning, visual-story, STORY/gameplay, AI-architecture or product needs.

Positive signals may include:

- recent commits/releases;
- useful documentation;
- tests/CI;
- active maintainers;
- meaningful adoption;
- compatible licensing;
- Windows/local support where relevant;
- educational or creative value;
- architectural fit.

Stars are a signal, not the decision criterion.

## Scoring model

Use deterministic scoring first. Suggested dimensions:

- Problem / Opportunity Fit
- Evolution Value
- Writer Value
- Student / Learning Value
- Visual Story Value
- STORY / Game Engine Value
- AI Architecture Value
- Save-Work Value
- Missing-Piece Discovery Value
- Architecture Fit
- Integration Cost
- Maturity / Maintenance
- License Fit
- Windows / Local Fit where applicable
- Current Roadmap Relevance

Scores must be explainable from stored evidence. Do not create an opaque AI-only ranking authority.

Where practical, map a candidate to:

- current PlotPickle subsystem;
- open Issue;
- LEARN Craft Module;
- visual-story workflow;
- STORY/game-engine boundary;
- AI architecture boundary.

## Daily report schema

Each of the up-to-five findings should contain:

- repository name + link;
- primary disposition: SAVE / IMPROVE / ADD / LEARN / WATCH;
- short description;
- why PlotPickle should care;
- **What can PlotPickle learn from this?**;
- what it could add, teach, strengthen or save;
- writer benefit, if any;
- student/LEARN benefit, if any;
- visual-story benefit, if any;
- STORY/game-engine benefit, if any;
- AI-architecture benefit, if any;
- subsystem / Craft Module / Issue fit;
- single most useful component, idea or lesson;
- likely integration effort;
- license;
- maintenance/activity signal;
- compact scoring/evidence explanation;
- recommended next disposition.

Keep the report skimmable. Broad machine-side scoring should not become a wall of metrics for the Human.

## Reporting model

Do not create one GitHub Issue per day.

Use one rolling monthly issue, for example:

`[OSS RADAR] September 2026`

Each run adds or updates one dated daily report comment. Create the next monthly issue automatically on rollover.

A separate implementation/curriculum issue may be created only after explicit Human review decides a finding deserves work.

## History and deduplication

Track at minimum:

- stable repo identifier/full name;
- first-seen date;
- last-reviewed date;
- last meaningful release/commit marker;
- previous primary disposition;
- prior internal categories;
- previous score/evidence;
- prior PlotPickle fit/decision.

A previously reviewed project should reappear only when:

- it has a meaningful new release/change;
- its relevance to PlotPickle materially changes;
- the Human explicitly asks to revisit it.

The same candidate should not dominate multiple consecutive reports merely because it remains popular.

## GitHub Actions authority

First version uses GitHub Actions + GitHub APIs only. No Twitter/X dependency. No required paid external model.

Minimum workflow shape:

1. checkout;
2. load versioned discovery configuration;
3. run GitHub discovery queries;
4. normalize metadata;
5. deterministic filter;
6. deterministic scoring;
7. history/deduplication;
8. select the strongest five genuine findings, or fewer if fewer qualify;
9. render report;
10. create/find current monthly radar issue;
11. idempotently create/update today's report;
12. preserve structured evidence for debugging.

Use minimum permissions. Prefer `contents: read` and `issues: write`. Additional write permission requires explicit justification.

The workflow must not modify product code, curriculum, dependencies or configuration as a consequence of discovery.

## Optional later model-assisted analysis

The deterministic version must work without an external model key.

After the system proves useful, an optional budget-capped analysis stage may inspect only the highest-ranked README/docs and improve:

- what PlotPickle may have missed;
- what could help writers;
- what could improve visual storytelling;
- what could improve student learning;
- what could improve STORY/gameplay;
- what AI architecture is worth understanding;
- overlap with existing architecture;
- whether to adopt code, adapt an idea, independently author teaching, add a capability, or watch;
- integration/licensing risks.

Model output is advisory. It must not decide adoption, edit code, install dependencies, or create implementation issues autonomously.

## Copyright / curriculum boundary

External educational/craft repositories are research and gap-analysis inputs unless their license clearly permits the intended reuse and PlotPickle deliberately chooses reuse.

Default behavior for curriculum discoveries:

- do not copy third-party lesson bodies, SKILL files, screenplay corpora or long quotations into PlotPickle;
- identify the useful concept or missing subject;
- verify important concepts against suitable primary/authorized sources where practical;
- independently author PlotPickle teaching in PlotPickle's own language;
- preserve provenance/research notes where appropriate.

## Non-goals

- no Twitter/X requirement;
- no autonomous dependency installation;
- no autonomous code import;
- no autonomous curriculum import;
- no daily backlog spam;
- no ranking by stars alone;
- no paid-model requirement for basic operation;
- no automatic implementation issue per finding;
- no assumption that replacement is preferable to evolution;
- no weakening of Human authority, PPF canon authority, STORY deterministic authority, provider boundaries or security controls.

## Build plan

### Phase 0 — brief + discovery contract

- finalize this brief;
- define query configuration schema;
- define Human-facing dispositions;
- define internal categories;
- define deterministic score schema;
- define daily report schema;
- define history/deduplication owner;
- define license/activity thresholds.

### Phase 1 — deterministic GitHub discovery

- implement GitHub search client using `GITHUB_TOKEN`;
- normalize repository metadata;
- apply deterministic filters/scoring;
- add fixture-based tests across all major lanes, including AI architecture.

### Phase 2 — report + monthly issue lifecycle

- render up to five daily findings, targeting five;
- create/find monthly issue;
- create/update one dated report idempotently;
- prove fewer-than-five behavior does not pad weak candidates.

### Phase 3 — evolutionary relevance mapping

- map candidates to PlotPickle systems and roadmap;
- map LEARN discoveries to Craft Modules where useful;
- map visual discoveries to storyboard/previs/write pipelines;
- map STORY findings to game-engine boundaries;
- map AI findings to architecture boundaries;
- distinguish SAVE / IMPROVE / ADD / LEARN / WATCH.

### Phase 4 — schedule + UAT

- scheduled daily workflow;
- manual dispatch;
- five-result fixture;
- fewer-than-five fixture;
- no-result path;
- duplicate/re-release path;
- API failure/rate-limit path;
- permissions proof;
- exact-head Architecture Verification.

### Future Phase 5 — bounded model-assisted analysis

Only after the deterministic system demonstrates signal quality.

## Acceptance criteria

- daily GitHub Action works without Twitter/X or paid model requirement;
- Human report targets exactly five genuinely interesting findings, never padded with weak results;
- every finding answers **What can PlotPickle learn from this?**;
- daily dispositions are SAVE / IMPROVE / ADD / LEARN / WATCH;
- new AI architecture is a first-class search and scoring lane;
- the radar can surface useful ideas for writers, visual storytelling, STORY/gameplay and student learning;
- discoveries can be valuable without replacing existing code;
- stale/duplicate candidates are suppressed;
- license/activity/architecture-fit evidence is visible;
- reports accumulate in one monthly issue;
- reruns are idempotent;
- no discovery autonomously changes product code, curriculum or dependencies;
- Human remains adoption authority;
- focused tests and exact-head Architecture Verification are green before implementation merge.

## Roadmap position

This is intentionally separate from the immediate LEARN sequence.

Active agreed sequence:

`close #1962 → #1975 → #1918 Phase 5 → Phase 6 → Phase 7 → #1976 → #1918 Phase 8/9`

Hold:

- #1675 STORY epic;
- #1692 DEMO packaged-release completion;
- #1876 Skin V1 baseline locking.

#1977 may be implemented only when the Human explicitly moves it into the active sequence.
