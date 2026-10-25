# #3142 — Authenticated request to start the existing independent Windows supervisor

October 24, 2026. This is a narrow transport repair, NOT a finished ChatGPT-only coding dispatcher. It adds the fixed `factory-supervisor-start` option to the existing authenticated `factory_run_named_test` operation. The public four-tool catalogue and existing authenticated tool count do not change, so the separately installed owner tunnel launcher does not need a new tool-name or count grant.

## Preconditions and authority

The owner has explicitly authorized attempting the repair from a live authenticated ChatGPT session. The existing paired Windows control header and unique 32-character request ID are required. A clean, exact local MAIN checkout matching the supplied SHA is verified before reservation. The old Pi service lock must not be active or of uncertain ownership. An exclusive named-operation lock and immutable reservation block duplicate starts and uncertain replay.

The adapter runs exactly the repository-owned `Install-PlotPickleIndependentSupervisor.ps1` under `powershell.exe -NoProfile -NonInteractive -File`. It first executes `-Status` and requires the existing owner-registered task, `Ready` task state, the already-enabled independent supervisor at the exact current HEAD in `OFFLINE`, and no mismatch. Immediately before `-Start` it rechecks the exact clean checkout. The reviewed PowerShell script itself verifies Task Scheduler action, Windows identity, fixed command arguments and working directory; rejects an installed legacy `PlotPickleSoftwareFactory` task; and checks the clean current source, local supervisor STOP state and OFFLINE readiness again before `Start-ScheduledTask`. There is no new installation, enable, pause override, reauthorization, arbitrary program, shell command, queue admission, saved credential, worker PID kill, Pi dispatch, issue replay or merge.

The start operation supplies only the locally reviewed fixed consent constant, never user tool arguments or GitHub text. It is usable only when the original local operator has separately installed and enabled that exact task. A missing task or inconsistent status fails closed.

## Receipt and non-claims

A confirmed Task Scheduler request returns `START_REQUESTED_UNCONFIRMED / SUPERVISOR_START_SUBMITTED_UNVERIFIED`; an ambiguous result returns `START_REQUESTED_UNCONFIRMED / SUPERVISOR_START_OUTCOME_UNVERIFIED`. Both are written to the existing single-use immutable MCP receipt, and neither counts as `TEST_PASSED`, live worker health, model invocation, source editing, Windows product UAT, or autonomous merger. On interruption, the reserved request stays `STARTED_UNCONFIRMED` and is not retried automatically.

The supervisor's current local enabled record still has `modelDispatchAllowed: false`. It is an observational Windows supervisor, not a ChatGPT engineering worker. The remaining #3142 / #3259 dispatcher work must install a separately authorized persistent model transport and prove a real source-edit -> PR -> independent Windows/UAT -> merge cycle. A ChatGPT Plus conversation cannot be silently awakened by a local service. Do not set `chatgptEngineering.ready` true as a side effect of this start.

## Verification

Focused regression: `node --test tests/issue-3110-factory-named-test-mcp.test.mjs`, plus `tests/issue-3154-chatgpt-factory-mcp.test.mjs`, existing Windows supervisor tests and all exact-head architecture truth gates. CI Windows mock fixtures prove code semantics, not an owner Task Scheduler start. Product acceptance requires refreshing the installed MCP server after green merge, actual owner opt-in task installation if still absent, one new authenticated start receipt, independent fresh owned heartbeat, restart/reconnect, STOP and sentinel evidence. Keep #3142 OPEN.
