# #2318 — Outline / Plan Current-State Census Contract

## Human evidence

The post-#2314 WebMCP FULL QA run is clean in every behavioural and visual profile except Surface Census:

- Standard: 0 blockers / 0 advisories
- Interaction: 0 / 0
- Resilience: 0 / 0
- Continuity: 0 / 0
- Runtime: 0 / 0
- Visual Director: 0 / 0
- Surface Census: 1 current-navigation failure: `plan`

The census shows governance and reconciliation at 100%. The only failure is reachability.

## Root cause

The #2314 Plan record still declared the legacy root route `/?workspace=plan` and the legacy Foundations selector `[data-plan-surface='foundations']`.

Current startup governance redirects root requests into `/skin-v1`. Therefore the census lands on `/skin-v1?workspace=plan`, where the legacy Foundations workspace is not rendered.

Current Skin V1 already owns the Human-facing Outline destination. Dashboard item `plan` opens the live in-Skin-V1 Outline state:

`[data-dashboard-review-surface='outline']`

The census probe already supports this state-surface model when a canonical record has selectors but no direct route: it opens Dashboard, activates `[data-dashboard-menu-item='plan']`, and waits for the declared selector.

## Decision

Correct the canonical Plan/Outline contract only.

- keep id `plan`;
- keep Human navigation identity `Outline`;
- keep `capturePolicy: census-only`;
- keep supplemental active-governed lifecycle;
- remove the obsolete direct route from the Plan record;
- set runtime and readiness selectors to the live Skin V1 Outline state;
- do not change application behaviour;
- do not change Plan World or any other in-transit surface;
- keep Standard frozen at 30.

## Verification

Focused regression must prove:

- Plan has no `route` or `runtimeRoute`;
- Plan uses `[data-dashboard-review-surface='outline']`;
- Dashboard host still activates item id `plan` and renders the Outline state;
- Standard remains 30;
- current Matrix remains 35 surfaces with 35 governed.

Human verification order:

1. Surface Census only.
2. If green, FULL QA.
3. Required exact-head GitHub checks.
4. Merge when green.

Expected final state:

- Surface Census PASS;
- current-navigation failures 0;
- active missing governance 0;
- governance coverage 100%;
- inventory reconciliation 100%;
- current-navigation reconciliation 100%;
- FULL QA PASS with zero blockers and zero advisories.
