# #3142 — Owner-scoped tunnel watchdog: first deterministic admission slice

Date: 2026-10-25. Parent: #3142; roadmap: #3274.

## Observed blocker

At clean owner MAIN `d94c535d8d54db4abd9d1c27db06cce0d20142c8`, the authenticated tunnel was reachable, but the independent Factory supervisor remained OFFLINE. A fresh authenticated `factory-supervisor-start` request `c1d2d00319833545435840d12db1744b` returned `SUPERVISOR_STATUS_UNVERIFIED`. A fresh `factory-pr-head` request `a883574b11c6fab0c1201cecc075c5b5` independently verified PR #3298's exact head, but `factory-pr-stage` request `d345b97125119e5ff974c7b3908a2720` returned generic `CONTROL_OPERATION_BLOCKED`. Both failure receipts were read back. The user-observed canonical staging lock was absent; no cleanup or request replay was attempted. The existing three-retained-stage cap remains installed until PR #3298 passes independent owner-Windows acceptance and merges.

## This PR — policy, not a service

`scripts/engineering-team/windows/tunnel/tunnel-watchdog-policy.mjs` is an injected, deterministic policy for a future owner-local Windows watchdog. It requires an explicit owner enable/STOP source, fixed owner-verified launcher, local port probe, a durable launch reservation adapter, and an owned-child launcher adapter. The policy has no direct OS launch, Task Scheduler, shell, credential, file deletion or remote API endpoint.

On a local free port, it first demands a successful durable reservation before a launch request. A known owned child that exits is eligible for bounded 5s/15s backoff; after three observed exits the budget is exhausted. An ambiguous spawn response is terminally non-replayable. A live but unhealthy child is reported without attempting to kill it. An unowned listener is never adopted or killed. Owner STOP and disabled state take precedence. Every result keeps remote authentication, plugin reconnection, independent verification and process-kill authorization FALSE.

The `tests/issue-3142-tunnel-watchdog-policy.test.mjs` regression is pinned under the existing agent-runtime tunnel catalog and White Paper v3 W8/W9 truth obligations. It uses synthetic Windows/process adapters only; no actual Windows process is started.

## Remaining implementation / acceptance gates

1. Provide a Windows-only owner-provisioned host adapter with fixed-path launcher verification, exclusive owner-private instance lock, fsynced write-once launch receipts, verified child ownership, redacted durable health observations and a local revocable STOP marker. Never commit or log tunnel/provider credentials.
2. Add an explicitly consented Scheduled Task installation and uninstall path. Preserve owner task identity and other tasks; distinguish logon startup from actual pre-login boot. Reject unsafe or interactive credential provisioning rather than claiming unattended readiness.
3. Prove native owner Windows STOP, abnormal exit, restart backoff, no PID adoption, no unrelated process termination, no replay after uncertain spawn, and recovery after a real tunnel outage. Verify authenticated MCP after restart separately from local socket liveness.
4. Test whether the existing ChatGPT plugin reconnects using its supported authentication flow. Do not automate browser/plugin controls through unsupported routes. Until verified, report `pluginReconnected:false`.
5. Maintain a durable GitHub checkpoint per scheduled run, with exact PR head, CI, owner-host receipt and next action. This is distinct from proving an unattended AI worker.
6. Obtain exact-head seven-layer CI, Windows Product Gate and independent owner-machine evidence before any merge. No automatic merge, dispatcher, paid model, or legacy Pi activation is part of this PR.

Do not merge this policy-only PR as though the requested Windows watchdog is installed or operational. It is a bounded prerequisite for a separately verified service integration.
