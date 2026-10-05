# Developer brief — Issue #2743

Parent: #2707

## Outcome

Finish PlotPickle's governed Agent durability rollout by making the already-proven lifecycle visible in Settings → Agents, recording exactly which roles are adopted, and locking recovery/maintenance semantics without changing execution authority.

The final supported durability surface is intentionally bounded:

- Story Architect / `elowen-mapweaver` / `story-architect`: real application close → reopen → explicit resume proof through Outline, with committed work skipped and proposals kept non-canonical.
- Mira Threadmere / `continuity`: replay-safe review checkpoint adoption.
- Critics' Circle / `critic`: replay-safe review checkpoint adoption.
- Quillan Reedcloak / `creative-director`: replay-safe proposal checkpoint adoption.
- BUZZ, UAT, deterministic and repository-handoff roles: owner-preserving reference-only handoffs; they are not migrated into Pi execution.
- All other embedded Mastra roles: explicitly not adopted by #2707. They require future role-specific replay/idempotency proof before durable resume can be enabled.

No all-Agent rollout is claimed.

## Human-facing lifecycle

The existing Responsibility Run activity becomes reachable from Settings → Agents.

The Human-facing durability projection is presentation only and never authorizes work by itself:

- `active`: this PlotPickle process owns the current bounded Responsibility Run.
- `paused`: the Human explicitly paused it; the generic Responsibility Run Resume action may resume this run.
- `interrupted`: an active Responsibility Run was persisted by a previous PlotPickle process. The generic activity surface does not pretend it can restart the owning worker. The Human returns to the owning workflow for governed resume.
- `waiting-for-writer`: a proposal/result is waiting for writer authority.
- `stale`: the run failed because project/context/revision authority no longer matches.
- `unavailable`: the run failed because its required provider/runtime is unavailable.
- `completed`, `failed`, `cancelled`: terminal presentation states.

A GET/read at startup only projects persisted state. It never performs inference, resumes a worker, changes provider/model routing or mutates PPF canon.

## Process ownership

The Responsibility Run gateway keeps an in-process ownership set only for presentation:

- runs created/started/resumed in this server process are `active`;
- active run files loaded after restart are `interrupted`;
- pause/cancel/writer-wait transitions stop being process-active;
- the persisted Responsibility Run state remains the lifecycle authority.

This session marker is not durable authority and is never used to grant resume.

## Phase 3 task-level proof

The final regression suite executes the shared `defineAgentCheckpointTask` contract for continuity, critic and creative-director:

1. execute one replay-safe step and commit its artifact reference;
2. reconstruct a fresh task definition to simulate a new worker process;
3. continue from the checkpoint;
4. prove the first completed step does not replay;
5. prove final output stays `canonical: false`;
6. prove stale/wrong role/grant/replay-policy inputs still fail closed through the adopted role contracts.

This is task/checkpoint proof. It is not a claim of real user-selected provider/hardware inference for those three roles.

## Source-backed support matrix

Update the #2707 durability audit so availability is not confused with wiring:

- `PROVEN-APPLICATION`: Story Architect only.
- `PROVEN-CHECKPOINT`: continuity, critic and creative-director.
- `OWNER-PRESERVED`: non-embedded execution owners covered by Phase 4.
- `NOT-ADOPTED`: remaining embedded roles requiring role-specific replay/idempotency work.

The audit continues to issue zero provider requests.

## Upgrade, reset and delete semantics

Durable state is protected work evidence, not cache.

- Runtime/package upgrades preserve Responsibility Run files, Pi JSONL checkpoint state and proposal references. Upgrade does not auto-resume.
- Startup never resets or deletes durable state.
- Normal Resume never resets progress.
- Reset is an explicit Human maintenance concept only; it must require a stopped/terminal task and must not alter project/PPF canon.
- Delete is an explicit Human maintenance concept only; there is deliberately no generic Delete control in Responsibility Run activity.
- Cancelled/completed/failed terminal work cannot silently restart.
- A future reset/delete implementation must use a separately reviewed protected maintenance boundary; #2743 documents policy but does not add a destructive endpoint.

## Files / authority

Expected implementation touches:

- `lib/agents/responsibility/durable-run-lifecycle.mjs`
- `build/responsibility-run-gateway.ts`
- `app/responsibility-run-activity.tsx`
- `app/responsibility-run-activity.module.css`
- `app/skin-v1/plotpickle-agents-host.tsx`
- `scripts/developer-diagnostics/agents/durability-audit.mjs`
- focused tests, convergence and verification catalog
- this brief and canonical #2707 brief status

Do not change Agent prompts, provider assignment, Mastra output schema, BUZZ ownership, deterministic gates, PPF canon authority, credentials or hidden reasoning storage.

## Acceptance

- Responsibility Run activity is visible from Settings → Agents.
- Active/paused/interrupted/waiting/stale/unavailable/completed/failed/cancelled presentation is deterministic and covered.
- Existing active run files become interrupted after process restart without inference.
- Generic Resume remains paused-only; interrupted work points the Human back to its owning workflow.
- Continuity, critic and creative-director have executable checkpoint/reopen/skip-completed-step proof.
- Audit distinguishes proven application, proven checkpoint, owner-preserved and not-adopted roles.
- Upgrade/reset/delete semantics are regression-locked and no destructive endpoint is introduced.
- Existing Story Architect real Windows close/reopen proof remains selected by the exact-head product gate.
- Focused tests, convergence, production build and all seven Architecture Verification layers pass before merge.
