# #3142 — Factory Tunnel + Independent Windows Supervisor (without launching PlotPickle)

The authenticated Factory MCP Tunnel and the opt-in `PlotPickleIndependentSupervisor`
can run while the PlotPickle application and `http://127.0.0.1:4173` are stopped.
The tunnel's local dashboard on port 8080 is **not** the PlotPickle application.
The supervisor is a Windows scheduled task; no GUI session or foreground
`node --serve` window is needed when that task is already running.

## Two independent states (do not conflate them)

- **Independent Supervisor**: the owner-authorized Windows control observer.
  In authenticated `factory_observer`, `independentSupervisor.state=ONLINE`
  means the canonical supervisor returned RUNNING with a fresh heartbeat.
  It does **not** attest process-tree ownership, coding activity or merge.
  `canonicalState=RUNNING` preserves the source's literal state.
- **Legacy Factory**: `factory.state` and `factory.online` continue to
  describe the old Pi queue. It may correctly be OFFLINE with five immutable
  blocked reservations while the independent supervisor is ONLINE.
  `chatgptEngineering.ready` stays false until the real coding dispatcher
  is independently implemented and verified.
- A guest `factory_observer` response does not read or expose the independent
  supervisor. Authenticated `factory_status.supervisor` keeps its original
  canonical `RUNNING` / `OFFLINE` / `BLOCKED` names.
- Neither state is PlotPickle-app availability or proof of successful story
  or Windows product acceptance.

## Window 1 — start the existing Factory Tunnel

Open a **normal, non-elevated** PowerShell window:

```powershell
Set-Location C:\Users\bryan\PlotPickle
Test-Path -LiteralPath .\Start-PlotPickle-Tunnel-Authenticated.ps1
.\Start-PlotPickle-Tunnel-Authenticated.ps1
```

The launcher is owner-provisioned and may be untracked; if missing, do not
replace it with an invented launcher or another tunnel profile. At the hidden
prompt, enter only the restricted Tunnel Runtime API key. Do not paste it into
ChatGPT or a log. Wait for `PLOTPICKLE TUNNEL READY`. Keep this window open.
Inspect `http://127.0.0.1:8080/ui` for Health: live / Ready: ready;
only an authenticated ChatGPT `factory_status` call confirms remote MCP
access. Ctrl+C in the owning PowerShell window intentionally stops the tunnel.

## Window 2 — start the separately installed Windows supervisor

Do **not** start a second copy if it is already RUNNING.

```powershell
Set-Location C:\Users\bryan\PlotPickle
node .\scripts\engineering-team\windows\supervisor\unattended-supervisor.mjs --status
Get-ScheduledTask -TaskName PlotPickleIndependentSupervisor |
  Select-Object TaskName,State
```

Only if the canonical status is OFFLINE, the scheduler task is Ready, the
recorded source head equals current clean MAIN, and there is no STOP/PAUSE or
uncertain lock/process condition, use the canonical owner-local task Start:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\engineering-team\windows\supervisor\Install-PlotPickleIndependentSupervisor.ps1" -Start -Consent ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR
```

`START_REQUESTED_UNCONFIRMED` is only a request. Verify the task state and
fresh supervisor heartbeat after startup. The PowerShell window can close
once the scheduled task is running. Never start the legacy
`PlotPickleSoftwareFactory` Pi task as a workaround.

## Read-only Windows Task Scheduler checks

```powershell
Get-ScheduledTask -TaskName PlotPickleIndependentSupervisor |
  Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName PlotPickleIndependentSupervisor |
  Select-Object LastRunTime, LastTaskResult, NextRunTime
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\engineering-team\windows\supervisor\Install-PlotPickleIndependentSupervisor.ps1" -Status
node .\scripts\engineering-team\windows\supervisor\unattended-supervisor.mjs --status
```

Open the Windows UI with Win+R → `taskschd.msc` → Task Scheduler Library →
`PlotPickleIndependentSupervisor`. `LastTaskResult=267009` (`0x41301`)
is Task Scheduler's *currently running* status, not an error.
A task showing `Ready` with `LastTaskResult=1` requires investigation.

If OFFLINE persists, check task action and working directory, Windows task
events, and the filenames (not secret contents) of `running.lock`,
`stop-request.json`, `pause-request.json`, and `heartbeat.json` under
`%LOCALAPPDATA%\PlotPickle\engineering-team\supervisor`.
A stale lock must be preserved for evidence and moved only after confirming
the recorded owner PID and any other supervisor processes have exited.
Never blindly delete or override a live/uncertain lock or STOP marker.
Normal `git pull` may also require an explicitly consented supervisor
source-head migration before restart; do not silently reenable.

## Troubleshooting without starting PlotPickle

- `factory_status.application.state=NOT_RUNNING` is expected when the user
  deliberately has not launched the PlotPickle app.
- If the authenticated observer reports `independentSupervisor.state=ONLINE`
  and `factory.state=OFFLINE`, the supervisor is healthy; the legacy queue
  remains offline. Do not change the legacy heartbeat just to show green.
- New `factory_observer` fields require updating the MCP server on local
  MAIN through the normal tested PR/merge flow and restarting the owner tunnel
  from that verified revision. Plugin instructions alone do not change the
  server's implementation.
- The authorized coding worker and real PR publisher in #3311, plus durable
  dispatcher integration, require separate owner-Windows acceptance before
  claiming autonomous issue execution or merge.
