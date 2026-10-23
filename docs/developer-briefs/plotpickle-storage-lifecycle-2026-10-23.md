# Developer Brief — PlotPickle Storage Lifecycle and Factory Recovery

**Date:** 2026-10-23  
**Tracking issue:** [#3241](https://github.com/BryanHarrisScripts/PlotPickle/issues/3241)  
**Priority:** P0 for disk-space preflight and recovery safety; P1 for governed retention.  
**Status:** Direction approved for planning; implementation, independent Windows acceptance and cleanup eligibility remain unproven.

## Executive decision

PlotPickle must treat disk capacity, runtime retention, and Factory evidence preservation as governed product contracts—not ad hoc user cleanup. The immediate priority is to resume exact-commit Windows acceptance of the four merged PRs, while tracking the long-term retention implementation in #3241. Never convert unit-test success or GitHub CI into a claim of real Windows/browser product acceptance.

## Evidence recorded October 23, 2026

| Observation | User-observed value | Interpretation |
|---|---:|---|
| C: originally free | 0.01 GB | Disk exhaustion |
| C: used | 937.51 GB | Total volume use, **not** PlotPickle-only |
| PlotPickle install | `ENOSPC`, 2 attempts failed | Dependency transport/unpack cannot complete |
| npm cache initial installer verification | 2,608,348,997 bytes of verified content | Download cache, not complete cache directory size |
| Free after npm cache reset | 2.47 GB (from 0.03 GB) | Approximately 2.44 GB recovered |
| Free after removing first five July dependency runtimes | 5.89 GB | 3.42 GB further recovered |
| Free at latest full folder audit | 27.44 GB | Approximately 27.43 GB reclaimed from initial near-zero state |
| Historical July–August runtime candidates | 46 before first five removed; 41 thereafter | User chose to retain ten of these candidates |
| `%LOCALAPPDATA%\PlotPickle\engineering-team` | **32.93 GB** | Largest measured remaining target; contents **not yet classified** |
| Repo `.artifacts` | 0.54 GB | Review evidence-retention ownership |
| PlotPickle `npm-cache` at later audit | 0.36 GB | Refillable cache |
| Repo `dist` | 0.20 GB | Likely regenerated build output |
| Repo `node_modules` | 0.08 GB | Small; not cleanup priority |

The 32.93 GB Factory folder and historical runtimes are different concerns. Do **not** infer the 32.93 GB is entirely disposable, or that disk pressure alone conclusively caused `CANDIDATE_STAGE_WORKTREE_ADD_FAILED`. Actual worktree child-process diagnostics are required.

## Authority, classification and lifecycle rules

1. **Protected:** projects, stories, Library, user assets, models, profile secrets, connection state, approved/locked story data, governance records, immutable factory receipts, active source and active worktrees. No background deletion.
2. **Candidate only after proof:** stale fingerprinted runtime folders; completed ephemeral test worktrees with preserved receipts; obsolete compilation caches; failed-install leftovers; old build/test output.
3. **Re-downloadable but operationally costly:** npm cache, current install dependencies. Report recovery/reinstall cost.
4. **Retention:** active fingerprint + verified fallback; user's preferred ten historical eligible pre-September Windows runtime folders; exempt `curriculum-rag`, `pi-durable-*`, and any process/task/manifest-referenced runtime. Versioned policy must be explicit and reviewable.
5. **Safety:** canonical real path within approved root, reject reparse traversal, test Git worktree registration, verify source ownership, process/task locks and live reservation; fail closed if metadata is incomplete. Dry-run, exact paths, expected space, confirmation, incremental stop on error.
6. **Evidence:** all cleanup proposals and outcomes are append-only, sanitized, source-bound receipts with no credential/path leakage outside owner-local UI.
7. **Preflight:** check measured free disk **before** npm install, candidate checkout, browser UAT, and large build; reserve bounded scratch capacity; classify insufficient space with typed evidence; do not start work that cannot finish safely.

## Implementation phases

**Phase 0 — Resume operations now.** Record current C: free space; do not run npm until a correct runtime is available. Check exact MAIN and authenticated Factory; diagnose #3240 separately. Independently run GUI/browser/STOP acceptance for merged PRs #3236, #3237, #3238, #3239. Storage improvements must not hide these acceptance gaps.

**Phase 1 — Inventory and proof.** Provide bounded per-folder sizes, free-space stats, stale/active fingerprint classification, Git worktree registry correlation and blocked/unknown reasons. Prioritize breaking down the 32.93 GB `engineering-team` tree without deleting it.

**Phase 2 — Governed cleanup.** Add a user-approved Operations report: show exact eligible paths, active/fallback protections, retention rules, estimated reclaim, dry-run log, incremental deletion with cancellation and error-safe recovery.

**Phase 3 — Prevention.** Implement disk preflight and scratch budgets for dependency/runtime installation, staging, CI/UAT, periodic bounded cache retention, and measurable alerts. Never let a code-only update create endless runnable dependency copies.

**Phase 4 — Independent verification.** Synthetic edge cases plus real Windows exact-commit installs, branch/worktree staging, browser product acceptance, supervisor STOP/sentinel checks, and verification of source-bound receipts. Update test-catalog approved truth bindings for any touched normative inputs; green CI alone is insufficient.

## Acceptance criteria

- No stale fingerprint growth from repeated code-only launches with unchanged lockfile.
- No new install or worktree staging attempt when insufficient working capacity is detected.
- All cleanup decisions list protected, eligible, blocked, unknown with truthful reasons.
- No removal of projects, media, profile or credential data, active dependencies, worktree evidence, or Git registrations based solely on age.
- Free bytes are measured before/after; estimated savings do not masquerade as actual savings.
- All four integrated PR capabilities pass real Windows GUI/browser acceptance with preserved artifacts, exact source identity, and managed STOP verification.

## Issue log / dependency ledger

- **#3241:** Storage lifecycle implementation, owner-reviewed inventory and cleanup, free-space preflight.
- **#3240:** Existing draft Factory MCP safe diagnostics. Prior `factory-pr-stage` blocked with `CANDIDATE_STAGE_WORKTREE_ADD_FAILED`; local Node tests 63 passed across suites, but live MCP `factory-mcp` failed. Retest on recovered storage; do not mark green from local tests.
- **#3236 (merged):** Previs/Timeline/Rough Cut responsive workspace width; verify actual UI.
- **#3237 (merged):** Authenticated Matrix Library deep links; verify actual navigation and project continuity.
- **#3238 (merged):** Opt-in engineering MCP tool; verify live source-bound candidate stage and execution.
- **#3239 (merged):** Discover workspace/evidence navigation; verify routes, content and keyboard behavior.

## Go/no-go

Do not merge #3240 or close live Windows acceptance until exact-commit CI, stage/execute, browser journeys, and STOP/sentinel proof are green. Do not erase 32.93 GB of Factory data to make a failing gate pass.
