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
