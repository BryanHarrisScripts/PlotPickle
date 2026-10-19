# Issue #3110 — authenticated Windows start, status and stop

## Outcome

This increment adds a deliberately narrow GitHub-to-Windows command boundary for the existing PlotPickle Windows UAT runner. It does not replace the runner, bypass its exact-head admission, or grant GitHub issue text access to a shell.

The Windows operator must first pair one local host with one repository and one GitHub actor using the exact local consent token. Pairing is OFF by default, stored in the private PlotPickle application-data tree, and has a local create-once disable switch. A disabled host cannot be silently re-paired.

After pairing, an operator may run one explicit poll. The poll reads open issues carrying the paired label through the authenticated GitHub CLI, admits only issues authored by the paired actor, validates a short-lived command envelope, and maps `start`, `status`, or `stop` to the existing `windows-uat-control.mjs` functions. No issue title, body, comment, parameter, or other GitHub prose is executed as a command.

## Pair locally

```powershell
node scripts/engineering-team/windows/paired-github-control.mjs --pair `
  --repo BryanHarrisScripts/PlotPickle `
  --actor BryanHarrisScripts `
  --consent AUTHENTICATED_WINDOWS_CONTROL
```

The returned opaque `hostId` is required in every request. It is not a credential and does not authorize another host.

Inspect or disable the local pairing:

```powershell
node scripts/engineering-team/windows/paired-github-control.mjs --pairing-status
node scripts/engineering-team/windows/paired-github-control.mjs --disable
```

## Request envelope

The issue must have the exact paired label and title, and its body must contain only this marker and JSON fence:

````markdown
<!-- plotpickle-windows-control:v1 -->
```json
{
  "schemaVersion": 1,
  "kind": "github-authenticated-windows-control",
  "requestId": "0123456789abcdef0123456789abcdef",
  "hostId": "host-0123456789abcdef0123456789abcdef",
  "action": "start",
  "issuedAt": "2026-10-19T15:00:00.000Z",
  "expiresAt": "2026-10-19T15:05:00.000Z",
  "parameters": {
    "head": "1111111111111111111111111111111111111111",
    "base": "2222222222222222222222222222222222222222",
    "task": "issue-3110",
    "attempt": 1
  }
}
```
````

The exact title for that request is:

```text
[PlotPickle Windows Control] start 0123456789abcdef0123456789abcdef
```

`status` and `stop` accept only `{ "scope": "<64 lowercase hex>" }`. Requests expire within ten minutes, are bound to one host and actor, and reserve their nonce privately before any action. A duplicate returns the recorded receipt; if execution became uncertain after reservation, it reports `STARTED_UNCONFIRMED` and will not replay.

Run one bounded poll from the paired Windows host:

```powershell
node scripts/engineering-team/windows/paired-github-control.mjs --poll-once
```

## Evidence boundary

The public receipt proves only authenticated admission and the response observed from the existing local runner. It always keeps browser UAT, independent verification, model dispatch, and merge eligibility false.

This increment is not an always-on Windows service. It does not yet provide automatic startup, heartbeat-based remote offline detection, native browser UAT, a Pi/Cline repair dispatch, verifier authority, or autonomous merge. Silence or an expired request remains OFFLINE/UNKNOWN, never PASS. No additional owner-device test is requested for this partial increment; the meaningful Windows test remains the later end-to-end Software Factory repair proof for #3123.
