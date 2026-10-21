# Developer Brief — Intent-Centred PlotPickle Operating System and Hollywood-to-Screen Coverage

Status: **Human-directed product direction; implementation PROPOSED, not certified**
Date: 2026-10-21
Tracking issue and discussion log: [#3203](https://github.com/BryanHarrisScripts/PlotPickle/issues/3203)
Open-backlog triage companion: [3203-open-issue-convergence-2026-10-21.md](3203-open-issue-convergence-2026-10-21.md)
Source snapshot: `main` at `2e562a76cfaec6816f026ca6b8492f013697e5da` (42 open issues).

## Why this evolution is necessary

PlotPickle has grown from story-writing and planning into screenplay, storyboard, Previs, Timeline, assets, sound, playable worlds, agent Skills, education and software engineering. A menu-oriented UI made those functions discoverable, but the number of destinations now makes the Human the manual coordinator of multi-step work. An agent clicking the same menus merely automates the navigation tax.

The goal is **not** to eliminate the GUI or turn filmmaking into a chat transcript. It is to make PlotPickle an **intent-centred storytelling and production operating environment**: the Human explains the outcome, the application binds the correct project/revision/authority, agents call existing typed capabilities directly, and the experience presents relevant facts, alternatives, blockers and meaningful decisions. Direct-manipulation editors, timelines, storyboards and a real playable game table remain available when those are the best tools. **Stop programming screens; start programming truth.**

This brief consolidates the 2026-10-21 discussion of the five-page draft *Interfaces for Humans and AI Agents*, the corrected user-supplied Hollywood ten-stage production infographic, the earlier Hollywood/software analogy, README evolution delivered by [PR #3204](https://github.com/BryanHarrisScripts/PlotPickle/pull/3204), and repository contract/issue evidence. The draft paper and diagrams are **informative discussion sources, not approved test oracles**. Distinguish film practice from metaphor: an editorial picture lock is not a software PR merge, and Storyboard/Previs is not independent software UAT. Departments overlap; the ten stages are capabilities and deliverables, **not ten sequential UI screens**.

## One operating experience; three Factories and one Coordinator

| Responsibility | Human intent | Evidence / prepared output | Domain-specific decision authority |
|---|---|---|---|
| **Software Factory** | Build, test, repair or improve PlotPickle | Repro, exact source diff/head, independently green CI, real Windows/browser product and process STOP evidence | Explicit scope, stop, exception or a merge not already covered by bounded green-only authorization; no story-canon rights |
| **Learning & Evolution Factory** | Learn/teach screenplay, filmmaking, directing, camera, sound, interactive craft, UX or technology | OSS RADAR, professional sources, version/licence provenance, evaluated lesson/exercise/Skill or integration candidate | Human editorial adoption/publication/integration; research never executes or installs software by itself |
| **Game Factory — STORY: The Unwritten** | Build or play a world, scene, character, story rules or interactive adaptation | Legal/illegal action, deterministic consequence, session/replay state, game-validator and playtest findings | Player chooses legal moves; creator separately admits rules/worlds/releases; PPF canon promotion separately governed |
| **Semantic Story Coordinator** | Understand, write, direct, produce, finish or revise a specific film/story | PPF-linked narrative evidence, gaps and alternative remedies, dependency/production impact and stage readiness | The Human author chooses creative direction, save/lock, actual media spend and release; no silent cross-project edits |

The **Intent Coordinator** is a routing/presentation role across these four authorities—not a fourth Factory, canon store, scheduler with new permissions, or an independent agent runtime. One reusable cycle: **Intent → Evidence/Preparation → Decision if required → Approved execution → Verifiable receipt**. A decision card is not needed for every observation; a player move under approved rules and a separately pre-authorized green-only code merge do not each require an extra approval dialog.

Examples:
- “Review Brotherly Love Sequence 1 for filmability” → Semantic Story Coordinator → source-linked possibilities and affected 4/12/24/96 addresses → writer decision → existing Storyboard/Previs/Timeline operations.
- “Adapt this conflict into a playable five-scene encounter” → Game Factory proposal → deterministic validation → creator admission → legal game play; results cannot silently rewrite the source screenplay.
- “Teach blocking with a practical exercise” → Learning Factory sources and evaluation → Human lesson/Skill publication decision.
- “The locked shot disappeared after reopening” → sanitized source-bound Software Factory reproduction → exact-head fix → independent CI and real Windows acceptance.

## Hollywood ten-stage capabilities and honest current evidence

Do not mistake a source file or a selectable UI surface for an end-to-end verified professional production capability. Stage readiness must carry **implemented / tested / observed on target / blocked / unknown** scopes, not one synthetic PASS.

| Hollywood stage from the user-supplied diagram | Current code/contract starting point | Gap to close; future proof |
|---|---|---|
| **1. Concept & Script Development** | Library PPF; Write/Outline; revisions; shooting-script report | Producer/creator greenlight and approved shooting-script source baseline, numbered-scene/page revision change impact, rights and creative decision receipt |
| **2. Pre-Production Planning** | `app/preproduction-workspace.tsx` breakdowns, shoot groups and schedule; `app/production-reports-workspace.tsx` | Accurate scene resource assumptions, real budget/cost categories, schedule conflicts, safety/access/consent and Human production approval |
| **3. Casting & Location Scouting** | Characters, World Map, actor schedules and location reports | Options/availability, scouting, continuity references, permits/rights and explicit physical-vs-synthetic production mode |
| **4. Technical Prep & Design** | Storyboard, Previs/animatic, shot coverage; Director Specification and production-intent projections | Director/camera/blocking/lighting/wardrobe/prop and art-department coordination, source-linked approved shot/timing plan |
| **5. Principal Photography / Virtual Capture** | ProductionShot intents, provider-selected generated media takes | Actual physical footage capture is **not** proven by AI rendering; maintain separate photographed vs synthetic/generated take metadata, provenance, ingest, slate/camera/timecode and quality/consent checks |
| **6. Picture Editing** | Timeline, take/rough-cut revisions, non-destructive PPF production links | Source/take/timecode editorial selection, external NLE exchange/conform, editor/director picture lock and version-safe change management |
| **7. VFX & Compositing** | Storyboard reference/artifact lineage and targeted media regeneration | VFX turnover, plate/element provenance, compositing/colour pipeline, QC of exact approved rendered versions |
| **8. Sound & Music** | Sonic Bible, Narration, Music, Foley cue intentions attached to shots | Dialogue and ADR, sound editorial, score/music clearances, sync, mixed deliverables and independent listening QC |
| **9. Final Mix & Mastering** | Production sound/take and Rough Cut state | Measured picture/sound conformity, grade, captions/subtitles/accessibility, professional master specs, checksums, technical and Human approval |
| **10. Marketing & Distribution** | Posters/Pitch assets, distribution-plan UI, Screening observations | Clearances, approved key art/trailer and metadata, platform-/festival-/DCP-specific packaging only when implemented and tested, delivery/release receipts and observed audience feedback |

The earlier Hollywood/software parallel is a **useful governance analogy**, not equivalence. “Locked script” is a baseline that can receive controlled revised pages. The picture may lock for editorial while VFX, mix and colour finishing continue. Software exact-commit CI measures code and runtime obligations; cinematic coherence, acting, taste, entertainment and audience response require creative review and actual play/screening evidence. Never claim Hollywood readiness merely because the structural five-dimension PlotPickle Score is high.

## One authority and provenance path

- Existing **PPF Canon** is the only durable story-canon authority. Preserve the selected Human profile, project ID, canonical revision, approved source references and 4 Acts / 12 Sequences / 24 Blocks / 96 Mini-Blocks; preserve scene, shot, frame and take IDs across projections. `docs/developer-briefs/2458-story-to-screen-phase-0-audit.md` already rejects a duplicate persisted Production Packet; continue to reuse it as a projection.
- The existing lifecycle (`core/lifecycle/lifecycle-contract.mjs`, `lifecycle-authority.mjs`), revision writer and Story Decision/Workbench control state and authorization. Agent suggestions and generated previews are **candidates**, not canonical script, locked storyboard, released master, published lesson, installed OSS, or authorized engineering merge.
- Attach source/version, media provenance, identity, selected runtime/provider/charge permission, rights/licence status, production dependencies, validation results and independently observed receipts to real outputs. Distinguish `VERIFIED`, `OBSERVED`, `PROPOSED`, `INSUFFICIENT_EVIDENCE`, `BLOCKED` and `UNKNOWN` without inventing readiness.
- Game Factory STORY owns deterministic session mechanics and player-legal action transitions, not PPF canon or the host's tools. `#1675` stays ON HOLD pending its own scoped authorization. Wyrmwood is not silently rewritten; BUZZ is community/discovery, not game authority.
- **Human decisions** include artistic alternatives, spend, canon promotion, game creator rules, publishing/distribution and curriculum adoption; existing bounded green-only software merge delegation remains distinct.
- Preserve the locked three-column creative shell in `docs/PLOTPICKLE-PRODUCT-CONTRACT.md` (PP-UX-002..006). If the desired intent surface actually conflicts with a LOCK, create a separate, Human-approved change proposal first. No second navigation tree as a shortcut.
- MCP, AG-UI or A2UI may act as versioned capability/presentation transports. Their presence or an event stream is not evidence that a transaction committed, a movie rendered or a game passed.

## Recommended phased migration (no big-bang redesign)

### Phase 0 — Inventory, contract and issue convergence (this brief)

- Enumerate *all* current open issues and record retain / re-scope / consolidate-after-proof / hold, owner, first proof and next action.
- Align existing #3203 with three Factories, one Coordinator, ten film capabilities, current truthful PPF/engine/evidence owners and any product LOCK conflicts.
- Publish this review and record the authoritative five-issue selection; do not close an issue just because a new architecture supersedes its proposed UI technique.

**Exit:** auditable open-issue snapshot and issue-level migration disposition; named next five; independent gate definitions. This exit is documentary, not a product feature.

### Phase 1 — Trustworthy execution and independent verification

- Complete live owned Windows UAT server-tree STOP (#3121), Software Factory child/descendant/sentinel live STOP (#3135), and finish full Story Factory browser + STOP acceptance (#3118).
- Re-scope durable CMD/GUI engineering-status/dispatch (#3142) to the user's **ChatGPT-only, explicitly invoked, finite five-at-a-time** preference for immediate execution. The existing legacy Pi queue remains OFFLINE/reserved/non-replayable; other coding workers remain future opt-in alternatives, not presumed runtime.
- Use isolated source edits, tests, exact-head green CI, real Windows Product Gate and source-bound receipts; no permission escalation, arbitrary shell, paid creative generation or background ChatGPT wake-up implied.

**Exit:** demonstrated real Windows lifecycle and source/PR receipts; separately proven same-head constraints. No claim of unattended dispatcher until genuinely demonstrated.

### Phase 2 — First intent-native creative proof

- Reuse #3203 for an actual **read-only Hollywood Production Readiness** operation: “Where is this selected PPF film, what is actually evidenced across the ten stages, what is blocked or unknown, what decision is next?”
- Implement one typed/headless capability and one in-shell GUI conversational entry; both must return the same exact PPF/revision, source citations, ten-stage evidence, owner, dependencies and legal deep links. Use real Brotherly Love/Afterglow only with user-authorized read scope; automate via disposable synthetic Human test projects.
- Reject wrong profile/project, stale revision, missing evidence, cross-story reuse or fabricated stage PASS. No model/provider expense or canon write in this first slice.

**Exit:** independent exact-head and genuine Windows UI acceptance of headless/GUI parity, measured reduction in navigation and traceable findings.

### Phase 3 — Professional production handoffs (prioritize missing gates, not screens)

- Greenlight/revised shooting-script source baseline → source-linked scene breakdown, cast/location/props, budget/schedule/rights → technical Storyboard/Previs plan and approval → distinguish AI-generated take from photographed footage and log real versions/dailies → Rough Cut.
- Then targeted VFX turnover, dialogue/ADR/score/Foley, picture lock, colour, final mix, master specifications, accessible captions, media checksums, creator release decision, packaging and screening feedback.
- Keep film departments and agents collaborative/parallel where possible; each output must specify its original source revision, approval, downstream impact and actual artifact read-back.

**Exit:** first reviewable end-to-end authorized Mini-Block and a separately verified professional finishing/delivery path; not equivalent to claiming a studio-ready feature film.

### Phase 4 — Learning and Game Factory feedback

- Convert vetted industry knowledge/research into authored/evaluated lessons, practical exercises, glossary and agent Skills; neither OSS RADAR nor a narrative quality claim silently changes the curriculum.
- Connect Semantic story proposals to STORY: The Unwritten as explicit game/world candidate handoffs; replay legality and knowledge isolation remain deterministic, and only approved game outcomes may propose PPF changes. Preserve #1675 hold until separately released.
- Use actual production, screening and playtesting evidence to improve teaching, approved Skills and software defect intake.

**Exit:** independently reviewable lesson/game/product handoffs with no authority crossover.

### Phase 5 — Measured Operating System acceptance

- Compare intent path against current Matrix navigation for representative story, filming, game and maintenance tasks. Measure steps to goal, source-grounding, false-green rate, decisions prompted, privacy/identity continuity, time-to-review and recoverability.
- Prove real user/browser/product behaviour, accessible editor handoffs, stop/restart, media persistence, local-vs-cloud spend permission, compatible export and human-controlled distribution where actually implemented.
- Review obsolete menu-only issues for closure **only after** their unique user outcomes are either demonstrably satisfied or explicitly replaced with linked independent evidence.

**Exit:** a useful, truthful, Human-controlled operating experience—not merely a new splash page.

## First five issue executions, in dependency order

The next five are a *bounded, sequential plan*, not five irrevocable Pi queue admissions, background tasks or five simultaneously active PRs. Do not reserve or replay the five historically blocked Pi jobs. Merge each eligible code change only after exact-head independently green mandatory CI and real Windows product/STOP proof. A BLOCKED issue stays open and the next work is explicitly re-evaluated.

1. **#3121 — Windows live verifier owned STOP / cleanup.** Verify whether existing `stopAndCleanupLiveVerifier` and its tests meet production descendant, port, unrelated sentinel and safe cleanup requirements. Implement smallest missing owned-verification proof, not arbitrary PID termination. Passing helper unit tests cannot claim production tree proof.
2. **#3135 — Actual live Software Factory STOP.** Controlled disposable running child/grandchild fixture, on Windows: RUNNING → STOP_REQUESTED → confirmed cancellation and independently checked descendant absence; unrelated sentinel survives; replay/no-op, unknown-ownership and race cases.
3. **#3118 — Story Factory browser acceptance closure.** Prior real browser UAT at `b197c02454be15abd9a7b546d8d09f48383c2074` passed `PRODUCT_UAT_OBSERVED_PASS` and separately attested 55 journey checkpoints; this does **not** attest production owned STOP. Re-run/apply full exact-current-head checks after #3121/#3135 and close only when product identity, clean STOP and independent verifier receipts all agree.
4. **#3142 — User-invoked ChatGPT-only dispatcher + GUI/CMD truthful parity (re-scope first).** Provide finite batch controls, one durable task/evidence ledger, exact issue/SHA, stop, approval and blocked status. Do not claim a long-running Windows process can independently awaken ChatGPT Plus Chat; the legacy Pi reservations remain OFFLINE. Coordinate #3148 queue policy and prerequisite pilot receipts before allowing actual new admissions.
5. **#3203 — Read-only intent/film-production readiness proof.** One selected PPF revision and real ten-stage evidence across headless and GUI; explicit blocked/unknown, proper contextual deep links, no model cost, save/lock or canonic change. If a locked UI contract must change, stop for a separately approved product-contract amendment.

**Next in queue, contingent:** #3148 newest-first governed batch planning/admission after actual dispatcher/pilot prerequisites; #3004 Brotherly Love real source-to-screen production; #1675 The Unwritten only after its ON HOLD state is explicitly revisited; #2620 and #3030 to feed evaluated lessons.

## Verification and convergence requirements

Source edition and tests must respect `AGENTS.md`, WHITE PAPER V3 truth governance and `config/verification/test-catalog.json` W8/W9 bindings. Production edits require focused tests, build, regression and convergence review, independently checked GitHub PR head, and real owner-Windows Product Gate where applicable. An architecture/documentation PR has only document/CI truth, **not** product/UAT proof. Record `PASS/FAIL/BLOCKED/UNKNOWN` with exact source SHA and private-safe receipt IDs; do not copy private Brotherly Love screenplay, credentials or test-home paths into public issues. Preserve one `PlotPickle Development Run` ledger per nontrivial PR.

## Immediate success criteria

This initiative is not complete merely because this brief is merged. The first real success is a user saying “Assess the current Hollywood production readiness of Brotherly Love” and receiving ten faithful source-backed evidence states and the next permitted decision, without manually coordinating unrelated screens. Another crucial success is a user-invoked five-issue Software Factory run showing *actual* source patches, independently green checks, truthful Windows STOP and governed merges rather than the earlier offline Pi queue. The status of both remains **UNPROVEN until executed**.
