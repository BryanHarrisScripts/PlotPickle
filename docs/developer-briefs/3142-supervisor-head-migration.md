# #3142 — Safe supervisor revision migration after a governed main sync

The Windows Software Factory now has explicit separate local Human PAUSE/RESUME, a profile-gated Settings view, a non-pretending STOP request and an opt-in user-owned at-logon Task Scheduler installer. However the supervisor's `enabled.json` is pinned to the SHA at first enable, so a normal clean `factory-sync-main` can leave the scheduled control supervisor permanently blocked on `STALE_SOURCE_HEAD`.

## Bounded remedy

`node scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs --migrate --from <old-40-character-sha> --consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR` is a distinct **local operator CLI action**, not invoked automatically after source sync. Requires exact saved old SHA, the original paired host/actor, clean `main`, verified repository origin, actual new SHA with old SHA an ancestor. The local check invokes read-only `git` inspect operations only. Existing consent remains mandatory and the new run must be explicitly authorized by the Human.

An exclusive service.lock prevents racing with an already running or starting supervisor, and any prior lock (including malformed/stale), STOP marker or PAUSE marker refuses migration. A recent RUNNING/PAUSED/BLOCKED heartbeat or corrupt heartbeat refuses migration. An immutable per-old/new revision evidence receipt is created with `workerStarted:false`, `replayAuthorized:false`, `permissionChanged:false`. The existing enabled record is replaced atomically, preserving pairing, original authorization time and all no-model/no-merge permissions. The previous enabled record's identity survives in the immutable receipt. Job/worktree/reservation records are untouched. The old heartbeat does **not** prove new process health and returns OFFLINE on new source. The operator must start the already separately installed supervised task via its existing approved local command; this operation does not start any worker.

This is an offline source-identity migration only, not a retry or reenable after STOP, nor a GUI mutation. A failed/uncertain receipt is review-required rather than automatically replayed. The native Windows CI fixture uses an isolated private filesystem and injects verified Git identity; it cannot attest the owner's real paired service, Task Scheduler login/reboot, process descendants or GUI clickstream.

## Proof and acceptance

- Exact-head runtime tests validate no automatic enable/spend/merge, immutable receipt, same host and actor, STOP/PAUSE, existing or malformed service lock, real heartbeat freshness, verified fast-forward checkout and no-replay.
- W8/W9 binds the changed supervisor and tests plus Windows impact selected gate; seven architecture layers and native Windows suite must pass.
- `#3142` remains OPEN for actual owner-initiated migration, real Windows task installation/start/reboot persistence, independently verified PID-tree/sentinel STOP, true GUI/CMD operational parity, and the ChatGPT-only issue dispatcher.

No automatic Pi queue starts or model spend is authorized.
