# Developer Diagnostics

PlotPickle Developer Diagnostics is a repository-wide, provider-neutral test planning and failure reporting layer.

It does not edit product code, commit changes, merge pull requests, dispatch workflows or choose a broader test scope. Its job is to turn repository changes and test output into structured evidence that a person, CI job or optional model adapter can inspect.

## Modules

The implementation is split into small modules under `scripts/developer-diagnostics/`:

- `registry.mjs` loads and validates the global JSON contract.
- `git-changes.mjs` discovers changed files from explicit input or bounded Git comparisons.
- `planner.mjs` maps changes to diagnostic areas, contracts and focused suites.
- `failure-parser.mjs` converts Node test output into failures and evidence clusters.
- `reporter.mjs` writes concise JSON, Markdown and GitHub Actions summaries.
- `agent-policy.mjs` creates redacted diagnosis packets and enforces scope.
- `runner.mjs` executes a focused command and preserves its exit code.
- `index.mjs` is the reusable public module surface.

The registry lives at `config/developer-diagnostics.json`. New PlotPickle modules should extend the registry rather than adding another changed-file script or hard-coded test switch.

## Commands

Plan and run tests related to the current change:

```bash
npm run test:changed
```

Preview the plan without running it:

```bash
npm run test:changed -- --plan
```

Provide explicit files when Git metadata is unavailable:

```bash
npm run test:changed -- --files app/settings-panel.tsx,config/settings-system-taxonomy.json
```

Run any focused Node test command through the summarizer:

```bash
npm run test:diagnose -- node --test tests/settings-menu.test.mjs
```

Validate the registry and required contract owners:

```bash
npm run diagnostics:validate
```

Create a redacted packet for an optional model or agent adapter:

```bash
npm run diagnostics:agent
```

No model is called by that command. It writes `reports/developer-diagnostics/agent-packet.json`. A provider adapter may consume that packet and return a proposal JSON for policy validation:

```bash
npm run diagnostics:agent -- --proposal reports/developer-diagnostics/proposal.json
```

## Reports

The engine writes:

```text
reports/developer-diagnostics/
  changed-plan.json
  changed-plan.md
  summary.json
  summary.md
  agent-packet.json
  agent-loop.json
```

When `GITHUB_STEP_SUMMARY` is available, the Markdown failure summary is appended directly to the GitHub Actions job summary.

## Bounded diagnosis loop

The optional agent path follows one deterministic feedback policy:

```text
observe → classify → propose → verify → stop
```

The registry controls attempt limits, allowed paths, allowed focused commands and actions that require human approval.

Diagnosis mode cannot:

- write or delete repository files;
- commit or merge;
- dispatch or rerun workflows;
- select the complete suite automatically;
- inspect arbitrary repository contents;
- repeat an identical failed action;
- expand beyond the matched diagnostic area.

Ambiguous evidence, an invalid transition, a repeated proposal or the attempt limit stops the loop for review.

This is a bounded feedback mechanism, not autonomous reinforcement learning and not open-ended agent exploration.

## Adding a module

Add one area to `config/developer-diagnostics.json` with:

- stable `id` and label;
- file patterns;
- focused suites;
- owned contracts;
- minimal allowed paths.

Then register each contract with its owning source files and compatibility tests. Prefer configuration or exported structures over regular expressions against wrapper component source.

Run the focused foundation suite:

```bash
npm run test:developer-diagnostics
```
