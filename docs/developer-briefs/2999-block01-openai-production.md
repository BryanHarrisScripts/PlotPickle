# #2999 — Story Architect Block 01 diagnosis and configured OpenAI writing production

## Human authority and observed failure

October 15, 2026: two real Windows Brotherly Love Block 01 local Qwen2.5-Coder:7B production attempts could not save an assessment. One new protected task persisted a reservation but returned the generic Pi Durable scheduler stop. No source-bound artifact, semantic review or candidate was observed. Do not present reservations as completed model requests or blame Qwen without actual runtime evidence.

The Human confirmed OpenAI API is authorized for Story Architect analysis, writing and narration, accepts paying the provider bill, and explicitly rejects a mandatory $0 production compute ceiling or extra dollar-budget input. MiniMax H3 remains video-only for the later production stage; it is not a text fallback.

## Scope and same-owner fix

- Preserve existing encrypted tasks, reservations and source identity. Failures expose safe host-authored codes, never raw provider errors or private story.
- In production CMD, `PlotPickle produce Block 01` uses the configured approved provider, including official OpenAI text API when configured. `PlotPickle produce Block 01 local` stays local-only. Assessment `assess Block 01 local` stays local-only. Status/resume/cancel are task-scoped and remain explicit.
- Reuse `/api/outline/tasks`, its authentication/CSRF, `configuredOutlineExecution`, Mastra, Pi Durable, the active PPF and `createOutlineTaskController`; no second workflow owner.
- Reuse bounded two-stage Story Architect assessment followed by distinct seven-dimension fidelity schema. Allow a new scoped OpenAI cloud-capable production grant; never mutate the expired historical local grant. New work is restricted to a single Block, two outer inference calls, a ten-minute grant, conservative tokens and provider-identity binding, no canonical approval, no image/video spending.
- Internal `cloudCostUsd` stores conservative reservation accounting, not proof of an actual provider invoice. Provider billing is outside PlotPickle's measured ground truth; no cost claim based on reserved attempts. The Human's permission to incur OpenAI writing charges does not authorize model or media fallbacks.
- Official OpenAI connection must have the same provider and baseUrl as configured in Writing settings, with HTTPS api.openai.com and stored API credentials. A provider-settings/route change invalidates the task's compute receipt. Other cloud providers retain explicit quote requirements.
- Failure reporting differentiates host-recognized schema/context/usage faults, timeout, cancellation, and unknown private error; avoid blind retry advice; surface expired grant and confirmed usage separately from reserved attempts.

## Acceptance and verification

A. Existing local grant remains zero-spend and cannot be promoted to a cloud task.
B. A new OpenAI task may reserve bounded paid writing calls with explicit configured route; no mandatory $0 limit, no $ budget dialogue.
C. Exact project material/identity, current saved profile, CSRF, host caps and source evidence hold for both stages.
D. Result validation persists true assessment and seven-dimension semantic review and a noncanonical four-Mini-Block candidate; does not accept Plans, rewrite screenplay or authorize MiniMax media.
E. Status never calls a reservation a successful model inference; expired task cannot claim resume.
F. Synthetic regression/negative tests, governed test catalogue, UAT, build, independent convergence, exact-head PR/Product gates. Live authenticated Brotherly Love Windows/provider result remains unproven until the user can run the repaired version and verify its result.

## Relationship to #3000

The Human also requested equivalent Local, Cloud and Hybrid/Connections operations from CMD. Tracked separately as #3000; do not embed a parallel provider settings interface into this production repair.
## October 15 follow-up — host execution status must be truthful (first bounded repair)

Authenticated Windows CMD `PlotPickle assess Block 01 local` returned `UNCLASSIFIED_PRIVATE_FAILURE` with 0/1 accepted results. Outline Assessment History showed two stopped tasks with `run.state = working`, `running = false` and `resumeRequired = true`, both labelled `Story Architect · working`. This is a reproducible presentation error independent of the private root cause. Earlier cancelled tasks, source material and reservations must remain untouched.

Implementation slice: share a pure runtime-vs-durable-state status projection via `modules/plan/assessments/outline-task-selection.ts`, read it from `app/skin-v1/story-card-foundation-board.tsx`; test stopped/faulted/paused/running/cancelled cases in the existing #2995 governed test suite with its test-catalogue digest and W8/W9 binding. `running` means host execution; persisted `working` by itself does not. Do not change resume/cancel authority, start an inference, or disclose raw fault text. Run exact-head CI including Windows product gate before merging. This repair only fixes a truthfully observable status label; #2999 remains open until private checkpoint fault diagnosis and actual saved assessment are independently proven. Full Command story-production follow-up is #3004.

## October 15 follow-up — repair admitted-but-not-driven Pi Durable production scheduler

Source audit found a concrete mismatch: `scripts/pi/durable/story-architect-proof.mjs` explicitly calls `harness.resume()` after `registration.admit()` and before `harness.waitForTask()`. Production in `build/projects/outline-task-gateway.ts` admitted the protected Pi task and immediately awaited `waitForTask()` without ever resuming the harness. Admission is an authority/checkpoint operation, not proof that Pi's task runner is executing. Both local Qwen and cloud OpenAI authentic Windows runs stopped with `UNCLASSIFIED_PRIVATE_FAILURE` and no admitted model artifacts; the protected root cause still requires actual Windows checkpoint observation. Never infer actual dispatch or charges from reservations.

Implementation: one minimal `driveAdmittedOutlineCheckpoint` adapter under `core/sidecars/tasks/` calls existing host-controlled `registration.admit`, then explicitly starts the task-local `harness.resume()`, then observes `waitForTask`. Production reuses it. Admission rejection must not resume the harness. No schema, writer authority, budget, selected route, model credential, PPF material, existing checkpoint or protected error is modified. Synthetic fail-closed regressions plus existing native Pi Durable end-to-end proof and exact-head Windows CI gates are mandatory. This fixes a verified source-level execution omission; it is not a claim that the private OpenAI failure is fully diagnosed or that Brotherly Love has passed a live production run.

After merge, deploy and restart the updated Windows runtime; inspect the historical failed task read-only. Only with proper Human authority and explicit charge boundaries may the Human initiate a **new** separately identified Block 01 pass. Acceptance: one real, source-linked assessment, seven-dimension semantic review and four-Mini-Block unapproved candidate persisted and re-read, or a precise safe BLOCKED/FAULT result. Preserve existing attempts and distinguish reserved from provider-confirmed usage.

## October 16 bounded successor — durable, safe execution-stage receipts and truthful CMD fault categories

A source audit uncovered a real diagnostic bug in `modules/plan/assessments/outline-task-selection.ts`: the expression `faultCode || timeoutMatch ? HOST_TIMEOUT : UNCLASSIFIED` falsely promoted any recognized scheduler fault to `HOST_TIMEOUT`. Correct this with independent fault and timeout conditions and an exact allowlist. Never echo arbitrary Pi/provider exceptions.

To make the next *explicitly authorized* Brotherly Love run diagnosable without leaking the screenplay or credentials, preserve an optional per-attempt `checkpointStage` in the existing encrypted Outline task record: `reservation-persisted`, `worker-callback-entered`, `usage-reported`, `result-processing-entered`, `assessment-saved`, `semantic-review-saved`. Each transition is persisted by the current authenticated controller at the stage it proves. **worker-callback-entered** does not establish actual HTTP transmission or model billing; **usage-reported** is only the existing hosted usage callback, not provider invoice proof. No new context, PPF, token, credential, media, API route, cost authorization or remote tracing store is added. When a historical task has no stage, display `NOT_CAPTURED_LEGACY`.

Add synthetic negative and positive host tests under the existing White Paper v3 W8/W9 truth catalogue: callback throws private error after durable stage checkpoint, usage reported but schema invalid, successful two-call candidate persists both stages, read-back survives reopening; exact fault-code vs actual timeout is asserted. Model reservation and persisted stage are never counted as paid requests. No new inference or expired-grant recovery is initiated in this PR. Preserve issue #2999 as open pending real authenticated Windows protected task diagnosis and a new source-bound saved candidate. #3004 still owns the subsequent Outline/Storyboard/Previs/Timeline/Rough Cut workflow.
