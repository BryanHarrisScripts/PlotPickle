# #3142 — Authenticated MCP supervisor observation (bounded first recovery slice)

The existing `factory_status` reports the **legacy Pi queue**, not the independent Windows supervisor. Its stale heartbeat cannot answer whether the separate owner-opted-in `PlotPickleIndependentSupervisor` task is installed, has been started, or is polling. In October 2026 the authenticated tunnel was healthy while the legacy queue remained OFFLINE, five immutable reservations remained BLOCKED, and `CHATGPT_ONLY_DISPATCHER_NOT_IMPLEMENTED` was still true. The tunnel's `plotpickle-app-factory-start` is an isolated app test session, **not** the Windows supervisor start operation; `APP_START_FAILED` must not be conflated with supervisor liveness.

## This PR's deliberately narrow contract

Reuse the canonical `supervisorStatus` read-only function from `unattended-supervisor.mjs`, exposed as a strictly sanitized **nested `supervisor` field in authenticated `factory_status` only**. The four public and existing authenticated MCP tool names and argument schemas remain unchanged; unauthenticated `factory_status` does not read or disclose the supervisor. The new snapshot includes only allowlisted state/reason, a validated 40-character source SHA, an age-checked heartbeat indication, and PAUSE acknowledgment. Unknown, malformed or thrown supervisor state becomes `UNVERIFIED`; private host ID, authorized actor, paths, errors and pairing details are never forwarded.

Every snapshot explicitly returns `workerProcessVerified:false`, `autonomousCodingVerified:false`, `independentWindowsAcceptance:false`, `automaticMergeEnabled:false`, `startActionAvailable:false`, `replayAuthorized:false`. Even a fresh heartbeat is not independent OS PID-tree proof, ChatGPT-only coding, an exact-head Windows product gate, or merge authority. The read path never executes Task Scheduler, Pi, a shell, an issue retry, or a provider/model.

## Verification and remaining acceptance

Focused regression: `node --test tests/issue-3154-chatgpt-factory-mcp.test.mjs` tests authenticated vs guest access, allowlist sanitization, stale/forged heartbeat refusal, thrown-read fail-closed, and no change to the existing MCP catalog. Run the full exact-head seven-layer architecture workflow and selected native Windows lanes; cancelled/timed-out required jobs are not green. Real owner-Windows verification is separate and still required.

This does **not** install, enable, start, stop, pause or resume the supervisor. It does not prove Task Scheduler registration, running PID/descendants, Windows reboot recovery, GUI/CMD parity, a ChatGPT-only dispatcher, or any of the five blocked legacy queue attempts. The owner-only `Install-PlotPickleIndependentSupervisor.ps1 -Status` and explicit consent-bound `-Start` remain the only reviewed startup path until a separately authorized, ownership-proven authenticated lifecycle action exists. Do not repeat the already sent owner-action email absent a new distinct blocker.

Keep #3142 OPEN and preserve locked #3274 roadmap, README, source/truth admission and owner review. No changes to the legacy Pi dispatcher, user assets, registered worktrees, credentials, dependencies, storage or security #3279/#3291.

## Owner-only stage-capacity diagnostic

An authenticated `factory_status` also reads the existing fail-closed candidate-stage count policy without adding an MCP tool or executing a stage. The sanitized `stageCapacity` field distinguishes `STAGE_BUDGET_AVAILABLE`, `STAGE_BUDGET_EXCEEDED`, and `STAGE_BUDGET_UNVERIFIED`; it reveals only bounded counts and the fixed limit of three. Guest status does not read the private stage directory. Every response explicitly denies staging or cleanup authorization; disk headroom, lock ownership, Git worktree identity, process ownership, and owner-Windows acceptance remain separate checks. There is no retention cleanup or automatic retry.

## Fixed-path stage-lock observation

Authenticated status also reports a separate `stageLock` field of `HELD`, `ABSENT`, or `UNVERIFIED` using a read-only check of the existing fixed private `.candidate-stage-budget.lock` directory. This field never reveals paths, provides no cleanup/staging authority, and does not infer process ownership from a lock. Guest status does not read the lock. Missing locks do not prove staging eligibility: retained-stage count, disk capacity, candidate identity and independent owner-host acceptance remain separate gates.
