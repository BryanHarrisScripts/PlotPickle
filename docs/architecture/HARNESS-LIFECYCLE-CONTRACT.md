# PlotPickle Universal Lifecycle Contract

Issue #1647 implements Slice B of #1644. The contract is intentionally smaller than an orchestrator. It is a Core-owned envelope and transition vocabulary that existing PlotPickle owners may project into and out of without moving their authority.

The executable contract lives at `core/lifecycle/lifecycle-contract.mjs`.

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
- Responsibility Run state, limits and writer gate: `lib/agents/responsibility/responsibility-runs.ts`
- PPF revision proposal/apply authority: `lib/projects/persistence/project-revisions.ts`
- provider protocol/health policy: `lib/runtime/provider-harness.ts`
- deterministic verification/finding authority: `scripts/full-verification-graph.mjs` and `scripts/verification-findings.mjs`
- evidence-learning durable admission: `build/autonomous-guest/maintainer/durable-knowledge-store.mjs`
- BUZZ history/context boundaries: `build/buzz/buzz-specialist-gateway.ts`

`contractRefs` are the handoff mechanism for these owners. Slice B does not translate their internal enums into a second source of truth. Later slices may add small adapters that project existing state into this envelope.

## Authority structure

Human, Guest, agent and system actors use the same actor shape but retain explicit permission differences.

A Human actor must carry a Human profile reference. A Guest actor must be explicitly delegated and cannot carry a Human profile identity. Agent and system actors carry their own authority references. The lifecycle contract describes authority; it does not grant new authority.

Slice C (#1646) owns applying this shared description consistently to concrete Human, Guest, Sage and other agent routes.

## Validation and repair

Validation is a projection of existing deterministic authority. Any validation result other than `not-run` requires an authoritative validation reference. An AI worker cannot make its own result authoritative by putting `pass` in this envelope.

Repair carries only `attempts` and `maxAttempts`. Attempts cannot exceed the budget. The only repair loop in the stage graph is Validate/Repair back to Create/Execute, followed by a required return to Validate/Repair.

Slice D (#1648) owns connecting the existing BEN, LEARN, Visual Readiness, QA, architecture, story and packaging gates to these fields.

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

- Core: run/project identity, lifecycle stage/transition, actor/authority description, persistence-decision projection
- Story: intent and plan/decision references
- Intelligence: capability references
- Community & Integrations: integration references
- Experience: presentation/continuation projection
- Platform: evidence, validation and repair projection

The subsystem that owns a referenced record remains the source of truth for that record.

## Versioning and compatibility

Schema version 1 is strict. Unknown or unsafe payload fields fail closed. The exported version policy records the current/supported version and requires either compatible additive evolution or an explicit versioned adapter for future changes. Existing subsystem contracts do not need to migrate in Slice B because this envelope references them rather than replacing them.

## Privacy and safety

The contract rejects credential/private-key fields, hidden reasoning/scratchpad/transcript fields, prompts and raw story-text fields. Intent, context, inputs, outputs and evidence are references rather than embedded private content. This keeps lifecycle state inspectable without turning it into another private-data store.

## Stopping rule

#1647 ends when the shared schema and transition rules are deterministic and exact-head green. It does not migrate every agent or workspace. #1646 and #1648 own authority and validation integration; #1649 proves the real Guest journey; #1650 projects plain-language status; #1651 retires only proven duplicates.
