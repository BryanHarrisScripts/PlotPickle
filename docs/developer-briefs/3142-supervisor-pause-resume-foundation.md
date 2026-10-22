# #3142 — Pausable paired Windows supervisor (bounded first lifecycle slice)

**Status:** implementation PR candidate, not complete GUI/CMD parity, unattended ChatGPT dispatcher, or reboot-resident service.

## Authority and the existing owner

Reuse `scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs`, not the legacy Pi `autonomous-queue.mjs --serve`, as the paired-control observation supervisor. Keep explicit LOCAL_WINDOWS consent `ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR` and the original paired host, actor and exact source SHA. Do not install a task or start the old Pi worker as part of this change. GitHub issue prose remains untrusted input. No source edits, extra GitHub endpoints, model calls, spending, automatic PR merges or remote arbitrary commands.

## New bounded lifecycle

- `--pause --consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR` is write-once and exact-head/host/actor-bound. It creates a private marker for the already-enabled supervisor. PAUSE_REQUESTED explicitly **does not cancel an in-flight poll**; the resident worker acknowledges it at its next bounded cycle. The polling cadence remains unchanged. A fresh, scope-matched PAUSED heartbeat proves only the worker saw the marker—not signed device process ownership.
- The worker checks PAUSE before inspecting the advisory issue queue and checks it again before the next paired GitHub poll. While paused no new queue inspection, GitHub poll, child process or source task begins. Periodic paused heartbeats remain visible to status. A stop request takes priority over PAUSE.
- `--resume --consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR` checks the same current source SHA and pairing and rejects the stronger local STOP; it removes only the matching pause marker. RESUME_REQUESTED means an operator revoked PAUSE, **not** that a worker or coding agent actually resumed. No queued/uncertain attempt is replayed. A reboot/stale heartbeat never becomes a fabricated PAUSED/RUNNING status.
- `--status` remains the same canonical local status reading used by CMD. It distinguishes PAUSE_REQUESTED, PAUSED, RESUME_REQUESTED, OFFLINE, STOP_REQUESTED and BLOCKED, with explicit `pauseAcknowledged` / `inFlightCancellationProven:false` boundaries.
- `--disable` remains stronger and is not a benign pause; `--reenable` is still a deliberate post-STOP operator action requiring exact head/host.
- Malformed or wrong-host private pause files fail closed. The owner must handle unexpected private file corruption; no implicit data cleanup or PID-based kill is added.

## Acceptance

Existing supervisor tests plus deterministic race tests (pause arriving after queue observation, stop-before-resume, stale head/pairing, malformed private marker and crash/reboot heartbeat) and a native Windows opt-in runner fixture. Impact-selected CI must prove the exact PR head, seven architecture layers, BEN/W8/W9 and actual native Windows file/worker loop behaviour. These tests do not attest real paired-host runtime lifecycle or a true browser/CMD/GUI start→pause→resume→stop parity session. Existing Windows authenticated Story Factory 55-checkpoint success is separate evidence.

## #3142 remaining acceptance (issue stays OPEN)

Prove *real* Windows OS-owned installation/start after logon, single-instance recovery after process crash/reboot without replaying uncertain edits, bounded process-owned STOP/sentinel, and an authenticated local GUI control path using the same state machine as CMD, with Human authorization and no arbitrary PID. The first version here does **not** add a GUI, scheduling, ChatGPT wake-up or autonomous merge capability. Do not turn on the old `PlotPickleSoftwareFactory` Pi service while ChatGPT-only dispatch remains unimplemented.
