# #2314 — Active Outline / Plan Surface Governance

## Human evidence

The post-#2310 WebMCP FULL QA run reports all behavioural and visual profiles clean:

- Standard: 0 blockers / 0 advisories
- Interaction: 0 / 0
- Resilience: 0 / 0
- Continuity: 0 / 0
- Runtime: 0 / 0
- Visual Director: 0 blockers / 0 advisories

Surface Census alone reports one blocker:

- 80 inventoried surfaces
- 35 current Matrix navigation surfaces
- 34 current Matrix governed surfaces
- active missing governance: `plan`
- governance coverage: 97.14%
- inventory reconciliation: 100%
- current-navigation reconciliation: 100%

## Root cause

The Dashboard now exposes internal surface id `plan` as the Human-facing **Outline** row. The canonical registry still described Plan as a census-only migration record with only a route. It lacked the current Outline navigation identity, runtime selector/readiness contract, format profile, and #2310 supplemental active-governance declaration.

This is governance drift, not a navigation, visual, interaction, resilience, continuity, or runtime defect.

## Decision

Fix Plan only.

The historical Standard WebMCP catalogue remains frozen at 30 surfaces. Plan remains `capturePolicy: census-only` for compatibility with that history, but because it is now exposed by current Matrix navigation it is actively governed through the supplemental lifecycle layer created by #2310.

Plan World and the other in-transit surfaces remain inventory-only until current navigation reconnects them.

## Contract

Canonical Plan / Outline:

- id: `plan`
- Human-facing Dashboard label: `Outline`
- route: `/?workspace=plan`
- navigation: `04-outline`
- runtime selector: `[data-plan-surface='foundations']`
- runtime ready selector: `[data-plan-surface='foundations']`
- capture policy: census-only
- current Matrix lifecycle: active-governed

## Verification

The canonical Layer 1 navigation-continuity regression must prove:

- Standard remains exactly 30;
- supplemental governed set includes Plan;
- Plan has a real canonical navigation and selector contract;
- Plan World remains non-active/in-transit;
- a 35-surface current Matrix census can reach 35/35 governed and 100% governance coverage.

Post-merge Human acceptance remains one WebMCP FULL QA rerun. Expected result:

- Surface Census: PASS
- active missing governance: 0
- current Matrix governed surfaces: 35
- governance coverage: 100%
- inventory reconciliation: 100%
- current-navigation reconciliation: 100%
- Full QA: PASS
- all profiles: zero blockers and zero advisories

No baseline locking, redesign, or unrelated migration is included.
