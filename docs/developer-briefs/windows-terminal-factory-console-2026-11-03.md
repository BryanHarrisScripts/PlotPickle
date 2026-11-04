# Windows Terminal Factory console

Issue #3388. Owner request, 2026-11-03: one command opens colored tabs for the application,
existing tunnel, Factory, Supervisor, dispatcher, Worker 1, recovery, merging,
and a combined status console. Local source should follow GitHub `main` safely.

## Boundaries

- The Windows Scheduled Tasks remain the owners of Supervisor, dispatcher,
  Worker 1, and recovery processes. A tab only observes them.
- The legacy Factory queue is observed, never restarted or replayed. Worker 1
  remains grant controlled. Automatic merging remains disabled.
- The existing local authenticated tunnel launcher alone may ask for its key.
  A second launcher must not start when one already exists.
- A clean trusted local `main` may fast-forward only when the reviewed Factory
  startup guard permits shared source mutation. A protected runtime, dirty
  checkout, divergent history, or failed fetch blocks the update and launch.
  No STOP/PAUSE marker or historical receipt may be cleared.
- The console distinguishes HTTP response and Task Scheduler state from process
  ownership, Product Gate, worker execution, and merge proof.

## Acceptance

1. `Start-PlotPickle.bat --console` opens nine distinct colored tabs in Windows
   Terminal; the App and Tunnel tabs use existing launchers or observe an
   existing instance.
2. `Start-PlotPickle.bat --console-status` reports local and fetched main SHAs,
   STOP/PAUSE markers, and each role without starting anything.
3. The command never fast-forwards while Factory startup guard reports a
   protected runtime; it never starts another tunnel, Worker 1, legacy queue,
   or merger.
4. A missing matching managed app runtime under Factory protection is visible
   as `RUNTIME_NOT_READY`. Repair remains a separately reviewed owner
   maintenance operation.

## Observed Windows check

On the current owner host, local `main` and fetched `origin/main` both pointed
to `e584bad9129d9e33103ed58cf9317ceecd19b978`. Nine terminal child sessions
opened, one existing tunnel launcher remained, Supervisor was RUNNING, and the
legacy Factory queue was OFFLINE. The app was blocked because its matching
managed runtime fingerprint was absent while Factory protection was active.
This is not app readiness or Factory release certification.

## One-command owner entry (November 4 extension)

After this change is merged into the owner's clean `main`, install the command
and desktop shortcut once with:

```powershell
powershell.exe -NoProfile -File .\scripts\engineering-team\windows\launcher\Install-PlotPickle-Command.ps1 -Install
```

The installer writes a small `PlotPickle.cmd` shim into the user's existing
`%APPDATA%\npm` command directory and `PlotPickle Factory.lnk` on the Desktop.
It refuses a foreign existing command or shortcut. It does not change PATH,
credentials, tasks, app ownership, or Factory receipts. The directory must
already be on PATH. `-Status` inspects the installation without changing it.

In a new terminal, use `PlotPickle start`, `PlotPickle status`, or
`PlotPickle restart`. `PlotPickle recover-tunnel` is the local recovery
command when ChatGPT cannot reach the existing authenticated MCP tunnel. It
uses the already provisioned owner launcher and does not request a key in chat.
The desktop shortcut runs `PlotPickle start`.

`start` reuses `Start-PlotPickle-Console.ps1`: one Windows Terminal window with
Factory, App, Tunnel, Supervisor, Dispatcher, Worker 1, Recovery, Merge, and
combined Console tabs. The scheduled-service tabs observe existing tasks;
they do not enable or replay workers or merge. App and Tunnel tabs start only
when the existing checks allow it. `restart` reconciles missing components
using the same launcher. It refuses to terminate a responding or unverified
App/Tunnel, so a live stale instance remains `BLOCKED` until owner-verified
service control is available. A status row uses RUNNING, STOPPED, BLOCKED or
UNVERIFIED; its raw observation and source SHAs remain visible. HTTP response
alone stays UNVERIFIED.

ChatGPT uses the existing authenticated Factory MCP Tunnel. Read-only
`factory_status`, `factory_observer`, and `factory_host_diagnostics` report
the host and queue; `factory_control_receipt` reconciles a previously issued
request. Bounded `factory_run_named_test` suites include `factory-sync-main`,
`plotpickle-app-start`, `plotpickle-app-stop`, `plotpickle-app-restart`, and
`factory-supervisor-start`, each requiring a fresh `requestId` and exact
`expectedHead`. Candidate and Product Gate suites require their own bound
PR/head/source receipts. The tunnel does not expose a general shell, tunnel
self-start, Worker 1 replay, or automatic merge command.

This extension is operationally complete only after an exact-head owner
Windows test proves the installed command, shortcut, eight role tabs, repeat
Start, safe Restart, source reporting, and tunnel reconnect. A script build
or unit fixture is not that proof.
