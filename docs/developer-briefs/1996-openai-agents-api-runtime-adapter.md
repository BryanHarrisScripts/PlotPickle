# Developer Brief: OpenAI Agents API Runtime Adapter

Issue: #1996

## Goal

Evaluate OpenAI's Agents API as an optional cloud Agent runtime behind PlotPickle's existing Agent compute/provider boundaries.

This is not a migration of PlotPickle Agents to OpenAI, not a replacement for the current embedded runtime, not a new Agent registry, and not a transfer of deterministic PlotPickle authority into a model harness.

The governing architectural rule is:

> PlotPickle owns the Agent, job, story/project context, authority, deterministic evaluation, provider policy and UX. The Agent runtime is replaceable infrastructure.

Official reference reviewed: https://openai.com/index/introducing-the-agents-api/

OpenAI announced the Agents API on September 10, 2026 as a public beta. The current API exposes the Codex harness as a managed service with long-session context management, tool search/programmatic tool calling, MCP/custom/built-in tools, subagents, and selectable execution environments. OpenAI currently states that developers may use an OpenAI-hosted sandbox, their own infrastructure, or supported environment providers, and that there is no separate Agents API fee beyond consumed model/tool usage.

Because the API is public beta, beta-specific schemas must remain isolated inside the adapter and must not leak into core PlotPickle Agent, PPF, LEARN, STORY or BUZZ contracts.

## Existing PlotPickle authority to preserve

The repository already has the correct conceptual boundary:

- `build/agent-compute-gateway.ts` owns Human-facing PlotPickle Agent compute assignment/readiness.
- `build/agent-compute-store.ts` owns protected local assignment persistence.
- `build/writing-assistant-gateway.ts` owns the current text/Agent execution route.
- `build/mastra-agent-runtime.ts` owns current embedded PlotPickle Agent roles.
- `lib/agents/agent-profiles` owns canonical Agent profiles and execution ownership.
- `modules/creative-room/curriculum-guide.ts` and the Sage modules provide an existing bounded embedded Agent contract.
- Local Story Mode / Cloud Story Mode own provider/model configuration.
- Settings / Agents owns global default plus per-Agent compute assignment.
- BUZZ-managed Agent runtime/provider ownership is separate and stays outside PlotPickle Agent compute.

The #1847/#1848/#1849 architecture already establishes that provider/model setup belongs to Story Mode and that Settings / Agents assigns already-configured compute to embedded PlotPickle Agents. It also requires explicit failure rather than silent fallback when a pinned provider becomes unavailable.

Issue #1996 extends that architecture rather than creating a second one.

## Critical invariant: provider is not runtime

Do not overload the existing `openai` provider value to mean `use Agents API`.

Provider/model answers which model compute is being used. Agent runtime/harness answers which execution harness coordinates context, tools, sessions and subagents.

Conceptually:

```text
PlotPickle Agent Profile
 -> PlotPickle Agent Contract / Job
 -> Agent Compute Resolver
      -> provider/model: local / ollama / openai / minimax / gemini
      -> runtime: native/direct / openai-agents / future adapters
```

The first implementation may restrict `openai-agents` to a ready OpenAI provider/model route. That compatibility belongs in capability validation, not Agent identity or story/business logic.

All existing assignments continue to mean the current native/direct route unless the Human explicitly selects another proven runtime.

## Why evaluate the Agents API

The spike should determine whether OpenAI's managed harness removes infrastructure PlotPickle would otherwise need to build or maintain while preserving PlotPickle's authority model.

The highest-value capabilities to evaluate are:

### Long-running sessions and context compaction

Potentially useful for Agents that work through lengthy story or learning sessions. Runtime continuity must never become a second source of story/canon truth.

### Tool search and programmatic tool calling

Potentially avoids loading PlotPickle's growing capability catalog into every Agent turn and may improve context/token efficiency. Only PlotPickle-approved capabilities may be exposed.

### MCP support

Potentially useful for presenting narrow PlotPickle-owned capabilities through a standard tool boundary without creating another product authority layer.

### Subagents

Potentially useful for independent analysis lenses such as structure, continuity and reader response. The parent runtime may coordinate their work, but PlotPickle still owns deterministic evaluation and Human-facing authority.

### Managed execution environments

Potentially useful for selected cloud tasks that need temporary files/code/artifacts. Any environment remains explicit, bounded and opt-in.

## Locked authority model

PlotPickle remains authoritative for:

- Agent identity and Agent Profile;
- role/job definition;
- PlotPickle-owned instructions and skill contracts;
- Human-selected provider/runtime policy;
- PPF/project/canon truth;
- Context Engine selection and knowledge boundaries;
- capability grants;
- deterministic rules, validation and scoring;
- LEARN curriculum authority;
- STORY mechanical authority;
- generated-vs-accepted provenance;
- Human creative authority;
- UX and cloud disclosure;
- cost/availability policy;
- success/failure evidence.

The Agents API may execute, reason, compact runtime context, discover explicitly permitted tools and coordinate bounded subagents. It may not redefine those authorities.

## Session and canon boundary

An Agents API session is runtime state, not PPF canon.

If persistent session identifiers are used:

- store only the minimum mapping needed to resume the Agent;
- keep the mapping in protected local runtime/application state rather than story canon;
- scope it so one project/Agent session cannot inherit another project's context;
- provide deterministic reset/recreate semantics;
- do not serialize remote runtime internals into PPF;
- remote runtime memory is never proof that a story fact was accepted;
- only existing PlotPickle transitions may admit generated material into durable story/project state.

Before a live cloud call, preserve the existing PlotPickle disclosure/consent boundary for project material leaving the computer. Send only the bounded context needed for the current job.

Retention/deletion semantics must be checked against current Agents API beta documentation during implementation rather than assumed here.

## Capability boundary

Runtime capability does not equal PlotPickle permission.

- Tools come from an explicit PlotPickle-approved capability set.
- No capability becomes available merely because the runtime supports MCP or tool search.
- Initial live phases remain read-oriented and non-mutating.
- Remote execution receives only explicitly selected context/resources.
- Subagents inherit a subset of the parent PlotPickle capability scope, never more.
- Runtime/provider failure must be visible and must not silently change compute routes.

## Observability contract

Runtime use must be observable without persisting hidden model reasoning.

Record structured operational evidence such as:

- PlotPickle Agent/profile ID;
- resolved provider/model;
- resolved runtime (`native/direct` or `openai-agents`);
- session create/resume/reset state;
- permitted tools used;
- subagent count and role labels;
- elapsed time;
- usage/cost fields when returned;
- environment type;
- final success/failure/cancelled state;
- deterministic PlotPickle evaluation result where applicable.

## Reference vertical slice

Use one existing embedded PlotPickle Agent contract for the first live proof. Prefer the current Sage/Curriculum Guide path because it is bounded, read-oriented and already covered by focused tests.

This use of Sage is a transport/runtime proof only. It must not implement or alter #1918 Phase 8 journey awareness, Phase 9 Agent lenses, curriculum authority, progression logic or LEARN UI.

Reference flow:

```text
Existing Sage request
 -> existing bounded curriculum/project context
 -> PlotPickle Agent compute resolver
 -> OpenAI Agents runtime adapter
 -> Agents API session
 -> final Agent answer
 -> existing PlotPickle response contract
```

The caller should not need to know the Agents API was used except through explicit runtime/status diagnostics.

A later bounded subagent proof may use a DraftLens/Reader Simulation style review because parallel specialist contexts may be valuable there. Do not make that a dependency of the first single-Agent proof.

## Progressive implementation plan

### Phase 0 — Contract and beta isolation

No live Agents API call.

- Add/ratify the runtime-neutral Agent execution request/result contract.
- Lock `provider != runtime` as an invariant.
- Define a runtime capability descriptor for sessions, tools, MCP, subagents and environment support.
- Define `native/direct` as the current default runtime.
- Define `openai-agents` as optional/not-ready until proven.
- Keep OpenAI beta request/response types inside the adapter.
- Define session scope, reset and local persistence semantics.
- Define outbound story-data/privacy boundary.
- Define no-silent-fallback behavior.
- Add focused contract tests before network implementation.

Exit: PlotPickle has a runtime seam with zero current behavior change.

### Phase 1 — Adapter skeleton and mocked contract

- Implement the OpenAI Agents adapter behind the Phase 0 seam.
- Keep it unreachable from normal Settings/UI.
- Use mocked fixtures only.
- Map PlotPickle Agent request into the Agents API without leaking beta types into callers.
- Map final result/error into the existing PlotPickle Agent result contract.
- Prove existing direct/local/Ollama/OpenAI/MiniMax/Gemini behavior is unchanged.
- Prove unsupported provider/runtime combinations fail explicitly.
- Prove no fallback to another route.

Exit: adapter shape is testable with zero paid calls and zero Human-facing behavior change.

### Phase 2 — Explicit live single-Agent transport probe

- Add a developer-only/explicit opt-in live path.
- Use one existing Sage/Curriculum Guide request.
- Use the smallest useful bounded context.
- Use a ready OpenAI provider/model route only.
- Start with the simplest safe supported environment and no unrelated local resources.
- Return through the existing Sage/Agent response contract.
- Record operational evidence and usage.
- No new UI, PPF mutation, tool calling or subagents.

Exit: one existing PlotPickle Agent can run through Agents API without product authority changing.

### Phase 3 — Session durability and context proof

- Create/resume the same bounded Agent session across multiple turns.
- Prove project/Agent scoping prevents cross-project context leakage.
- Exercise long-session/context-compaction behavior where practical.
- Prove PlotPickle can reset the runtime session deterministically.
- Prove story/canon truth still comes only from PlotPickle state.
- Compare observed context/token behavior with native/direct.

Exit: durable runtime context is useful without becoming a second memory/canon system.

### Phase 4 — Tool search / MCP with one read-only capability

- Expose exactly one safe read-only PlotPickle-owned capability.
- Prefer a deterministic query capability.
- Exercise tool discovery/tool search instead of shipping an unrestricted tool catalog.
- Prove an ungranted capability cannot be used.
- Bound tool output before it re-enters Agent context.
- Prove tool failure does not widen permissions.

Exit: tool discovery provides measurable value without weakening PlotPickle capability boundaries.

### Phase 5 — Bounded subagent proof

Only after Phases 2–4 are clean.

- Select one review workload that benefits from independent specialist analysis.
- Recommended shape: parent review Agent delegates bounded structure, continuity and reader-response perspectives.
- Cap concurrent subagents tightly.
- Give each subagent minimal context and a strict role/output contract.
- Subagents cannot gain broader capabilities than the parent.
- Parent may synthesize evidence, but deterministic PlotPickle evaluation remains outside the runtime.
- Compare latency, usage/cost and output value with the existing native/sequential pattern.

Exit: measured evidence shows whether managed subagent orchestration is worth adopting.

### Phase 6 — Reliability, cancellation, cost and environment policy

- Define timeout and cancellation semantics.
- Handle network/runtime failure.
- Handle public-beta/API incompatibility fail-closed.
- Ensure retries/idempotency cannot duplicate side effects.
- Surface provider/runtime unavailable states truthfully.
- Capture usage/cost evidence where available.
- Define per-session limits for subagents, tool calls and runtime duration.
- Compare hosted vs PlotPickle-owned environment only if a concrete product need appears.

Exit: adapter has acceptable production failure boundaries or the experiment is rejected.

### Phase 7 — Human-facing runtime selection only if the spike passes

Do not expose Settings/UI merely because the API works.

If Phases 0–6 prove sufficient value:

- Extend PlotPickle Agent compute presentation to distinguish Provider from Runtime.
- Preserve `native/direct` as the compatibility default.
- Expose `OpenAI Agents` only when OpenAI and the adapter are ready.
- Permit default/per-Agent runtime override only where supported.
- Make cloud/hosted-runtime status visible before use.
- Preserve Skin V1 keyboard behavior.
- Keep BUZZ-managed Agents outside this configuration.
- Selecting a runtime must not silently change provider/model or paid-route authority.

Exit: the Human can deliberately opt an eligible PlotPickle Agent into the runtime without confusing provider, model and harness.

## Evaluation criteria

A working API call alone is not success.

Evaluate:

- custom orchestration/context code avoided;
- long-session continuity quality;
- context/token efficiency from compaction/tool search;
- latency;
- cost;
- reliability/recovery;
- usefulness of subagent fan-out;
- preservation of local-first/provider-independent architecture;
- observability;
- capability isolation;
- maintenance complexity caused by public-beta churn.

## Acceptance criteria

1. Provider/model selection remains distinct from Agent runtime selection.
2. Existing current runtime behavior remains `native/direct` by default.
3. OpenAI Agents API implementation is isolated behind one runtime adapter boundary.
4. OpenAI beta schemas/types do not leak into canonical Agent, PPF, LEARN, STORY or BUZZ contracts.
5. Existing local/Ollama/OpenAI direct/MiniMax/Gemini routes remain behaviorally compatible.
6. BUZZ-managed Agents remain outside PlotPickle Agent runtime configuration.
7. Live calls are explicit opt-in and use bounded disclosed project/story context.
8. Remote session state never becomes PPF/canon authority.
9. Sessions are correctly scoped and resettable with no cross-project/Agent leakage.
10. Tools are allow-listed by PlotPickle capability, not automatically exposed by runtime support.
11. Subagents cannot exceed parent capabilities.
12. Runtime/provider failure never silently changes compute route.
13. Structured observability reports runtime/provider/model/session/tool/subagent/usage/final state without storing hidden reasoning.
14. Deterministic PlotPickle evaluation and canon admission remain outside the Agent runtime.
15. Human-facing runtime controls appear only after the spike proves value and readiness.
16. Focused contract and safety tests pass.
17. Existing #1847/#1848/#1849 Agent compute/settings regressions remain green.
18. Exact-head required GitHub gates are green before implementation phases merge.

## Non-goals

- migrating every PlotPickle Agent to Agents API;
- immediately replacing Mastra;
- removing local/Ollama execution;
- removing MiniMax or Gemini support;
- making OpenAI the only Agent provider;
- changing BUZZ-managed Agent ownership;
- implementing #1918 Phase 8 or Phase 9 inside this spike;
- changing Sage curriculum/learning authority;
- changing PPF/canon authority;
- changing STORY deterministic game authority;
- broad UI work before runtime proof;
- automatic compute fallback;
- storing remote Agent memory as canonical story truth;
- treating public-beta availability as a commitment to production adoption.

## Sequencing / roadmap rule

Creating #1996 does not interrupt the current PlotPickle roadmap. Keep it as a bounded architecture spike in the backlog until the Human explicitly schedules it.

When scheduled, build and merge one phase at a time:

`Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> optional Phase 7`

Stop after any phase if the adapter adds more architectural complexity than it removes or weakens PlotPickle's local-first/Human-authority boundaries.

Do not bundle this work into #1918, STORY #1675, BUZZ, or unrelated Settings work.
