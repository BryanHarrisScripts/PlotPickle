# Developer Brief — #1977 Phase 4: Scheduled Radar + UAT

## Goal

Put the deterministic OSS Radar on a bounded daily GitHub Actions schedule and keep manual dispatch available, while proving the complete discovery → classification → history → monthly issue/comment path with fixture-based end-to-end UAT.

## Workflow contract

Add one dedicated workflow: `.github/workflows/oss-radar.yml`.

Triggers:
- daily schedule at `17 12 * * *` UTC;
- `workflow_dispatch` for Human-triggered runs;
- no push or pull-request trigger.

Permissions:
- `contents: read`;
- `issues: write`;
- no other repository write permission.

Runtime:
1. checkout exact default-branch source;
2. use Node.js 22.13;
3. run focused OSS Radar tests;
4. execute `node lib/verification/oss-radar/run-radar.mjs` using the workflow-provided repository identity and GitHub token.

No package install is required because the Radar uses Node built-ins only.

## Concurrency and failure behavior

Use one repository-wide Radar concurrency group and do not cancel an active run. A second schedule/manual invocation waits rather than racing the monthly issue lifecycle.

Set a short job timeout. Discovery/API failure must fail the workflow visibly; do not silently publish a partial report.

## Full UAT

Add an offline end-to-end test that invokes `runRadar()` itself with one injected fetch implementation covering:
- all Phase 1 repository-search calls;
- Phase 3 classification;
- Phase 2 monthly issue discovery/reuse;
- daily comment creation;
- same-day rerun update rather than duplicate;
- cross-day history suppression;
- no-padding behavior;
- only repository-search and issue/comment network paths.

The UAT must not call live GitHub.

## Security / authority

The workflow may discover public repository metadata and write only the Radar monthly issue/comments. It may not install discovered projects, import code or curriculum, mutate PlotPickle product/canon, create implementation issues, or make Human adoption decisions.

No model provider key or model-assisted analysis is added in Phase 4.

## Exit

Phase 4 is complete when:
- the scheduled/manual workflow contract is present with least privilege;
- focused Phase 4 workflow tests pass;
- full offline Radar UAT passes through `runRadar()`;
- exact-head Architecture Verification is green.

Stop after merge. Any optional model-assisted enrichment is a later, separately authorized phase.
