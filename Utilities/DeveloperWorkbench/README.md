# PlotPickle Developer Workbench

Issue: #1349

The Developer Workbench is a Windows-only development companion that turns one current GitHub Issue/PR package into an implementation-grade Pi developer brief before coding begins.

It is intentionally outside the PlotPickle product runtime.

## What V1 does

1. Loads open PlotPickle Issues and PRs with `gh`.
2. Shows PR head SHA and current check summary.
3. Links Issue/PR pairs when GitHub closing references are available.
4. Collects Issue/PR bodies, comments, commits, changed files, checks and a bounded PR patch.
5. Sends that bounded package to the existing PlotPickle-managed Pi reviewer.
6. Produces the fixed Developer Workbench brief with exact file/symbol/test recommendations when evidence supports them.
7. Lets the Human edit the brief.
8. On explicit Human approval, updates the Issue's delimited `Current developer brief` section and posts the same guidance to the linked PR.
9. Refuses publication when the PR head changed after Pi reviewed it.

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

The single-file executable is written to:

```text
Utilities\DeveloperWorkbench\dist\win-x64\PlotPickleDeveloperWorkbench.exe
```

## First use

1. Launch the EXE.
2. Confirm repository is `BryanHarrisScripts/PlotPickle`.
3. Select the local PlotPickle checkout.
4. Choose `Load GitHub work`.
5. Select one Issue or PR.
6. Review the collected evidence in the centre pane.
7. Choose `Review with Pi`.
8. Edit/approve the generated brief in the right pane.
9. Choose `Publish approved brief` only when the recommendations are correct.

For a linked Issue + PR package, publishing updates the Issue's current developer brief and posts guidance to the PR. If the PR head changes between review and publish, the Workbench stops and requires a fresh review.

## V1 churn controls

The Pi prompt explicitly checks for repeated fix/revert loops, unrelated file churn, stale developer briefs, scope growth and repeated failing gates. The app additionally protects exact-head review freshness before publishing.

## Non-goals

This is not a GitHub Desktop replacement, autonomous coding agent, autonomous merge bot, second model/provider layer, or second quality system.
