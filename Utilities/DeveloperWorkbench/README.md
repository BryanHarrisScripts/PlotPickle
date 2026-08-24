# PlotPickle Developer Workbench

Issues: #1349, #1373

The Developer Workbench is a Windows-only development companion that turns one current GitHub Issue/PR package into an implementation-grade Pi developer brief before coding begins.

It is intentionally outside the PlotPickle product runtime.

## What V1 does

1. Loads open PlotPickle Issues and PRs with `gh`.
2. Shows PR head SHA and current check summary.
3. Links Issue/PR pairs when GitHub closing references are available.
4. Collects Issue/PR bodies, comments, commits, changed files, checks and a bounded PR patch.
5. Proves the PlotPickle-managed Pi worker can complete a real local-model inference before enabling `Review with Pi`.
6. Sends the bounded work package to the existing PlotPickle-managed Pi reviewer.
7. Produces the fixed Developer Workbench brief with exact file/symbol/test recommendations when evidence supports them.
8. Lets the Human edit the brief.
9. On explicit Human approval, updates the Issue's delimited `Current developer brief` section and posts the same guidance to the linked PR.
10. Refuses publication when the PR head changed after Pi reviewed it.

## Pi readiness

`PI GREEN` means more than `pi --version`.

The Workbench keeps the Windows-safe direct Node launch transport for the private PlotPickle-managed Pi installation, but it now reuses PlotPickle's canonical local provider contract:

- provider: `plotpickle-local`;
- model: the approved model resolved by `scripts/pi-worker-runtime.mjs`;
- loopback-only provider endpoint;
- readiness marker: `PLOTPICKLE_PI_READY`;
- real headless Pi inference required before Pi is GREEN;
- up to four minutes for a cold local-model start, matching PlotPickle Full Verification's canonical Pi smoke budget.

Node, the local runtime/model and inference remain visible separately so a discovered model is not mistaken for an operational Pi worker.

## Local pre-CI validation

The Workbench package also includes `Run-Local-Validation.cmd`.

Run it before pushing a repair to GitHub. It uses the Workbench's saved `Local repo` path and runs, on your machine:

1. changed-test selection (`scripts/developer-diagnostics/test-changed.mjs`);
2. BEN deterministic code quality (`scripts/run-ben-code-quality.mjs`);
3. the verified production build (`scripts/build-verified.mjs`).

A successful run ends with `LOCAL PRE-CI GREEN`. This does not replace GitHub Actions; it moves diagnosis and routine repair validation onto the local machine so GitHub Actions can remain the independent exact-head release gate.

You can also pass a repository explicitly:

```powershell
.\Run-Local-Validation.cmd "C:\path\to\PlotPickle"
```

## Authority boundary

Pi is advisory. The Workbench cannot merge a PR and does not edit source code.

GitHub Actions, focused tests, BEN, production build, UAT and exact-head merge gates remain authoritative.

The Workbench never stores GitHub/provider credentials. GitHub access reuses the existing authenticated `gh` CLI. Pi reuses PlotPickle's existing managed local Pi/runtime contract.

## Requirements

Development checkout:

- Windows 10/11
- .NET 8 SDK for building
- Node.js compatible with PlotPickle
- GitHub CLI (`gh`) authenticated for the repository
- PlotPickle's existing Pi/local coding-model stack

The published Workbench EXE is self-contained for .NET, but it still needs the local PlotPickle checkout, `gh`, Node and Pi review stack because those are the evidence/runtime owners it orchestrates.

## Build

From PowerShell:

```powershell
.\Utilities\DeveloperWorkbench\build.ps1
```

The package is written to:

```text
Utilities\DeveloperWorkbench\dist\win-x64\
```

It contains:

- `PlotPickleDeveloperWorkbench.exe`
- `Run-Local-Validation.cmd`
- `local-validation.mjs`

## First use

1. Launch the EXE.
2. Confirm repository is `BryanHarrisScripts/PlotPickle`.
3. Select the local PlotPickle checkout.
4. Let readiness finish. `PI GREEN` now requires a real local-model Pi inference.
5. Choose `Load GitHub work`.
6. Select one Issue or PR.
7. Review the collected evidence in the centre pane.
8. Choose `Review with Pi`.
9. Edit/approve the generated brief in the right pane.
10. Run `Run-Local-Validation.cmd` before pushing or refreshing CI.
11. Choose `Publish approved brief` only when the recommendations are correct.

For a linked Issue + PR package, publishing updates the Issue's current developer brief and posts guidance to the PR. If the PR head changes between review and publish, the Workbench stops and requires a fresh review.

## V1 churn controls

The Pi prompt explicitly checks for repeated fix/revert loops, unrelated file churn, stale developer briefs, scope growth and repeated failing gates. The app additionally protects exact-head review freshness before publishing.

## Non-goals

This is not a GitHub Desktop replacement, autonomous coding agent, autonomous merge bot, second model/provider layer, or second quality system.
