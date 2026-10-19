# #3110 — Persistent local Windows supervisor (controlled command transport only)

This slice adds `scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs`, a **locally opted-in, foreground resident** supervisor. A Windows operator can explicitly install an OS-owned auto-start task **later**, but there is no installer or service auto-registration in this PR. It polls the **existing paired and host-bound GitHub start/status/stop envelope** and inspects a local approved queue. The queue is *advisory only*. A ticket's self-asserted JSON grants are **not** sufficient authority to dispatch Pi, Cline, edit code, create PRs or merge.

## Local operator commands after merge

```powershell
cd C:\Users\bryan\plotpickle
git pull --ff-only
node scripts/engineering-team/windows/paired-github-control.mjs --pairing-status
node scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs --status
node scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs --enable --consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR
node scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs --serve --consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR
```

The **serve command remains running in its own PowerShell window**. Closing ChatGPT or Work does not stop that process, but closing its PowerShell window or logging off may. This version does not yet start automatically on login or recover if the PC reboots; `--status` will show **OFFLINE** when the heartbeat expires. Do not call this a fully durable OS service.

For local stop and revocation:

```powershell
node scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs --disable
node scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs --status
```

The running supervisor notices the private STOP marker before another poll and exits. After the worker exits, an intentional resume uses `--reenable --consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR`, then a fresh `--serve`. The operator can separately disable the paired GitHub route with `paired-github-control.mjs --disable` (one-way disable). Do not remove a stale lock without first confirming the old OS process is gone; the lock intentionally fails closed.

## Truth boundaries

- The private heartbeat binds exact local source SHA and the paired host/actor; on mismatch, processing stops. It reports RUNNING / BLOCKED / OFFLINE / STOP_REQUESTED instead of green by default. The heartbeat is not an independent verifier.
- One local active worker per private lock scope. No arbitrary GitHub text or remote PID reaches a shell. Only the already-reviewed bounded `pollWindowsGitHubControlOnce` route is enabled after separate local consent.
- A healthy supervisor **does not prove actual agent coding, full backlog draining or merge**. Neither the read-only queue nor a GitHub control issue becomes a new permission grant.
- Synthetic CI tests use an isolated filesystem and injected fake GitHub polling; they cannot prove actual Windows process ownership or unattended work past logout/reboot.
- Existing #3135 fixture proof demonstrates only isolated Windows tree termination. The production worker's descendants are still unverified.
- No new paid model route, automatic source mutation, remote repair, autonomous merge or story approval is enabled by this slice.

## Remaining path to the autonomous software factory

Persist through Windows login/reboot under *explicit local* scheduled-task installation; ensure crash recovery/lease ownership and robust process-tree STOP; authenticate per-issue bounded code/source/model grants independently of editable JSON; execute an isolated implementation-capable agent in clean worktree; independently run Build, BEN, W8/W9, Windows Product Gate; create and review PR exact-head; merge under delegated policy; automatically move to the next eligible issue. #3110 remains OPEN until an owner-observed end-to-end issue lifecycle runs without a Chat/Work session.
