# PlotPickle Software Factory — functional engineering MCP workbench

Date: 2026-10-23
Parent: #3110
Status: first opt-in implementation; not a claim of deployed/connected Windows execution

## Owner direction

**Functional by design, not restrictive by design.** The existing named-test-only MCP path made every normal engineering task require a new server release. ChatGPT should be able to inspect and repair the next five issues, execute arbitrary *selected repository tests and scripts* (including reviewed PowerShell files), inspect results, use GitHub for edits/PRs, and repeat until green. Human story-approval and product acceptance boundaries stay independent.

## First working capability

The existing authenticated MCP server gains **one opt-in** `factory_engineering_run` tool. It becomes discoverable **only** when the paired Windows MCP server has `PLOTPICKLE_FACTORY_ENGINEERING_ENABLED=1` locally configured **and** the trusted tunnel authenticates the owner. The existing four public and four authenticated fixed tools remain unchanged when this setting is absent; an old owner startup script expecting 8 tools therefore continues to work until the operator intentionally enables the expanded catalogue.

The new tool accepts a fresh immutable request ID, exact clean local main SHA, existing `factory-pr-stage` request ID and matching PR number/head SHA, plus a task mode. Modes: `node-test` (any `tests/*.test.mjs`), `node-script` (any repository `scripts/*.js|mjs|cjs`), `powershell-file` (any checked-in `scripts/*.ps1`), `npm-script` (a real script from candidate package.json), `npm-install` (`ci --ignore-scripts`), and `git-diff-check`. A script can accept up to eight ordinary separate argv arguments. This is **not** a fixed suite catalogue: new tests and scripts can be used without server-code changes.

The execution working directory is the **existing detached, private staged PR checkout**, never main. Every operation checks the original stage receipt, exact PR identity, HEAD and tracked-clean source both before and after execution. No caller-selected executable, Windows path, inline `-Command`, registry command, PID, shell metacharacter expansion or GitHub issue/comment prose becomes a native command. It launches through `spawn(..., shell:false)`, hides the Windows console, avoids inheriting secrets/API/model credentials, limits duration/output, attempts owned process-tree shutdown, and stores an immutable private request receipt. Source changes or an unverified STOP are BLOCKED, never PASS. The output is only a short redacted failure diagnostic and digest. Receipt PASS means the **selected engineering command exited zero**, not browser acceptance, independent release verification, or permission to merge.

## Windows activation and pairing

1. Merge exact-head green CI and verify no conflict with the current branch's four/eight-tool launcher contract.
2. Upgrade the Windows checkout to the merged source, then stop/restart the authenticated Factory MCP process with `PLOTPICKLE_FACTORY_ENGINEERING_ENABLED=1` set **in the owner-side launcher only**, not in ChatGPT arguments, GitHub issues or repository content. The untracked launcher/tool-count check must be updated to expect **nine authenticated tools** (while the default remains eight). Do not post any tunnel tokens.
3. Refresh the paired plugin and inspect `tools/list`: 4 unauthenticated, 9 authenticated only with opt-in. If the tool remains absent, do not pretend it is available.
4. On a clean current MAIN source, stage a chosen unmerged PR with the existing immutable `factory-pr-stage` tool. Once its receipt is `CANDIDATE_STATIC_STAGED`, submit an engineering task referencing precisely that `stageRequestId`, candidate PR/head and main head.
5. On Windows, test one focused Node regression and one checked-in PowerShell diagnostic in the private stage, confirm exact-head receipts, no main worktree mutations, timeout/STOP behavior and external-sentinel survival. Only then treat native execution as proven. Avoid overnight browser acceptance.
6. GitHub connector remains owner of source PR mutations and green-only merge decisions. The new action does **not** autonomously issue PRs, run unreviewed model provider code, spend credits, or mark Windows visual/product UAT green.

## Security limits and next work

Running a repository script inherently runs that script with the host Windows user's OS privileges; a detached Git worktree and scrubbed environment are **not an operating-system sandbox**. Thus the operator should enable the new capability only for trusted authorized PRs on the paired device, not generic third-party forks, arbitrary code/text from issues, or public web users. Future increments can add a dedicated low-privilege local execution identity and resource quotas, safe file editing/patch staging and richer scrubbed logs. Do not call this broad OS-level isolation, indefinite scheduled coding, or autonomous merging.

This implementation intentionally replaces brittle per-test enumeration with scoped **task-based** execution, while leaving sensitive powers such as host-wide PowerShell, destructive OS actions and automatic release separate from ordinary code/test work.
