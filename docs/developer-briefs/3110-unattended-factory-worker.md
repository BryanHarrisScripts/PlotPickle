# #3110 — opt-in unattended backlog admission worker (foundation)

This first increment is **not** autonomous code implementation. It supplies an opt-in finite GitHub admission boundary and a persistent heartbeat loop, separate from the already-paired UAT command transport. The worker uses `gh api` with argument arrays, never executes issue text, never invokes models, never opens PRs or merges, and refuses to call admission a completed engineering task.

The operator must first apply the main commit, run `node scripts/engineering-team/windows/factory-worker.mjs --enable`, then explicitly run `--run` in a supervised Windows terminal. `--status` is read-only; `--disable` is the local irreversible kill switch for this installation. No Windows service, scheduled startup or daemon is installed in this increment. A crash leaves a private lock and BLOCKED/OFFLINE state rather than silently replaying work.

Admission requires the exact `plotpickle:factory-ready` label on an open issue, excluding HOLD/BLOCKED tickets. A private current record uses the exact Git SHA and stable issue fingerprint. It remains `WAITING_FOR_IMPLEMENTER` until a reviewed, source-limited worktree implementation adapter is available and independent test/product gates are wired. No backlog ticket should be auto-labeled ready by this change.

The **remaining blocker** before genuine autonomous backlog draining is to implement a controlled Windows service with owned STOP and resume, a source-mutating Pi/Cline adapter under independent tester/challenger, production build/browser UAT, exact-head PR gating, approved merges, and next-issue transition. A green CI on this foundation must never be represented as that end-to-end proof.
