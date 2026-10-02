# Host-scoped agent checkpoints

Issue: #2709. Parent: #2707. Inventory and rollout: PR #2708.

## Goal and delivery boundary

Use the pinned Pi Durable 1.0.0 task API to save completed agent step references and resume remaining steps after JSONL close/reopen. This phase builds the shared seam and proves real storage recovery with synthetic reviews. It does not enable a Writing Assistant route, invoke Mastra, or expose a Resume button. Live specialist/provider execution and user-visible recovery remain UNPROVEN until the Phase 2 product slice.

## Owners and implementation

`core/sidecars/tasks/agent-checkpoint-task.mjs` defines the scoped input, checkpoint task and atomic admission registration. It accepts host-owned authorization and execution callbacks. Mastra remains the application worker; the host later connects its existing provider/context/profile resolver through these callbacks. Pi owns the existing scheduler and atomic JSONL storage. Responsibility runs continue to own lifecycle, budgets, context, grants and writer approval. PPF admission remains independent.

Task identity includes the human profile, project ID/revision, profile/runtime role, responsibility run ID/objective revision/context receipt, provider/model, Human task approval reference, sorted capability snapshot and ordered steps. Admission records the Pi task ID in a Pi conversation document in the same atomic commit that creates the task. Repeated concurrent admission and reopen reuse this task ID. Completed or aborted task IDs are retained rather than silently creating a second task.

Only replay-safe review/proposal steps are admitted. Host authorization checks precede each worker step and run again before result admission. Changed context, project revision, provider, capabilities, terminal/cancelled/paused runs or exhausted budget reject continuation. The host callback must resolve the actual responsibility run and remaining budgets; a persisted snapshot cannot authorize itself. A callback contract test is not proof that the application gateway implements that callback correctly.

Checkpoints contain the next step index and protected `responsibility-artifact:` references in input order. Results remain noncanonical and carry the existing deterministic authority envelope. Full prompts, story content, model responses, credentials and hidden reasoning are not included in this new checkpoint schema or proof artifact. Actual proposals must be persisted through the existing protected artifact owner before returning their reference. A corrupt checkpoint/index throws rather than resetting progress.

## Replay limit

A committed completed step is skipped after restart. An interrupted worker step that has not committed its artifact reference may run again, including another provider call; this is not exactly-once billing. Generation, publishing, game effects, canon writes and repository writes are rejected by this phase. Caller and step schemas are bounded. The host must preserve cancellation through the provided Pi/Chord context and must not create unrestricted tools or issue startup inference.

## Acceptance and verification

1. Scope/workload identity isolates projects, writers, agents, revisions, compute and grants; grants have canonical ordering.
2. Unsafe effects, duplicate steps, invalid scope/artifacts and corrupt progress fail closed.
3. Authorization runs before worker execution and after it; cancellation cannot admit the result.
4. Real Pi Durable JSONL close/reopen preserves completed artifacts and skips prior steps.
5. Concurrent/reopened admission reuses one task; a different project receives an isolated task, and cancellation prevents that worker from running.
6. Checkpoint proof issues no provider requests and records live Mastra/product recovery as UNPROVEN.
7. Focused regression, ownership/catalog validation, independent convergence, exact-head architecture verification and Windows checkpoint/product build checks pass before promotion.

Fast proof: `node --test tests/issue-2709-agent-checkpoint-task.test.mjs`.
Real persistence proof: `node scripts/pi/durable/checkpoint-proof.mjs`; it installs/reuses the existing reviewed managed Pi Durable runtime, uses disposable synthetic state, closes the harness and removes its test state. Optional `PLOTPICKLE_CHECKPOINT_PROOF_HOME` selects a reusable managed install. Evidence lives in `.artifacts/agent-checkpoint-2709/proof.json` and never contains a private project.

## Next product slice

Resolve an approved Story Architect responsibility run through the existing host gateway, store each block review in protected proposal/history storage, and expose explicitly invoked start/resume/cancel through the existing run activity surface. Revalidate project/profile/context/compute and budget ownership server-side; opaque task IDs supplied by a client do not grant authority. Prove a real configured Mastra worker and Windows launcher close/reopen before marking Story Architect recovery available. Other profiles follow only after their role-specific contracts pass.
