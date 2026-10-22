# #3142 — Authenticated local Request STOP over existing Windows supervisor

Scope: third bounded lifecycle slice after #3210 (Windows PAUSE/RESUME) and #3211 (authenticated Settings status/pause/resume). This is **not** worker execution, verified process tree STOP, START, reboot persistence, or autonomous engineering.

## Canonical owner and direct controls

The one existing `scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs` retains sole authority for the durable private STOP marker. CMD continues using `--disable`. Settings → General → Windows Supervisor gains **Request STOP** through the existing `/api/factory/supervisor` same-origin desktop-loopback Node route. The same recently reauthenticated Human profile, server-side CSRF and fixed request parser used by PAUSE/RESUME apply to STOP. No new service, port, credential, PID, shell, dynamic path, issue-text code or provider/merge grants are added.

POST accepts ONLY `{"action":"stop"}`, without extra keys. The route calls `disableSupervisor()` from the same canonical module as CMD. It must receive `STOP_REQUESTED` from the local function; an already-OFF result is an explicit unverified refusal. The adapter returns `stopDisposition:"STOP_REQUESTED_UNCONFIRMED"`, `acknowledged:false`, `ownedDescendantsVerifiedGone:false`, `workerProcessVerified:false` and `inFlightCancellationProven:false`. A pending or already-running UAT/child may continue despite a local STOP marker. Only an independently observed worker and descendant tree shutdown permits a later verified terminal STOP claim. The UI requires the Human to confirm the STOP request before mutation.

## Verification and acceptance

The runtime adapter fixture exercises authenticated STOP, lost session and non-Windows refusal, wrong receipt failure, extra PID/command refusal, bounded return, and a disposable actual local supervisor STOP marker readback with RESUME denied after STOP. The existing impact-selected exact-head native Windows supervisor + HTTP adapter suite exercises real filesystem marker semantics with no host-owned process touched. Seven architecture layers, W8/W9 digest admission and the normal affected product/build lanes remain required before merging.

## Limits and follow-up

- Actual owner-device Human-authenticated Settings click and CLI parity has **not** been independently observed.
- A STOP request is **not** a claim that the supervisor/child process has stopped, its descendants have gone, its port was released, or a sentinel survived.
- No unattended Windows login/reboot worker, Start command, credential sharing with remote processes, ChatGPT-only dispatcher, or green-only autonomous merge has been activated.
- #3142, #3135 and #3121 remain OPEN for the real process-tree STOP/sentinel proof and unified authenticated Start/Status/Pause/Resume/Stop worker lifecycle.

