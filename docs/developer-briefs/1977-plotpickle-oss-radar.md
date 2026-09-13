# Developer Brief — #1977 PlotPickle OSS Radar

## Purpose

Build a daily open-source discovery system that helps PlotPickle evolve as an **AI-native agentic Story Operating System**.

The Radar is not a generic trending feed and not primarily a replacement hunter. It should find useful repositories, methods, teaching approaches, interaction patterns and architecture ideas that can save work, strengthen existing systems, reveal missing pieces, add valuable capabilities, help writers, improve visual storytelling, improve STORY/gameplay, improve student learning, expand LEARN, expose useful AI architecture, or strengthen local-first engineering and verification.

The governing question is:

> What changed in OSS that could save PlotPickle work, strengthen what we already have, reveal something we missed, help writers, improve visual storytelling, improve STORY/gameplay, help students learn better, expose better AI architecture, teach us something new, or add a valuable capability to the evolving Story Operating System?

The product philosophy is evolutionary: prefer bounded improvements, additive learning and proven extensions over repeatedly rebuilding working systems.

## Human-facing daily contract

The normal daily report targets **5 genuinely interesting findings**.

- Show five when five candidates genuinely clear the threshold.
- Never pad with weak findings merely to reach five.
- If fewer than five qualify, show the smaller number and state that no other candidate cleared the threshold.
- `PASS` is an internal filter result and never consumes a daily report slot.

Each surfaced finding receives one primary disposition:

- `SAVE` — materially reduces work PlotPickle would otherwise build.
- `IMPROVE` — strengthens something PlotPickle already has.
- `ADD` — reveals a useful capability, workflow or architecture PlotPickle is missing.
- `LEARN` — teaches something worth incorporating into Writers' Craft / LEARN, student practice, story craft or professional knowledge.
- `WATCH` — strategically relevant, but no action yet.

Every surfaced finding must answer: **What can PlotPickle learn from this?**

## Discovery is broader than adoption

A repository can be valuable without being installed or copied. The Radar must distinguish between:

1. **Adopt a component** — use a compatible OSS component where it saves meaningful work.
2. **Adapt an idea** — borrow an architecture, UX, workflow or interaction concept and implement it inside PlotPickle's own architecture.
3. **Independently author teaching** — use a project as research/gap-analysis input, then write original PlotPickle curriculum in PlotPickle's own language.
4. **Add a capability** — identify a new Story Operating System capability worth designing.
5. **Watch only** — retain awareness without current implementation.

No external repository creates work automatically. Human approval remains required before implementation, dependency installation, curriculum changes or architecture changes.

## Internal evolution categories

Machine-facing categories may overlap while each finding still receives one Human-facing disposition:

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

## Discovery lanes

### Writer craft
Search for premise, character, conflict, stakes, arcs, scene craft, dialogue/subtext, structure, worldbuilding, drafting, revision, adaptation, television/series, writers' rooms, comedy, professional writing practice and reader simulation.

Relevant curriculum discoveries may map into the permanent **OPEN JOURNEY / 6 PATHS / 24 CRAFT MODULES** framework. Those containers are durable navigation, not curriculum-size limits.

### Visual storytelling
Search for storyboard, previs, shot planning, cinematography planning, blocking, spatial/visual continuity, reference systems, image/video generation workflows, multimodal pipelines, ComfyUI tooling, visual review and accepted-story-to-visual-development workflows.

### STORY / game engine
Search for deterministic story simulation, rules/resolution, Story Pieces, world/state models, validation/playability, replay/checkpoints, creator tooling, agent-character interaction, knowledge isolation, narrative-game UX, sparse activation and interactive narrative systems.

Discoveries must not weaken STORY authority: AI may propose or interpret; deterministic code authorizes mechanical state transitions.

### LEARN / education
Search for learning science, tutoring, self-directed learning, exercises, feedback, reader simulation, reflection, project-based learning, retrieval/spaced practice where suitable, curriculum organization and accessibility.

The Radar must respect PlotPickle's guided-not-gated learning principle.

### AI architecture
AI architecture is a first-class lane, not a model-news feed. Search for agent/runtime separation, deterministic-core-plus-agent-proposal patterns, graph/workflow/event orchestration, context assembly, RAG, memory/evidence ledgers, skill/capability registries, bounded tools, Human-in-the-loop authority, multi-agent disagreement, provider routing, local/cloud hardware awareness, MCP/interoperability, evaluation, observability, inference efficiency and privacy-preserving local-first approaches.

A framework does not score highly merely because it is new. It must expose a concrete useful capability or architectural lesson for PlotPickle.

### Platform / engineering
Search where relevant for local-first architecture, Windows desktop/app infrastructure, browser automation/WebMCP, UI/visual testing, documentation/architecture/drift detection/C4 tooling, provenance/evidence systems, community/presence/BBS/collaboration, security/verification and local speech-to-text workflows.

## Versioned search configuration

All discovery queries must live in one versioned configuration owner rather than being scattered through workflow code. Each query record supports:

- stable query ID;
- lane/category;
- GitHub query text/topic terms;
- optional recency window;
- optional activity/star floor;
- positive and negative terms;
- lane weighting;
- enable/disable state.

The configuration must stay easy to extend.

## Deterministic pre-filter

Before any optional model analysis, reject or down-rank candidates that are archived, obvious non-divergent forks, stale/unmaintained, unusably licensed, merely demo/tutorial material with no reusable lesson/pattern/component, recently reviewed without meaningful change, or unrelated to PlotPickle.

Positive signals include recent commits/releases, useful documentation, tests/CI, active maintainers, meaningful adoption, compatible licensing, Windows/local support where relevant, educational/creative value and architecture fit. Stars are a signal, not the decision criterion.

License policy is fail-safe:

- clearly incompatible/prohibited license => reject;
- missing/unknown license => may be `WATCH` or research-only, but cannot become an adopt-component recommendation;
- compatible license => still requires Human approval before adoption.

Activity policy is deterministic but not popularity-biased:

- archived repositories are rejected;
- no meaningful activity for 365 days incurs a strong staleness penalty;
- no meaningful activity for 730 days is rejected unless an explicit strategic-watch exception is configured;
- a low-star but active specialist project may still qualify.

## Deterministic scoring

The base score is explainable and totals 100 points before integration-cost penalty:

- Problem / Opportunity Fit — 15
- Evolution Value — 10
- Writer Value — 10
- Student / Learning Value — 8
- Visual Story Value — 8
- STORY / Game Engine Value — 8
- AI Architecture Value — 10
- Save-Work Value — 8
- Missing-Piece Discovery Value — 7
- Architecture Fit — 6
- Maturity / Maintenance — 4
- License Fit — 3
- Windows / Local Fit — 1
- Current Roadmap Relevance — 2

Integration cost is a transparent penalty from 0–10 after the base score.

Default report threshold: **65** after penalty. A strategically relevant candidate scoring **55–64** may be retained internally as `WATCH` evidence but is not automatically surfaced unless its watch rationale is explicit and the report has fewer stronger qualifying findings.

All score inputs and penalties must be stored with evidence. No opaque model-only ranking authority.

## Daily report schema

Each surfaced finding includes:

- repository name + link;
- primary disposition;
- one-sentence description;
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
- compact score/evidence explanation;
- recommended next disposition.

The Human report stays skimmable; detailed scoring remains structured evidence.

## Reporting model

Do not create one GitHub Issue per day. Use one rolling monthly issue, for example `[OSS RADAR] September 2026`.

Each run creates or updates one dated daily report comment idempotently. A separate implementation or curriculum issue may be created only after explicit Human review decides a finding deserves work.

## History and deduplication

Track at minimum:

- stable repository ID/full name;
- first-seen date;
- last-reviewed date;
- last meaningful release/commit marker;
- previous primary disposition;
- prior internal categories;
- previous score/evidence;
- prior PlotPickle fit/decision.

A previously reviewed project reappears only when it has a meaningful new release/change, its PlotPickle relevance materially changes, or the Human explicitly requests reconsideration.

The same candidate must not dominate consecutive reports merely because it remains popular.

## GitHub Actions authority

First version uses GitHub Actions + GitHub APIs only. No Twitter/X dependency and no required paid external model.

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
10. create/find current monthly Radar issue;
11. idempotently create/update today's report;
12. preserve structured evidence for debugging.

Use minimum permissions, preferring `contents: read` and `issues: write`. Additional write permission requires explicit justification.

The workflow must not modify product code, curriculum, dependencies or configuration as a consequence of discovery.

## Optional later model-assisted analysis

The deterministic version must work without an external model key. After it proves useful, a future budget-capped analysis stage may inspect only the highest-ranked README/docs to improve interpretation. Model output remains advisory and cannot decide adoption, edit code, install dependencies or create implementation issues autonomously.

## Copyright / curriculum boundary

External educational/craft repositories are research and gap-analysis inputs unless their license clearly permits intended reuse and PlotPickle deliberately chooses reuse.

Default curriculum behavior:

- do not copy third-party lesson bodies, SKILL files, screenplay corpora or long quotations into PlotPickle;
- identify the useful concept or missing subject;
- verify important concepts against suitable primary/authorized sources where practical;
- independently author PlotPickle teaching in PlotPickle's own language;
- preserve provenance/research notes where appropriate.

## Phase plan

### Phase 0 — brief + discovery contract

- commit this brief first;
- define versioned query configuration;
- define Human dispositions and internal categories;
- define deterministic scoring and thresholds;
- define daily report schema;
- define history/deduplication owner;
- define license/activity rules;
- add focused deterministic contract tests and convergence evidence.

No GitHub API discovery client, scheduled workflow or monthly issue automation is implemented in Phase 0.

### Phase 1 — deterministic GitHub discovery

Implement GitHub search using `GITHUB_TOKEN`, normalized repository metadata, filters/scoring and fixture-based tests across all major lanes.

### Phase 2 — report + monthly issue lifecycle

Render up to five daily findings, create/find the monthly issue, create/update one dated report idempotently, and prove fewer-than-five behavior never pads weak candidates.

### Phase 3 — evolutionary relevance mapping

Map candidates to PlotPickle systems, LEARN Craft Modules, visual workflows, STORY/game-engine boundaries, AI architecture and roadmap vocabulary; distinguish SAVE / IMPROVE / ADD / LEARN / WATCH.

### Phase 4 — schedule + UAT

Add daily schedule + manual dispatch, five-result/fewer/no-result fixtures, duplicate/re-release behavior, API/rate-limit handling, permissions proof and exact-head Architecture Verification.

### Future Phase 5 — bounded model-assisted analysis

Only after the deterministic system demonstrates useful signal quality.

## Acceptance criteria

- daily design targets five genuinely interesting findings but never pads weak results;
- every surfaced finding answers **What can PlotPickle learn from this?**;
- dispositions are SAVE / IMPROVE / ADD / LEARN / WATCH;
- AI architecture is a first-class lane;
- writer, visual-story, STORY/gameplay and student-learning discoveries are first-class lanes;
- discoveries can be useful without replacing existing code;
- stale/duplicate candidates are suppressed;
- licensing and activity evidence are explicit;
- unknown license cannot produce an adopt-component recommendation;
- reports accumulate in one monthly issue;
- reruns are designed to be idempotent;
- discovery cannot autonomously change product code, curriculum, dependencies or implementation backlog;
- Human remains adoption authority;
- Phase 0 remains contract-only;
- focused tests and exact-head Architecture Verification must be green before Phase 0 merges.

## Roadmap position

#1977 is now the active workstream by explicit Human direction. The following work is parked and must not be changed by this issue:

- #1976 Phase D/E;
- #1918 Phase 8/9;
- #1675 STORY epic;
- #1692 DEMO packaged-release completion;
- #1876 Skin V1 visual baseline locking.
