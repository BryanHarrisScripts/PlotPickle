# #3110 — Authenticated ChatGPT-only Factory test execution: first Windows slice

**Date:** 2026-10-20
**Status:** Implementation slice; independently verified GitHub CI and native Windows acceptance are separate.
**Parent:** [#3110](https://github.com/BryanHarrisScripts/PlotPickle/issues/3110)
**Base design:** [Testing → Factory → Normal](3110-testing-to-factory-to-normal.md)

## Scope

Add **one precisely scoped authenticated MCP operation** to the existing Windows Factory tunnel: `factory_run_named_test`, plus existing `factory_control_receipt` readback. This is not a generic command executor, a model host, or permission to start the legacy worker.

ChatGPT authors repairs using the connected GitHub tools. Windows runs independently selected verification after the real source HEAD is known. Agent output is not sufficient evidence of a passing Windows test; the bounded native tool response is evidence only that the specific allowlisted Node test process succeeded or failed.

## Contract

`factory_run_named_test({requestId,expectedHead,suite})` is a **header-authenticated** tool; the tunnel supplies its existing private control header. No new credential is accepted from model tool arguments or GitHub issues.

- `requestId` is 32 lowercase hexadecimal characters, unique for each invocation. Write-once private reservation, write-once sanitized receipt, and no replay after an uncertain outcome.
- `expectedHead` is a 40-character lowercase SHA that must match local clean checked-out `main` **and** locally known `origin/main`. A read-only Git probe checks these, without force-pushing or silently updating the normal product checkout. The requested exact head is rechecked before the suite runs.
- `suite` is a predefined name, not a user-supplied path, program or command. Initial allowlist:
  - `factory-mcp` → `node --test tests/issue-3154-chatgpt-factory-mcp.test.mjs`
  - `factory-qa-handoff` → `node --test tests/issue-3110-synthetic-qa-factory-monitor.test.mjs`
- The host invokes `process.execPath` and fixed arguments via `execFile` without a shell. Each invocation has a finite timeout and output buffer. stdout, stderr, environment variables and private paths are **never returned through MCP**.
- `service.lock` (legacy worker) must not exist. A separate exclusive `named-test-active.lock` prevents concurrent test control. A crash may leave the lock in place; that is an operator-reviewable blocker, never auto-deleted as stale.
- `factory_control_receipt({requestId})` is the immutable sanitized result, which distinguishes `TEST_PASSED`, `TEST_FAILED`, `BLOCKED`, `STARTED_UNCONFIRMED` and `NO_REQUEST`. All results deny replay and automatic merge.

## Acceptance boundaries

A passing **allowlisted Node test** does not prove compilation, Windows browser UAT, device/provider behavior, Quality/BEN independence, Story Factory acceptance, normal-release promotion or an unattended ChatGPT engineering run. No modification to PPF canon or story data is permitted.

Existing `factory_admit_issues` still targets the Pi legacy queue and MUST NOT be called while the ChatGPT-only dispatcher remains unimplemented. Keep the `PlotPickleSoftwareFactory` Scheduled Task stopped. The new read-only `factory-monitor --watch` process can keep running.

### Native test procedure (after exact-head CI and merge)

1. Keep old Pi task stopped. Update Windows checkout to exact `main`; local untracked personal helper files are preserved.
2. Restart the local authenticated MCP server/tunnel with the updated tool catalog (four unauthenticated, **eight authenticated** tools). The untracked launcher may need its own exact tool-name/count expectation updated; do not weaken token checks.
3. Call `factory_run_named_test` with new random 32-character request ID, expected local HEAD SHA and `suite=factory-mcp`. Read its immutable receipt through `factory_control_receipt`.
4. Repeat using a **new** request ID and `suite=factory-qa-handoff`. Compare both with GitHub exact-head CI.
5. Document the real Windows result on issue #3110. A skipped Windows Product Gate in GitHub must not be treated as a native PASS.

## Candidate PR identity handoff (2026-10-21)

**First Chat-only candidate stage — metadata attestation, not candidate execution.**
The authenticated *existing* `factory_run_named_test` operation now also accepts
`suite=factory-pr-head` with `candidatePrNumber` (bounded integer) and
`candidateHead` (exact 40-hex SHA), alongside `requestId` and `expectedHead`.
There is **no ninth authenticated tool** and no new read-only public tool: the
local untracked 4-public/8-authenticated launcher contract remains intact.

After validating a clean `main` HEAD exactly matching `expectedHead`, the
Windows bridge executes a **fixed read-only** GitHub CLI command:

```text
gh pr view <candidatePrNumber> --repo BryanHarrisScripts/PlotPickle --json number,state,baseRefName,baseRefOid,headRefOid
```

The caller cannot supply command names, flags, shell expressions, paths, or a
remote repository. A candidate returns `TEST_PASSED/CANDIDATE_HEAD_VERIFIED`
**only** when the PR is open, its base is `main` at the exact expected SHA,
its reported PR number matches, and its head SHA matches the user-specified
candidate. GitHub and local state are checked independently at that point.
Blocked/mismatch/unavailable outcomes are sanitized, written once, and are
never replayed using the same request ID.

`factory_control_receipt` returns the exact candidate PR number and head
**only for the verified outcome**. It always reports
`independentVerification=false` because this is *identity* attestation, not
a test of code quality, GUI behavior, source patch content, or authorship.

The candidate source is **never checked out, built, executed, merged, or copied**
by this stage. No Pi/Codex/API inference, paid media providers, or story files
are touched. Next separate implementation must add isolated candidate
worktrees and explicitly reviewed, restricted Windows Product UAT with
candidate commit attestation, rather than declaring metadata inspection a
product PASS. The plugin tool schema must expose the new suite/fields after
the paired app/tunnel is refreshed; do not weaken launcher auth to make it fit.

## Isolated candidate staging without candidate execution (2026-10-21)

The same authenticated tool also accepts `suite=factory-pr-stage` using the existing typed
`requestId`, `expectedHead`, `candidatePrNumber` and `candidateHead`. No ninth
MCP tool, no arbitrary path, and no queue admission.

Stage procedure:
1. Verify exact clean owner Windows `main` and independently attest the OPEN GitHub
   PR identity, base commit and candidate SHA.
2. Fetch only fixed repository `refs/pull/<number>/head` and require the fetched
   Git object to match `candidateHead` before proceeding.
3. Create detached private worktree under `chat-candidate-stages/<requestId>`,
   not the normal checkout. Disable Git checkout hooks and LFS smudge.
   Enable Git for Windows `core.longpaths=true` using *only* the child Git
   process's `GIT_CONFIG_COUNT/KEY/VALUE` environment overrides for
   fetch, checkout, status, and diff. Do not alter global/local Git config
   or Windows registry. This is necessary on owner Windows: a real
   diagnostic full checkout failed with `PATH_LENGTH` after 4.5 seconds,
   whereas a `--no-checkout` registration passed for the same fetched SHA.
4. Read back staged worktree HEAD; require staged `git status --porcelain` to
   be empty (including untracked files and submodule changes); statically
   inspect 1–500 changed files
   and run `git diff --check` against the pinned base.
5. Reverify clean main and remote PR metadata, then recheck the staged
   worktree's cleanliness to reject modifications during verification.
   Record `TEST_PASSED`
   and `CANDIDATE_STATIC_STAGED` only for an exact unchanged candidate.

All subprocesses are fixed `git`/`gh` invocations via `execFile` and finite
timeouts. There is no npm install, candidate source Node test, build, GUI
execution, model inference, queue reservation or merge in this stage.
Git may use locally configured file filters during a checkout; the Factory
does not deliberately run candidate scripts. A staged worktree is not a
security sandbox for running arbitrary PR code. Subsequent candidate build
or Product UAT therefore needs a separately governed isolated execution lane.

On failure preserve the private worktree and artifacts for review; never
silently retry with the same request ID. Fixed Git fetch failures and
detached worktree-add failures are reported using bounded phase codes:
`CANDIDATE_STAGE_FETCH_FAILED` and `CANDIDATE_STAGE_WORKTREE_ADD_FAILED`.
These distinguish operations, not specific OS causes; private paths, stderr,
and credentials remain withheld. The fixed worktree-add uses a finite
120-second timeout instead of the 30-second Git metadata timeout. A static staging receipt records
source SHA, candidate SHA, PR number, changed-file count and stage ID,
but explicitly retains `independentVerification=false` and
`windowsUatVerified=false`. It is not a Windows GUI Product UAT pass.
The five earlier Pi issue reservations remain untouched.

## Next slice

Add an authenticated scoped exact-head build/test/UAT runner operating on an isolated staging worktree with process stop, timeout, and durable evidence; then prove a ChatGPT-authored source repair PR, independent Windows Quality gate, governed merge and Normal targeted retest. Do not switch to Pi/Cline or silently grant automatic merge authority.
