# PlotPickle Developer Workbench

Issues: #1349, #1373, #1448

The Developer Workbench is a Windows-only development companion that turns one current GitHub Issue/PR package into an implementation-grade local developer brief before coding begins.

It is intentionally outside the PlotPickle product runtime.

## What the Workbench does

1. Loads open PlotPickle Issues and PRs with `gh`.
2. Shows PR head SHA and current check summary.
3. Links Issue/PR pairs when GitHub closing references are available.
4. Collects Issue/PR bodies, comments, commits, changed files, checks and a bounded PR patch.
5. Proves the PlotPickle-managed Pi worker can complete a real local-model inference before review is enabled.
6. Lets the Human use the automatic Pi/Repair recommendation or select another approved local reviewer advertised through llama.cpp, LM Studio, Ollama or another supported loopback OpenAI-compatible endpoint.
7. Optionally builds a targeted Repomix evidence pack from deterministic work-item file seeds instead of packing the entire repository blindly.
8. Produces an evidence-backed Developer Workbench brief with exact file/symbol/test recommendations when evidence supports them.
9. Marks the current Issue revision or exact PR head with a local green `✓` after the upgraded scan succeeds.
10. Optionally asks a different local model for a second opinion focused on missing evidence/components and a candidate minimal fix.
11. Lets the Human decide whether to append any second-opinion guidance to the editable brief.
12. On explicit Human approval, updates the Issue's delimited `Current developer brief` section and posts the same guidance to the linked PR.
13. Refuses stale publication when the PR head changed after review.

## Local reviewer models

`Automatic · Pi / Repair recommended` remains the default.

The upgraded toolbar also discovers approved coding/review models advertised by supported loopback runtimes. `llama.cpp` is treated as its own native C++ runtime, not as an Ollama mode. The normal discovery order is llama.cpp, LM Studio, Ollama and then another configured/supported loopback OpenAI-compatible server.

The selector does not scan arbitrary drives for GGUF files and does not add a cloud fallback. It reuses PlotPickle's existing local repair capability policy and explicit local-runtime contract. When a specific model is selected, the Workbench passes that endpoint/model through the existing Pi provider boundary and requires the same real inference proof before using it.

If the selected model disappears or becomes unhealthy, the scan fails truthfully. It does not silently switch to a cloud model.

## Green scan checks

The `Scanned` column is local Workbench state stored under the current Windows user's PlotPickle Developer Workbench application data.

A green `✓` means the upgraded scan completed successfully for the exact version currently displayed:

- PR: keyed to the exact PR head SHA;
- Issue: keyed to the current GitHub `updatedAt` revision.

If the PR head moves or the Issue changes, the old check no longer matches and the row becomes unscanned again. The mark is intentionally not a GitHub label and does not modify the Issue/PR.

This makes the open queue usable as a scan checklist: work through the Issue list one-by-one and visually see which current revisions have already been reviewed with the upgraded Workbench.

## Targeted Repomix evidence

`Repomix context` is enabled by default for upgraded scans.

The Workbench derives a bounded seed set from deterministic evidence already present in the selected work item, such as changed PR files, explicit repository paths mentioned in the Issue/PR, and related focused tests. It then runs pinned Repomix tooling against those selected paths only.

Secret/credential patterns and generated output remain excluded. First-party `build/` source is not blanket-excluded because PlotPickle owns production gateway code there.

If no deterministic seed exists, the Workbench does not respond by packing the entire repository. It records that Repomix evidence was unavailable and continues with the bounded GitHub package, repository instructions and Pi's existing read-only repository inspection tools.

## Second opinion

After a primary upgraded scan, choose a different compatible local model under `Second` and use `Second opinion`.

The second reviewer receives the same bounded exact work package, selected repository instruction bundle, optional Repomix evidence and the primary brief. Its job is to challenge/complement the first pass and return:

- likely root cause;
- missing evidence/components;
- candidate minimal fix;
- materially different alternative fix when justified;
- regression risks;
- verification;
- confidence/unknowns.

The second model is advisory. Its answer is displayed separately. `Append to editable brief` is an explicit Human action; model agreement is never treated as proof and an unverified candidate fix is never presented as completed work.

## Pi readiness

`PI GREEN` means more than `pi --version`.

The Workbench keeps the Windows-safe direct Node launch transport for the private PlotPickle-managed Pi installation, while reusing PlotPickle's canonical local provider contract:

- provider: `plotpickle-local`;
- model: automatic approved repair model or an explicitly selected approved local reviewer;
- loopback-only provider endpoint;
- readiness marker: `PLOTPICKLE_PI_READY`;
- real headless Pi inference required before Pi is GREEN;
- up to four minutes for a cold local-model start, matching PlotPickle Full Verification's canonical Pi smoke budget.

Node, the local runtime/model and inference remain visible separately so a discovered model is not mistaken for an operational Pi worker.

## Local pre-CI validation

### Optional fast pre-commit gate

Run `Utilities\Enable-Developer-Hooks.cmd` once from a PlotPickle source checkout to enable the repository-local `.githooks` path. You may pass the checkout path as the first argument when the utility is launched from elsewhere.

The opt-in pre-commit hook checks only the staged diff for Git integrity and confirms that the staged paths have a safe changed-test plan. It records bounded machine-readable evidence under the checkout's private Git directory. It does not change global Git configuration and does not run BEN, the production build, Repomix or model inference.

This fast hook is an early feedback boundary, not release proof. Use the existing local pre-CI validation below before pushing, and keep GitHub exact-head CI as the independent merge/release authority.

The upgraded Workbench toolbar reports this evidence separately as `LOCAL GATE GREEN`, `RED`, `STALE`, `NOT RUN`, `DISABLED` or `BLOCKED`. Refreshing local gate status does not run Pi or a model. When current evidence contains a confirmed deterministic failure, `Scan selected` includes only the bounded failure contract in the existing Pi review package. Stale, malformed, unsupported and AI-authored opinions are never treated as confirmed deterministic failure evidence.

The selected local reviewer remains advisory. It can recommend the smallest repair, but it cannot waive the gate, change source, certify its own work or merge. After an approved repair, rerun the same hook; use `Run-Local-Validation.cmd` for changed tests, BEN and the verified production build before pushing.

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

Pi and every selected/second-opinion model are advisory. The Workbench cannot merge a PR and does not edit source code.

GitHub Actions, focused tests, BEN, production build, UAT and exact-head merge gates remain authoritative.

The Workbench never stores GitHub/provider credentials. GitHub access reuses the existing authenticated `gh` CLI. Pi reuses PlotPickle's existing managed local Pi/runtime contract.

## Requirements

Development checkout:

- Windows 10/11
- .NET 8 SDK for building
- Node.js compatible with PlotPickle
- npm for the managed Pi/Repomix support tooling
- GitHub CLI (`gh`) authenticated for the repository
- PlotPickle's existing Pi/local coding-model stack
- one supported local runtime/model for local review

The published Workbench EXE is self-contained for .NET, but it still needs the local PlotPickle checkout, `gh`, Node and Pi review stack because those are the evidence/runtime owners it orchestrates. Native llama.cpp itself does not depend on npm; npm remains supporting tooling for Pi installation/repair and pinned Repomix execution.

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

## First use and backlog scan

1. Launch the EXE.
2. Confirm repository is `BryanHarrisScripts/PlotPickle`.
3. Select the local PlotPickle checkout.
4. Let readiness finish. `PI GREEN` requires a real local-model Pi inference.
5. Choose `Load GitHub work`.
6. Use `Refresh models` and leave `Primary` on Automatic or select another compatible local reviewer.
7. Select one Issue/PR and choose `Scan selected`.
8. When the scan succeeds, confirm a green `✓` appears in the `Scanned` column for that current revision.
9. Read/edit the generated brief. Optionally select a different `Second` model and choose `Second opinion`.
10. Incorporate second-opinion guidance only when it is useful and supported.
11. Run `Run-Local-Validation.cmd` before pushing or refreshing CI for an implementation repair.
12. Publish an approved brief only when the recommendations are correct.
13. Move to the next unscanned Issue/PR and repeat.

For a linked Issue + PR package, publishing updates the Issue's current developer brief and posts guidance to the PR. If the PR head changes between review and publish, the Workbench stops and requires a fresh review.

## Churn controls

The Pi prompt explicitly checks for repeated fix/revert loops, unrelated file churn, stale developer briefs, scope growth and repeated failing gates. The upgraded scan adds deterministic revision tracking, targeted context and optional independent second-opinion evidence without turning model consensus into an authority.

## Non-goals

This is not a GitHub Desktop replacement, autonomous coding agent, autonomous merge bot, second model/provider layer, cloud fallback, arbitrary local-model scanner, or second quality system.
