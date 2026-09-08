# PlotPickle CI testing strategy

PlotPickle exposes exactly two normal pull-request verification gates: `PR Gate` and `Product Gate`. Historical and subsystem-specific workflows remain available where useful, but their `pull_request` triggers are removed once their coverage is owned by one of these two gates.

## PR Gate

`PR Gate` is the deterministic Ubuntu gate. It uses one checkout, one dependency installation and named steps so the failing subsystem is visible without opening unrelated successful logs.

It owns:

- CI topology enforcement;
- lint and deterministic changed-code contracts;
- LEARN, navigation, workspace and PPF validation;
- story, BUILD and decision contracts;
- auth, profile, private-storage and memory contracts;
- Agent Skill, trust and BUZZ deterministic contracts;
- focused UAT contracts;
- BEN deterministic code-quality delta;
- repository architecture checks;
- Windows PowerShell parse checks that do not require a Windows machine;
- one production web build.

BEN remains visible as a named step and uploads its evidence through the consolidated gate.

## Product Gate

`Product Gate` is the expensive rendered/system gate. It uses one Windows checkout and one PlotPickle dependency installation, sharing that setup across rendered, browser, Windows and packaging verification.

It owns:

- Visual Readiness deterministic contracts;
- UI token/style checks and the bounded 25-point UI/UX audit;
- rendered accessibility, experience and sitemap guardrails;
- autonomous Afterglow story-reference proof;
- authenticated synthetic-Human/profile journeys;
- the production web build on Windows;
- Windows installer construction;
- packaged Windows interaction smoke;
- install/uninstall smoke and installer evidence.

Visual Readiness remains visible as named internal steps and evidence rather than as a separate PR check.

## Specialized workflows

Useful deep workflows remain in `.github/workflows` for manual, scheduled, release, push-to-main or reusable execution. Examples include BEN diagnostics, Visual Readiness diagnostics, Autonomous QA campaigns, Autonomous Story Reference, Windows Installer, performance baselines and cross-platform package/security proofs.

Those workflows must not add another normal `pull_request` check after their PR coverage has moved into `PR Gate` or `Product Gate`.

## Failure handling

When a pull request fails, inspect only the exact failed gate and named step. Do not rerun already-green expensive work merely to rediscover a failure. Local development remains limited to checks for the exact code being changed; broad Windows, UAT, BEN and Visual Readiness proof stays in GitHub CI.

## Required check names

If repository rules or branch protection require status checks, the only required PlotPickle check names should be:

- `PR Gate`
- `Product Gate`

The active `Main` repository ruleset currently protects deletion and non-fast-forward updates only; it does not contain stale required-status-check rules. If required checks are enabled later, configure only the two names above.

## Operating rule

`pull request = PR Gate + Product Gate`

`main/release/manual = specialized deep verification as required`
