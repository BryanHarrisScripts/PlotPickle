# Agent task durability and governed resume

Issue: #2707
Baseline: a5797b2101ed6ee8c5f60e7916277d40abd8e87b

## Developer brief

### Outcome
A writer can interrupt an eligible multi-step agent task, reopen PlotPickle, inspect completed work, and explicitly resume the remaining steps. Completed results remain proposals until the existing writer acceptance path approves them.

### Current assessment (main a5797b210)
There are 20 configured agent profiles including the community extension, plus 16 embedded Mastra role IDs. Profile identity and runtime role are different inventories; several Mastra roles have no named profile. Existing responsibility runs already persist locally and support pause/resume state transitions. DSDD uses a Pi 0.99.1 session bridge. Pi Durable 1.0.0 is active by default on supported hosts, reopens JSONL storage, and has a host-owned driver contract. Its running sidecar currently exposes HEALTH ONLY: no application agent task is automatically connected to that service. Startup readiness is not evidence of task execution/recovery.

### Architecture and authority
Keep Mastra as application-agent execution owner, existing agent profiles as role/capability owners, existing responsibility runs as lifecycle/budget/approval owner, and existing PPF/project transitions as canon owner. Pi Durable supplies bounded task persistence/recovery behind its existing adapter. Assess upstream compatibility before bridging Mastra work into Pi: do not silently replace specialist instructions, compute assignment, context selection, tool grants or output schemas with a generic Pi agent. If transparent Mastra checkpointing requires a new adapter capability, implement that in the existing seam and prove it explicitly.

### Scope and sequencing
Phase 0: source-backed audit of every configured profile and embedded runtime role, canonical brief, ownership/replay classification, and reproducible audit command. Report all task connections as UNPROVEN until tested; do not infer wiring from profile availability. Start here.
Phase 1: shared project/profile/role/run/objective-revision/context-revision/provider scoped task envelope; stable task and step identities; protected local checkpoint/artifact references; atomic durable writes; cancellation, corruption and budget handling; no startup inference. Reuse responsibility-run contracts rather than inventing a second run state machine.
Phase 2: first real vertical slice: explicitly invoked Story Architect review of selected blocks, checkpoint each completed block and artifact reference, terminate/reopen, explicitly resume only remaining blocks, return results to existing proposal/history surface. Preserve the approved project revision and reject stale or mismatched context. Verify real managed Pi Durable persistence with deterministic worker fixtures, then opt-in configured-provider smoke; separate these two proofs.
Phase 3: extend proven shared seam to continuity, Critics' Circle, creative direction and remaining embedded roles. Include Foundations/Sage and game roles only with role-specific tests; Wyrmwood rewards and game progression never replay from a recovered evaluator result. Generation and external effects require idempotency receipts or fresh authorization.
Phase 4: UAT/repair/report handoffs and externally managed BUZZ agents retain their existing execution owners. Save only authorized task/handoff references where appropriate. Deterministic observers/gates use deterministic evidence persistence rather than unnecessary model execution. Do not migrate BUZZ ACP workspaces into Pi or silently subscribe private rooms.
Phase 5: human-facing paused/interrupted/resume/cancel/stale/unavailable states in the existing run activity surface; Windows launcher restart and exact-head product proof; upgrade/reset/delete semantics and documentation.

### Checkpoint contract
Scope by local human profile, project ID and revision, agent profile or runtime role ID, run ID, objective revision, context receipt, and host-selected provider/model. Retain budgets/usage, granted capabilities, stable step IDs and completed artifact references. Private task payloads belong only in protected local task storage and never developer telemetry, GitHub or public evidence. Do not store hidden reasoning. Task completion, provider availability and canon acceptance remain distinct. No automatic task inference at startup; show recovery candidates for explicit governed resume. No silent fallback to a different provider/model. Non-replayable publishing, image/video generation, repository writes and game effects cannot replay without independent idempotency or Human reauthorization. Terminal/cancelled tasks cannot restart accidentally.

### Acceptance
- [x] Audit covers all base/community profiles and all embedded Mastra roles, including unnamed roles and external ownership.
- [x] Canonical repository brief and phase plan exist before implementation.
- [x] Shared scoped checkpoint bridge reuses existing responsibility and adapter contracts.
- [x] Real Story Architect task close/reopen/resume skips completed steps and preserves proposals without changing canon.
- [x] Cross-project/profile/run isolation, stale revisions, corruption, cancellation, concurrent admission, repeated resume, budget exhaustion and non-replayable effects are covered by the shared/Story Architect regressions.
- [x] Every role adopted by #2707 has recorded task-level proof; readiness is never presented as wiring proof.
- [x] Startup performs no inference; unavailable Pi Durable does not prevent core launch.
- [x] Existing provider routing, capabilities, Mastra outputs, BUZZ ownership, deterministic gates and writer authority are preserved.
- [ ] Final #2743 exact-head focused regressions, convergence, production build and Windows product proof must pass before merge.

### First work package
Implement the inventory/ownership audit and brief first, then deliver the shared seam and Story Architect slice in separate reviewable PRs. Parent remains open until adopted roles and product proof are complete. Do not claim the earlier block-9 example is already available in the product.

## Reproducible Phase 0 audit

Run `node scripts/developer-diagnostics/agents/durability-audit.mjs` from the repository. It reads the base and community profile registries and the canonical Mastra role literal without loading providers or issuing inference. It rejects unknown execution owners and inconsistent registrations. Audit output is an implementation assessment, never runtime or recovery evidence.

## Agent-by-agent adoption plan

Sage Brinewick: retain curriculum context/teaching authority; save bounded lesson task references only when needed.
Tamsin Hearthquill: save Foundations field proposals; preserve accepted material and writer decisions.
Master Oaken-Vague and Rowan Scalequill: resume proposal/evaluation steps only against the same game state; never replay rewards, progress or inventory effects.
Quillan Reedcloak: preserve parent/child task references and remaining budgets, without granting specialists broader authority.
Elowen Mapweaver: first vertical slice; review selected blocks, checkpoint completed block results and resume remaining blocks after reopen.
Mira Threadmere: continuity review tied to accepted project revision, with evidence and proposed repairs retained.
The Marquee Director: persist concept/prompt proposals; actual image/video jobs need provider receipts and duplicate-effect protection.
Critics' Circle: resume independent review steps with unchanged context and preserve advisory outputs.
Unnamed embedded roles: discovery-mapper, character, world, screenwriter, graphic-novel, production and workflow-change each require contract-specific adoption; do not invent profile identities merely to satisfy this audit.
Avery North: retain observed UAT journey evidence through the existing harness; synthetic feedback stays labelled synthetic.
Luma Glassfern, Bram Gatewick and BEN: persist evidence/checkpoints through deterministic owners; Pi never decides whether a gate passes.
Rook Ironquill: retain verified repair handoff and exact-head evidence; developer workers remain governed by AGENTS.md.
Knot Pickle, Thread Pickle, Heart Pickle, Orin Ledgerbark, Fen Copperwind and Merrin Bellwarden: BUZZ owns their live runtime/workspaces. Any future PlotPickle handoff stores only allowed references and never duplicates private BUZZ memory or migrates execution ownership.

## Phase 0 delivery boundary

This first PR adds the audit, its validation and this brief only. It changes no running agent, startup service, model route, saved project or user interface. Task wiring remains UNPROVEN. Parent #2707 stays open; Phase 1 checkpoint integration and Phase 2 product recovery are separate changes with independent verification.


## Final #2707 support matrix — October 5, 2026

#2707 closes a bounded durability rollout rather than silently migrating every Agent into Pi Durable.

- Story Architect (`elowen-mapweaver` / `story-architect`): `PROVEN-APPLICATION`. The existing Outline controller has real close/reopen/explicit-resume product proof with committed Blocks skipped, retained accounting, cancellation and unchanged canon.
- Mira Threadmere / `continuity`: `PROVEN-CHECKPOINT`. Replay-safe review work is admitted through the shared Phase 3 contract and has executable reopen/skip-completed-step task proof.
- Critics' Circle / `critic`: `PROVEN-CHECKPOINT`. Replay-safe review work is admitted through the shared Phase 3 contract and has executable reopen/skip-completed-step task proof.
- Quillan Reedcloak / `creative-director`: `PROVEN-CHECKPOINT`. Replay-safe proposal work is admitted through the shared Phase 3 contract and has executable reopen/skip-completed-step task proof.
- BUZZ-managed, PlotPickle UAT, deterministic observer/gate and repository-handoff profiles: `OWNER-PRESERVED`. Phase 4 keeps their execution owner and stores only bounded handoff/evidence references.
- Remaining embedded Mastra roles: `NOT-ADOPTED`. They require future role-specific replay/idempotency approval. Generation, game effects, publication and repository mutation do not become replay-safe merely because Pi Durable exists.

The reproducible durability audit now reports these states directly. Provider availability remains separate from task wiring.

## Final Phase 5 lifecycle and maintenance semantics

Settings → Agents includes Responsibility Run activity. Persisted active Responsibility Runs from a previous PlotPickle process are presented as `interrupted`; the read path performs no inference and grants no resume. Generic Resume remains limited to explicitly paused Responsibility Runs. Interrupted Story Architect work resumes through its owning Outline workflow, where the protected task controller revalidates Human profile, project/revision, run, context, provider/model, grants and budget before remaining work can continue.

The Human-facing projection also distinguishes `stale` and `unavailable` terminal failures from ordinary failure. Those labels are presentation, not authority.

Durable state is protected work evidence rather than cache. Runtime/package upgrades preserve Responsibility Run files, Pi JSONL state and proposal references. Startup does not reset or delete them. Reset/delete are explicit Human maintenance concepts only, require separately reviewed protected maintenance authority, and are intentionally absent from normal Responsibility Run activity. Terminal/cancelled work cannot silently restart.

The final Phase 5 implementation brief is `docs/developer-briefs/2743-durable-lifecycle-closeout.md`.
