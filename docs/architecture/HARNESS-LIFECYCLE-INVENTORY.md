# PlotPickle Harness Lifecycle Inventory

Issue #1645 is the evidence-only Slice A for #1644. It does not add a framework, runtime, orchestration layer, feature, migration or deletion. Its job is to describe the working pieces PlotPickle already has and isolate the minimum harness contract that Slice B must compose.

## Canonical lifecycle candidate

1. Enter / Understand
2. Learn / Prepare
3. Plan / Decide
4. Create / Execute
5. Validate / Repair
6. Approve / Persist
7. Package / Present / Continue

The six ownership domains remain Core, Story, Intelligence, Community & Integrations, Experience and Platform.

The machine-readable source of this inventory is `config/harness-lifecycle-inventory.json`.

## What already exists

PlotPickle already has the major capabilities required for the end-to-end journey.

| Existing route/system | Lifecycle coverage | Primary domains | Existing authority/persistence truth |
| --- | --- | --- | --- |
| Autonomous Guest authority | Enter / Understand | Core, Platform | Delegated Guest authority is loopback-only, run-scoped and carries no Human profile identity. |
| Durable Guest task lifecycle | Plan through Continue | Core, Platform | Durable Guest ledger survives restart, is bounded by leases/retries/policy and is non-canon. |
| Autonomous Story route journey | Enter through Continue, except canon apply | Story, Experience, Platform | Registered real product routes require bounded operation receipts; direct private-state mutation is forbidden. |
| Responsibility Runs | Learn through Continue | Intelligence, Core, Experience | Bounded attempts/tools/time/cost; worker observations cannot self-certify; creative output remains non-canon. |
| Revision-aware PPF proposals | Plan / Decide, Approve / Persist | Core, Story | Stale proposals fail closed; only explicit writer approval crosses the canonical mutation boundary. |
| Provider harness and routing status | Enter, Prepare, Execute | Intelligence, Platform | Provider adapters do not grant tools, PPF authority or silent paid-cloud fallback. |
| Full Verification and confirmed repair | Validate / Repair | Platform, Intelligence | PASS/FAIL/BLOCKED and confirmed findings are deterministic; advisory observations cannot become repair authority. |
| Run telemetry/activity | All stages as evidence/status | Platform, Experience, Intelligence | Sanitized event truth records provider, tool, policy, verification and writer decisions without hidden reasoning. |
| Evidence-learning maintainer | Learn, Validate, Approve/Persist | Intelligence, Core, Platform | Only server-owned harness approval admits durable knowledge; admission grants no operational authority. |
| Agent Skills | Prepare, Execute | Intelligence, Platform | Skills describe procedure but cannot grant host capabilities, provider spending or canon authority. |
| BUZZ specialist bridge | Prepare, Execute, Present | Community & Integrations, Intelligence, Experience | BUZZ history can persist, but peer/agent output stays suggestion/evidence and cannot directly write PPF canon. |
| Afterglow Autonomous Guest reference | Full proof path | Story, Core, Platform, Experience | Existing real routes prove delegated authority, project/revision continuity, durable task survival and packaged evidence. |

## Authority paths are already bounded

Human, Guest and agent authority are not missing features.

Human writer authority already owns the explicit PPF canonical apply boundary. Autonomous Guest authority is a separate delegated class with an empty Human profile identity and a run/workspace namespace. Responsibility Run workers may observe and produce non-canonical artifacts, while authoritative deterministic verification owns PASS/FAIL. The maintainer learner may propose evidence-backed knowledge, but a separate server-owned harness approver owns durable admission.

That separation is good and should be preserved. Slice B should describe it consistently, not replace it.

## Persistence is already deliberately plural

PlotPickle has several valid kinds of persistence:

- Guest task ledger: durable, restart-safe, non-canon operational state.
- Responsibility Run record and telemetry: durable local evidence/status, non-canon.
- BUZZ history: durable collaboration history, not PPF authority.
- Evidence-learning memory: durable approved knowledge with freshness/stale rules, no operational authority.
- PPF revision store: canonical project state behind explicit writer approval.

The gap is that handoffs do not currently carry one common persistence classification plus approval provenance. Slice B should add that description while leaving each existing subsystem as the actual writer.

## Evidence-backed lifecycle gaps

### P0 — No shared lifecycle envelope

Guest tasks, Responsibility Runs, PPF revisions, telemetry and evidence-learning already contain most fields required by #1644, but no single machine-readable envelope is composed across them. This is the core harness gap, not a missing product feature.

Slice B needs one small compositional contract carrying run/project identity, stage, actor/authority, capabilities, project/revision context, evidence, validation/repair state, persistence decision, stop reason and next action.

### P0 — Status vocabulary is fragmented

The current vocabularies are all useful inside their owners but are not interchangeable:

- Guest tasks: pending, eligible, blocked, running, retry-wait, completed, cancelled, expired, failed.
- Autonomous routes: entered, operated, skipped-prerequisite, failed-defect.
- Responsibility Runs: queued, preparing-context, working, verifying, revising, waiting-for-writer, paused, completed, failed, cancelled.
- Verification: PASS, FAIL, BLOCKED plus finding verification states.
- Evidence learning: observed, approved, stale and related durable states.

Slice B should project these onto the seven canonical stages plus a bounded stop reason and next action. It should not delete domain-specific states.

### P0 — Authority description is fragmented

Guest delegation, agent worker/system authority, Human writer approval and maintainer harness approval are all correctly separated but expressed through different records. Slice B needs a common actor/authority projection with provenance and granted capabilities. Existing authority contracts remain authoritative.

### P0 — Persistence classification is fragmented

A durable Guest task is not canon; a BUZZ message is not canon; approved maintainer knowledge is not operational authority; a writer-approved PPF revision is canon. Today those facts live in separate owners. Slice B needs an explicit persistence class and approval provenance so no handoff can blur these boundaries.

### P1 — Continuation is fragmented

Guest scheduling, Responsibility Run handoffs, route reports and activity UI each know how to continue, but there is no shared machine-readable `nextAction`/allowed-transition projection. Slice B should expose the next valid action without becoming a scheduler or UI authority.

### P1 — Provider state is not consistently lifecycle context

Provider route, health, cost/data-sharing consent and Guest policy already exist and prohibit silent paid fallback. Slice B only needs references to that capability/evidence context; provider selection remains owned by the provider/runtime layer.

## Minimum Slice B contract

The inventory supports the following minimum fields and no broader framework:

`schemaVersion`, `runId`, `projectId`, `revision`, `stage`, `allowedTransitions`, `actor`, `authority`, `intent`, `planOrDecisionRefs`, `capabilities`, `contextRefs`, `inputRefs`, `outputRefs`, `evidenceRefs`, `validation`, `repairBudget`, `persistence`, `approvalProvenance`, `stopReason`, `nextAction`.

These fields compose existing contracts. They do not replace Guest task state, Responsibility Runs, PPF revisions, provider policy, telemetry, verification findings, BUZZ history or evidence-learning storage.

## Evidence anchors

The machine inventory cites the concrete source and regression paths for every route and gap. High-value anchors include:

- `core/auth/autonomous-guest/guest-authority.ts`
- `build/autonomous-guest/task-lifecycle.ts`
- `tests/issue-1553-autonomous-route-orchestrator.test.mjs`
- `tests/issue-1569-autonomous-guest-task-ledger.test.mjs`
- `tests/issue-966-responsibility-runs.test.mjs`
- `tests/issue-964-revision-aware-ppf.test.mjs`
- `tests/issue-968-run-telemetry-evals.test.mjs`
- `tests/issue-989-verification-execution-graph.test.mjs`
- `tests/issue-1592-durable-retrieval-restart.test.mjs`
- `tests/issue-971-buzz-specialist-agents.test.mjs`
- `scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs`

## Slice A stopping rule

Do not implement production lifecycle behavior in #1645. The evidence shows PlotPickle already has the needed execution, authority, validation, persistence and reference-journey pieces. Slice B should therefore be a small shared contract/projection layer over those owners, not a new orchestration system.
