# #3110 — unattended engineering queue, foundation only

This first slice adds an explicitly **non-executing**, fail-closed issue admission and status boundary. It does not install a Windows service, schedule background tasks, create a PR, dispatch models, or authorize merges. The CLI `--inspect-once` reads a private local approved-ticket JSON queue, requires independent source/provider/local-execution/merge grants and exact commit, and reports whether admission is possible. Issue prose is never treated as a command.

## Next implementation gates
1. OS-owned, opt-in and revocable persistent Windows supervisor with lock, heartbeat, offline reporting, bounded timeouts, and local kill switch.
2. Independently authenticated grants (not a user-writable JSON boolean alone), issue dependency selection, isolated clean worktrees, exact-head lease and audit log.
3. Governed agent implementation and repair; deterministic build, tests, BEN and W8/W9; independent reviewer; PR exact-head CI and separately approved green-only merge.
4. One real issue-to-PR lifecycle without Chat/Work, native Windows STOP/descendant evidence and then queue advancement.

**Current status: not autonomous.** The grants in the JSON are only a local queue preflight hint, not cryptographic authorization. Do not run agents based solely on this file.
