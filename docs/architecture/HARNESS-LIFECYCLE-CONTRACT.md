# PlotPickle Universal Lifecycle Contract

Issue #1647 implements Slice B of #1644. The contract is intentionally smaller than an orchestrator. It is a Core-owned envelope and transition vocabulary that existing PlotPickle owners may project into and out of without moving their authority.

The executable contract lives at `core/lifecycle/lifecycle-contract.mjs`. Slice C (#1646) adds the Core-owned authority decision gate at `core/lifecycle/lifecycle-authority.mjs`. The authority gate interprets the lifecycle envelope; it does not replace Guest delegation, Human writer approval, delegated Story Decision policy, Story Workbench validation, the maintainer harness approver, provider policy or any other existing authority.

## Canonical stages

`enter-understand → learn-prepare → plan-decide → create-execute → validate-repair → approve-persist → package-present-continue`

The one intentional backward edge is `validate-repair → create-execute` for a bounded repair attempt. A repair must then return to `validate-repair` for fresh deterministic verification. Package/Present/Continue is terminal for the current lifecycle envelope; a new run starts a new envelope rather than silently recycling authority.

Same-stage updates are permitted without pretending that a lifecycle transition occurred.

## What the envelope carries

The v1 envelope carries only bounded metadata and references:

- `schemaVersion`
- `runId`, `projectId`, `revision`
- `stage`, derived `allowedTransitions`, and `priorTransition`
- `actor` with actor kind, authority class, delegation and authority reference
- reference-only `intent`
- `planOrDecisionRefs`
- `capabilities`
- `contextRefs`, `inputRefs`, `outputRefs`, `evidenceRefs`, `integrationRefs`
- `contractRefs` pointing to existing subsystem contracts
- `validation`
- `repairBudget`
- `persistence`
- `stopReason`
- `nextAction` and optional continuation reference

The envelope does not contain a PPF snapshot, Story Decision payload, BUZZ transcript, model prompt, hidden reasoning, credentials or raw story text.

## Existing owners remain authoritative

The lifecycle envelope composes references; it does not copy or replace domain state.

Examples of existing authoritative contracts include:

- Autonomous Guest authority: `core/auth/autonomous-guest/guest-authority.ts`
- Guest durable task state and retry policy: `build/autonomous-guest/task-lifecycle.ts`
- Responsibility Run state and limits: `lib/agents/responsibility/responsibility-runs.ts`
- Human PPF revision proposal/apply authority: `lib/projects/persistence/project-revisions.ts`
- Delegated autonomous Story Decision authority: `core/story-workflow/story-decisions/autonomous-authority.mjs`
- Delegated Story Decision operation and Workbench handoff: `core/story-workflow/story-decisions/autonomous-operator.mjs`
- Story Workbench validation/apply semantics: `modules/story-workflow/workbench/workflow.ts`
- provider protocol/health policy: `lib/runtime/provider-harness.ts`
- deterministic verification/finding authority: `scripts/full-verification-graph.mjs` and `scripts/verification-findings.mjs`
- evidence-learning durable admission: `build/autonomous-guest/maintainer/durable-knowledge-store.mjs`
- BUZZ history/context boundaries: `build/buzz/buzz-specialist-gateway.ts`

`contractRefs` are the handoff mechanism for these owners. The lifecycle contract does not translate their internal enums into a second source of truth. The authority gate decides whether a requested lifecycle action is compatible with the actor and current envelope, then hands permitted work back to the existing owner.

## Authority structure

Human, Guest, agent and system actors use the same actor shape but retain explicit permission differences.

A Human actor must carry a Human profile reference. A Guest actor must be explicitly delegated and cannot carry a Human profile identity. Agent and system actors carry their own authority references. The lifecycle contract describes authority; it does not grant new authority.

The shared authority decision vocabulary is intentionally small:

- `observe`
- `propose`
- `execute`
- `use-evidence`
- `transition`
- `persist`
- `continue`
- `change-authority`

Observe and proposal rights do not imply execution or persistence rights. Execute requires an explicit capability reference already present in the lifecycle envelope. Evidence may influence later reasoning only when referenced by the run, and that decision explicitly grants neither durable knowledge nor operational authority.

`change-authority` is always denied to lifecycle actors. A Guest, Sage, another agent or a system worker cannot promote itself, convert itself into a Human actor or widen its own capabilities through lifecycle state.

## Persistence and approval boundaries

Persistence remains a projection to an existing owner; the lifecycle gate never writes the durable store itself.

- `none`, `evidence`, and `durable-non-canon` may be handed to their existing owner only after the lifecycle has an approved persistence decision and, for persistent state, approval provenance.
- `durable-knowledge` requires a matching server-owned `plotpickle-maintainer-harness-approver` policy approval. The proposing Guest or agent cannot approve its own durable learning. Durable admission explicitly grants no operational authority.
- Human `canonical-project-state` persistence may use the existing explicit Human writer approval route and PPF revision writer.
- A delegated autonomous Guest may use the already-existing Story Decision → validated Story Workbench canonical route only when the server-owned run policy enabled that exact autonomous run/project, the actor remains non-Human, the Workbench validation completed, the approval/evidence references match the lifecycle envelope and the run/operator/project identities match. This is autonomous policy approval, not Human approval, and grants no broader operational authority.

A Guest cannot borrow a Human writer approval reference. Likewise, a generic agent or arbitrary harness approval cannot stand in for the specific delegated Story Decision/Workbench route.

Autonomous policy approval and Human approval are deliberately separate result fields. A policy-approved autonomous persistence decision is never described as Human-approved.

## Reconnect and continuation

A resumed run may continue through its recorded `nextAction`, but reconnect cannot alter the actor snapshot. Actor ID, kind, authority class, delegation, Human profile reference, operator and authority reference must remain identical. A reconnect that changes any of those fields fails closed as an authority mismatch.

This prevents a delegated Guest run from resuming as a Human, a broader agent class or another operator simply because durable task state survived restart.

## Validation and repair

Validation is a projection of existing deterministic authority. Any validation result other than `not-run` requires an authoritative validation reference. An AI worker cannot make its own result authoritative by putting `pass` in this envelope.

Repair carries only `attempts` and `maxAttempts`. Attempts cannot exceed the budget. The only repair loop in the stage graph is Validate/Repair back to Create/Execute, followed by a required return to Validate/Repair. The authority gate additionally denies that backward transition once the repair budget is exhausted, so an actor cannot re-enter execution by replaying the structurally valid edge forever.

Slice D (#1648) maps existing BEN, LEARN, Visual Readiness, autonomous QA, architecture, Story Workbench/Decisions, Windows packaging and Full Verification owners into `core/lifecycle/lifecycle-validation.mjs`. It records check identity, exact revision/head, authoritative rerun and stable failure fingerprints without replacing those validators. The same deterministic check must verify a repair on a fresh exact revision/head, and blocked/repeated/churning failures stop.

## Autonomous reference proof

Slice E (#1649) projects the existing one-command Afterglow controller through this lifecycle; it does not add another route orchestrator. `scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs` still owns the reference execution and still calls the registered autonomous route runner.

The lifecycle projection in `lib/verification/autonomous-reference-lifecycle.mjs` accepts completion only when existing evidence proves:

- immutable Afterglow Library bootstrap and canonical project/revision identity;
- delegated Guest authority with no Human profile identity;
- a real Story Decision and validated Story Workbench apply through the existing delegated policy;
- deterministic route/contract validation;
- bounded failure/stop behavior from the existing autonomous convergence/restart contract;
- a durable Guest route task surviving application restart;
- post-restart Decision/task continuity without a second apply;
- a packaged result and valid continuation reference.

The seven lifecycle stages are therefore a projection of a real existing PlotPickle journey, not a demonstration-only execution path.

## Persistence classes

The lifecycle contract uses a small classification so handoffs cannot confuse different durable stores:

- `none`
- `evidence`
- `durable-non-canon`
- `durable-knowledge`
- `canonical-project-state`

A persistent projection references its existing owner. Approved durable knowledge and approved canonical project state require explicit approval provenance. The lifecycle envelope never performs the write itself.

## Six-domain ownership

The field ownership projection does not duplicate authority:

- Core: run/project identity, lifecycle stage/transition, actor/authority description, persistence-decision projection and lifecycle authority decision gate
- Story: intent and plan/decision references
- Intelligence: capability references and bounded reasoning over approved evidence
- Community & Integrations: integration references
- Experience: presentation/continuation projection
- Platform: evidence, validation and repair projection

The subsystem that owns a referenced record remains the source of truth for that record.

## Versioning and compatibility

Schema version 1 is strict. Unknown or unsafe payload fields fail closed. The exported version policy records the current/supported version and requires either compatible additive evolution or an explicit versioned adapter for future changes. Existing subsystem contracts do not need to migrate because this envelope references them rather than replacing them.

## Privacy and safety

The contract rejects credential/private-key fields, hidden reasoning/scratchpad/transcript fields, prompts and raw story-text fields. Intent, context, inputs, outputs and evidence are references rather than embedded private content. This keeps lifecycle state inspectable without turning it into another private-data store.

## Stopping rule

#1647 ended with the shared schema and transition rules. #1646 established the deterministic Core-owned authority decision gate. #1648 integrated deterministic validation and bounded repair. #1649 proves the existing autonomous Guest journey and composes its already-existing delegated Story Decision/Workbench authority rather than replacing it. #1650 projects plain-language status; #1651 retires only proven duplicates.