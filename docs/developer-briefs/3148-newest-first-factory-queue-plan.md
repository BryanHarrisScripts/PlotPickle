# #3148 — newest-first backlog planning (non-executing slice)

The Human wants the autonomous Software Factory to work through the available issue backlog **newest registered issue first**, once the separate #3141 on-device pilot has produced a real independently green and governed merged PR. The owner Windows Pi route has reported `READY_LOCAL_ONLY` but that does **not** prove execution. The factory is presently OFF.

The new `--plan-latest` option is **read-only**. It uses the existing authenticated `gh issue list` interface to collect at most 100 open items, excludes HOLD/blocked/closed/duplicate entries, sorts by immutable GitHub issue number descending, proposes a finite 80-issue maximum, reports capacity/truncation and explicitly states `userApprovalRequired: true`, `queueModified: false`, `workerStarted: false`. If the provider returns 100 rows, full backlog completeness is unknown and must not be claimed. New issues after the snapshot are not silently admitted.

After merging this code (not a factory startup instruction):

```powershell
cd C:\Users\bryan\plotpickle
git pull --ff-only
node scripts/engineering-team/windows/autonomous-queue.mjs --status
node scripts/engineering-team/windows/autonomous-queue.mjs --plan-latest
```

Do **not** copy the proposed CSV directly into `--enable` yet. #3141 is an **issue**, not PR #3141; its acceptance requires observed local Pi dispatch on an explicitly allowed documentation file, owner Windows build/UAT receipts, GitHub draft PR and exact-head independent green checks, and a separately governed merge. The current queue stores one-time immutable `config.json` and irreversible reservation files, and sticky `--disable` is not a routine reset. A later phase must implement authenticated, STOP-safe pilot-to-backlog reauthorization without deleting ledger state or weakening previously granted authority.

Neither `--plan-latest` nor Hunk advisory PR review grants per-issue mutation/provider rights or merge authority. Auto-merging product changes still requires independent native Windows Product Gate/owned STOP gates (#3135, #3142); blocked issue outcomes must remain distinct from PASS. A dynamic count (46 at initial human request, later increased as this issue was opened) is not an authorization to run every open issue.
