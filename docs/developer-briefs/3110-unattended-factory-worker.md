# #3110 — opt-in unattended backlog admission worker (foundation)

This first increment is **not** autonomous code implementation. It supplies an opt-in finite GitHub admission boundary and a persistent heartbeat loop, separate from the already-paired UAT command transport. The worker uses `gh api` with argument arrays, never executes issue text, never invokes models, never opens PRs or merges, and refuses to call admission a completed engineering task.

The operator must first apply the main commit, run `node scripts/engineering-team/windows/factory-worker.mjs --enable`, then explicitly run `--run` in a supervised Windows terminal. `--status` is read-only; `--disable` is the local irreversible kill switch for this installation. No Windows service, scheduled startup or daemon is installed in this increment. A crash leaves a private lock and BLOCKED/OFFLINE state rather than silently replaying work.

Admission requires the exact `plotpickle:factory-ready` label on an open issue, excluding HOLD/BLOCKED tickets. A private current record uses the exact Git SHA and stable issue fingerprint. It remains `WAITING_FOR_IMPLEMENTER` until a reviewed, source-limited worktree implementation adapter is available and independent test/product gates are wired. No backlog ticket should be auto-labeled ready by this change.

The **remaining blocker** before genuine autonomous backlog draining is to implement a controlled Windows service with owned STOP and resume, a source-mutating Pi/Cline adapter under independent tester/challenger, production build/browser UAT, exact-head PR gating, approved merges, and next-issue transition. A green CI on this foundation must never be represented as that end-to-end proof.

## Explicit owner Windows installation (not performed by CI)

After merging and fast-forwarding `main`, a Windows user can opt into
a **per-user, limited-privilege AtLogOn scheduled task**:

```powershell
cd C:\Users\bryan\plotpickle
.\scripts\engineering-team\windows\install-factory-worker.ps1 -Install -Consent ENABLE_BOUNDED_FACTORY
.\scripts\engineering-team\windows\install-factory-worker.ps1 -Status
```

This launches the same `--run` admission-only loop without Chat or Work.
The Task Scheduler task launches at interactive logon; it is **not a true Windows
service**, does not run when the host is off/asleep or without that user session,
and has not been owner-tested. Uninstall/stop locally with:

```powershell
.\scripts\engineering-team\windows\install-factory-worker.ps1 -Uninstall
```

The local worker uses a deliberate private fail-closed non-replay lock.
An unexpected crash or power loss can leave it blocked; there is no silent
automatic recovery yet. Do not delete a live task's lock or interpret stale
heartbeats as an active agent. No automatic model dispatch or GitHub issue
prose execution occurs: `WAITING_FOR_IMPLEMENTER` is a real blocker, not
a healthy coding agent.

Before any real work is admitted, a human must intentionally add the exact
`plotpickle:factory-ready` label to a reviewed, eligible child issue.
A label alone **does not authorize model spend, writes, PRs or merges**.
