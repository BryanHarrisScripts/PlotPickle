# PlotPickle CI testing strategy

PlotPickle exposes exactly two normal pull-request verification gates: `PR Gate` and `Product Gate`.

The active product is moving through a new Experience architecture and interchangeable SKINs. Normal pull-request CI therefore protects stable architectural boundaries, core data/auth integrity, buildability and Windows packaging. It must not freeze rapidly changing screen layouts or force legacy UI references to stay valid.

## PR Gate

`PR Gate` is the fast deterministic Ubuntu gate. It uses one checkout and one dependency installation.

It owns:

- two-gate CI topology;
- current Experience architecture boundaries;
- core auth, credential and storage contracts;
- one production web build.

It intentionally does not run broad historical UI suites, Demo onboarding, Afterglow reference journeys or legacy visual-reference contracts.

## Product Gate

`Product Gate` is the Windows product smoke gate. It uses one checkout and one dependency installation.

It owns:

- the current Skin V1 startup boundary, including protection against Legacy Skin startup flash;
- one production web build on Windows;
- Windows installer source validation and construction;
- packaged Windows interaction smoke;
- install/uninstall smoke and installer evidence.

During active SKIN development, Product Gate should stay small. Detailed visual audits, historical screen expectations and reference-story journeys belong in specialized/manual workflows until a Skin or Experience phase is declared stable.

## Specialized workflows

Deep workflows remain available in `.github/workflows` for manual, scheduled, release, push-to-main or reusable execution. This includes BEN diagnostics, Visual Readiness diagnostics, Autonomous QA campaigns, Autonomous Story Reference, Demo onboarding, Windows Installer and other historical subsystem checks.

Those workflows must not add another normal `pull_request` check.

## Failure handling

When a pull request fails, inspect only the exact failed gate and named step. Do not rerun unrelated green work. Local development stays limited to the exact changed code; GitHub CI remains the verifier for the two normal gates.

## Required check names

If repository rules or branch protection require status checks, the only required PlotPickle check names should be:

- `PR Gate`
- `Product Gate`

## Operating rule

`pull request = PR Gate + Product Gate`

`rapid Skin/UI iteration = boundary + build + packaging protection, not historical screen lock-in`

`main/release/manual = specialized deep verification when useful`
