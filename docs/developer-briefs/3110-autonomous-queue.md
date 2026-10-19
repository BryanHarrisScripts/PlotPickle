# #3110 — autonomous Windows GitHub issue queue, local Pi candidate writer, persistent state

This increment delivers an opt-in **Windows logon worker** using existing PlotPickle Pi virtual routes, one at a time, with a finite local issue allowlist. The host runs without Chat/Work while signed into Windows, and writes a 15-minute self-reported GitHub heartbeat to the existing parent #3110. It does not silently install itself, contact paid/cloud providers, run on product startup, or change Human-owned story state.

## Source contracts

- `autonomous-queue.mjs --enable --issues 3123,3135 --consent PLOTPICKLE_AUTONOMOUS_ENGINEERING`: **one-time local owner grant** with immutable list (maximum 80 issues). There is no label/comment to shell path. The worker processes that list in order and refuses HOLD/blocked/closed issues.
- `--status`: private read-only state (OFF, OFFLINE, RUNNING, BLOCKED, WAITING_FOR_PROVIDER, WAITING_FOR_PRODUCT_UAT). Missing/stale heartbeat cannot report RUNNING. `--preview` is read-only issue discovery; no agent or model call.
- `--once`: only with prior grant; one issue at most. `--serve`: one process, heartbeat, 60-second queue intervals, local duplicate lock and dead-lock recovery, bounded one-issue attempt per approval. No replay after a crash at an uncertain model boundary.
- `--disable`: create-once local refusal for future admission. It **does not certify termination** of an already-running child/descendant; that remains blocked on #3135's production ownership work.
- `Install-PlotPickleSoftwareFactory.ps1 -Install`: explicitly registers a **limited interactive user** Windows Task Scheduler job at logon and starts it. `-Uninstall` removes only the named task. No SYSTEM privileges, passwords or unattended remote shell.
- `autonomous-issue-coder.mjs`: bounded task from owner-authored GitHub issue number, fixed local-only PlotPickle Pi model, no `bash` agent tool, rejected protected source paths, isolated git worktree from pinned clean main, npm install, contracts-only deterministic UAT, production build, changed-path check, and **DRAFT PR** if checks pass.
- Public GitHub telemetry is one updated sanitized comment under parent #3110, no log or model/story prose. An updated heartbeat is merely a self-report; exact PR/CI/Windows receipts remain the source of product truth.

## Required gates and limits

First independent CI covers queue OFF default, explicit allowlist, hold skips, stale main/disabled stop, one durable reservation, uncertain crash no replay, approved issue scope, bounded path restrictions, isolated GitHub argv and private status. No operating-system integration tests imply the Windows logon task actually ran, or that Pi was configured, or that a real PR was produced.

This is a **candidate PR factory**, not yet a green auto-merge factory: automatic merge stays false and draft PRs require independent exact-head checks, product/native browser UAT and explicit per-class merge governance. The code must not silently close #3110. The owner must install/enable and demonstrate that the approved local model route can produce one candidate while Chat and Work are closed, then the separate CI/UAT gate and merge-and-next stage can be enabled with independent proof.

## Windows acceptance (AFTER CI merge)

In normal clean main Windows checkout:
```powershell
git pull --ff-only
node scripts/engineering-team/windows/autonomous-queue.mjs --status
node scripts/engineering-team/windows/autonomous-queue.mjs --preview
# Inspect open backlog and choose one safe finite set of issue numbers:
node scripts/engineering-team/windows/autonomous-queue.mjs --enable --issues 3123 --consent PLOTPICKLE_AUTONOMOUS_ENGINEERING
powershell -NoProfile -File scripts/engineering-team/windows/Install-PlotPickleSoftwareFactory.ps1 -Install
node scripts/engineering-team/windows/autonomous-queue.mjs --status
```
Do NOT run the enable command until the local worker/model/source budget is approved. A local-only Pi route must genuinely be installed and ready; unsupported/offline model should report WAITING. The task will remain off until the owner provides the explicit `--enable` consent. To revoke future tasks, `--disable` and `-Uninstall`.

## Future gated increments

Before broad unattended mutations/green auto-merging: native production process-tree STOP (fixture #3135 is not sufficient), source mutation scoped per issue, live Windows independent Story Factory Product Gate (original #3123 is 6/55 red), tester/challenger separation, active process cancellation, scheduled task restart proof, and explicit review/merge/next proof with an approved model/provider route. No unrestricted issue text prompts, paid compute, cross-issue retries, test-oracle weakening or false green.
