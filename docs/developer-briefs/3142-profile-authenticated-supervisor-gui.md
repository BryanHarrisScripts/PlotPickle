# #3142 — Authenticated Human GUI ↔ local Windows supervisor

Status: bounded implementation candidate. This is a real Human-profile-gated status/pause/resume route and Settings view, **not** an always-on ChatGPT agent or owner-device service proof.

## Existing single owner and trust boundaries

- Continue to use `scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs` for Windows status, PAUSE and RESUME exactly as CMD does. No other dispatcher, worker process or persisted supervisor store is introduced.
- `app/api/factory/supervisor/route.ts` uses PlotPickle's current `getProfileExperienceRuntime()` and `boundary.authorizeRequest(requestBoundary(request), { mutation: true, recentReauthentication: true })` for mutations. Read requests need a valid unlocked Human session; mutation also uses the existing CSRF and recent reauthentication. Server-network access is rejected; requests must have local loopback HTTP origin. The secure origin path is `/api/factory/supervisor`.
- The adapter in `scripts/engineering-team/windows/supervisor/supervisor-http.mjs` enforces GET or POST, exact loopback request origin and POST same-origin content type, strict `{"action":"pause"|"resume"}` only. It accepts no PID, issue, shell command, cost setting, worktree or merge grant. It supplies bounded, privacy-filtered states and never calls a model.
- Human-profile login is distinct from the supervisor's preexisting local pairing/host/actor consent. The existing supervisor checks current exact local SHA, paired host, actor, opt-in enable record and STOP before it writes PAUSE or RESUME. No new enable/start/stop bridge is exposed to the web application. The fixed local consent is server-side and can be used only when the local source/pairing remains valid.
- The Settings → General `FactorySupervisorPanel` calls the shared route. Display states distinguish OFF, OFFLINE, BLOCKED, PAUSE_REQUESTED, PAUSED, RESUME_REQUESTED, STOP_REQUESTED and a missing/locked session. PAUSE is only ACK after a matching resident heartbeat. RESUME is an operator request and does not prove a worker actually runs. No Start, autonomous code/PR/merge or paid route is surfaced.

## Verification and strict nonclaims

- `tests/issue-3142-profile-auth-supervisor-controls.test.mjs` calls the **real** HTTP adapter and underlying real supervisor implementation in a private synthetic local filesystem. It checks Human-session denial before any state disclosure, exact local origin, malicious payload/unknown action/PID/issue rejection, status/PAUSE/RESUME/STOP parity and privacy.
- Static checks additionally bind the real route to the Human-profile authorization boundary and the actual Settings component. Native Windows impact-selected runner and source-bound W8/W9 plus full architecture gates should cover code/build/device-relevant execution. CI fixtures cannot certify the real owner's profile login/CSRF, actual paired supervisor/PID ownership or reboot persistence. The previous 55-checkpoint real Windows synthetic Story Factory browser UAT is not this Settings panel's GUI click-through.
- `#3142` stays OPEN for an actual authenticated profile GUI click-and-readback trace on the owner device; native Windows on-login install/reboot, START and STOP with independent owned descendant/sentinel proof; full status/pause/resume/stop parity; and the ChatGPT-only authorized issue-to-PR dispatch cycle.

No automatic Pi queue startup, generic PID kill, background task auto-install, story canon mutation, cost approval or automatic merge is permitted by this slice.
