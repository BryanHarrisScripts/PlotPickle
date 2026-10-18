# #3098 — Durable Engineering Team checkpoint and explicit recovery (increment)

Parent: #3096. This is an additional bounded slice of #3098 following merged
PRs #3097, #3101, #3102, and #3103.

## Source ownership

Engineering Team uses the EXISTING protected Pi Durable 1.3.0 seam:
core/sidecars/tasks/agent-checkpoint-task.mjs; native runtime import from
core/sidecars/pi-durable-adapter.mjs; no extra software factory or model
provider. Native Pi Durable is loaded only on an explicit --durable request,
and only if the managed 1.3.0 install is already available. No npm/install
work or inference during startup or status inspection.

The local Engine task carries a canonical host scope: OS-user pseudonym,
repository identity, exact commit, campaign/run ID, immutable context/route
receipt, explicit command authorization and read-only grants. This is LOCAL
operational identity, NOT a claim of unlocked PlotPickle application Profile
or an independent human permission grant. Real profile-bound GUI execution
is a separate later integration.

Each role maps to the existing replay-safe review step of the native durable
checkpoint registration. Pi Durable persists a source-evidence reference at
each committed step. Host code checks exact commit before and after work.
Results and local evidence are *advisory* only, never merge/release/canon
authority, regardless of Pi task success.

## Explicit command

On a clean, frozen PlotPickle checkout with existing managed Pi Durable 1.3.0
and the configured, local read-only Pi + UAT adapters:

    $head = git rev-parse HEAD
    $base = git merge-base origin/main HEAD
    node scripts/engineering-team/run-local.mjs --run --head $head --base $base --task pr-3098 --mode structured --durable

After a controlled interruption, only the Human can select the original
attempt for explicit recovery:

    node scripts/engineering-team/run-local.mjs --run --head $head --base $base --task pr-3098 --mode structured --durable --resume

No automatic replay is triggered from startup/diagnostics. A completed receipt
cannot be resumed. Reuse a completed task step from the exact same route and
scope without re-running an LLM. If a worker may have begun a model call but
its complete outcome was not durably saved, the write-once started marker
forces a BLOCKED recovery rather than a second model call. That uncertain
attempt requires a separately approved new attempt, not a silent retry.
Changing the model, executor, repository/commit or checked-out work blocks
old result admission.

Result files live under the protected private app root. The Pi Durable JSONL
storage lives inside the run's scoped private directory. All saved evidence
is capped and retains role, exact commit and route receipt. Neither model
text nor private work is posted to BUZZ, GitHub or public telemetry.

## Native runtime proof command

    node scripts/pi/durable/engineering-team-proof.mjs

This explicit test requires an already-installed managed Pi Durable 1.3.0.
It uses **deterministic fake review workers**, not a paid model. It proves
actual native JSONL admission, one committed role checkpoint, controlled
Harness close/reopen, persisted task ID, remaining role execution and no
duplicate worker callback. It reports separately:
- managed runtime close/reopen proof;
- Windows versus Linux test platform;
- no provider inference performed;
- no killed-process restart proof;
- no signed BUZZ and no GitHub verification authority.

It does not claim production Windows application/profile proof or a genuine
two-independent-model experiment. The script writes a machine-readable
proof under .artifacts/engineering-durable-3098/native-jsonl-proof.json.

## Verification / remaining blockers

Synthetic contract regressions cover stale commit, cancel, scope mismatch,
write-once ambiguity, route change, exact role ordering, no self-approval,
explicit resume and completed-run refusal, and cleanup of native scheduler.
These tests are not proof of native runtime availability.

#3098 stays OPEN until an actual Windows operator runs the native proof with
the managed runtime and a provider-backed smoke test, demonstrates unexpected
process restart and durable recovery, verifies distinct Pi/Cline execution,
and records independent deterministic verifier receipts. All later mutation
and external publication remain governed by existing PR exact-head gates.
