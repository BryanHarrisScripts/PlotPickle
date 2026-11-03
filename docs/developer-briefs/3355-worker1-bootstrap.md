# #3355 Worker 1 bootstrap and Agent Workspace delivery

## Owner outcome

Run a fresh, non-replayable #3355 engineering job through the existing Windows
Factory. Worker 1 must produce the shared Human–Elara–agent workspace, and a
separate release path must verify the exact PR head before merge. Workers 2–5
remain parked.

## Current source boundary (November 3, 2026)

- `worker-host.mjs --serve coding-worker-1` is deliberately blocked. The
  Dispatcher runs the current one-shot Worker 1 code in its own process.
- `authorized-coding-once.mjs` accepts one replacement in one existing
  engineering `.mjs` file. It cannot edit the app, project state, or headless
  workspace API required by #3355.
- The authenticated tunnel exposes fixed #3142 and #3110 issuers. The #3110
  owner grant is consumed; its original Factory publication and engineering
  receipts are absent. PR #3387 was subsequently merged under Human review.
- The older Pi issue coder can produce a draft PR from multiple files, but its
  legacy queue is offline and contains five protected blocked jobs. It cannot
  be reclassified as an admitted Worker 1 job or restarted over those jobs.

## Required implementation boundary

1. Reconcile the historical #3110 owner orders through a read-only exact
   check that distinguishes manual PR #3387 release from Factory publication.
   Verify the exact local commit ancestry and live GitHub PR state; preserve
   every original grant, claim, result, and missing-receipt condition.
2. Add a fixed #3355 owner issuer to the existing authenticated tunnel. It
   writes one exact-main, expiring, issue-bound work order and model/publication
   grants only after Supervisor, STOP/PAUSE, Dispatcher, prior-order terminal
   state, task ownership, and private storage checks. No issue text is authority.
3. Run the job in a distinct owner-controlled Worker 1 process. Reuse the
   existing local Pi coder and isolated worktree, but constrain changed paths,
   provider, time, output, and execution. Observe STOP/PAUSE during long child
   runs; cancel only the verified owned child process tree. Retain uncertain
   worktrees and write-once receipts. Never retry a claimed order.
4. Produce a draft PR only. Independent test truth, focused tests, UAT, build,
   exact-head CI, Windows Product Gate, review, and owner-approved release
   remain outside Worker 1. No merge permission is added to the coding process.
5. Implement #3355's three-column UI and headless parity against the existing
   profile-owned PPF/project and mission/conversation boundaries. Verify a real
   bounded specialist reply and state recovery after reconnect/restart; do not
   equate a draft mission or Supervisor heartbeat with delegation.

## Acceptance evidence

- Native Windows owner SID, exact task action/path, live Worker 1 PID/command,
  exact MAIN head, fresh Supervisor/Dispatcher heartbeats, and absent STOP/PAUSE.
- Fresh #3355 grant/claim/terminal result with distinct IDs and immutable
  receipts; no replay or rewrite of #3110 and the five legacy jobs.
- Exact source and test-truth admission, focused regression/UAT/build, UI and
  headless readback of the same mission and shot IDs, authorized delegation,
  negative permission/STOP cases, and reconnect/restart persistence.
- CI and Product Gate on the exact PR head, independent review, merge SHA,
  and a separate second cycle before enabling unattended merge or Workers 2–5.

## Release limits

The diagram labels are design intent, not evidence. A green local test or draft
PR does not authorize Worker 1 release, Product Gate acceptance, or merge.
