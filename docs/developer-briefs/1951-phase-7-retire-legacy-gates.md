# Phase 7 — retire legacy PR Gate and Product Gate

Parent: #1922  
Issue: #1951  
Depends on: #1949 / PR #1950

## Decision

PlotPickle now uses the seven architecture checks as the enforced pull-request merge authority. The legacy `PR Gate` and `Product Gate` no longer run automatically for pull requests; they remain available only as explicit `workflow_dispatch` diagnostics.

This is the final cutover described in #1922. It is intentionally performed only after GitHub ruleset `20214975` (`Main`) was observed with an active `required_status_checks` rule containing all seven exact architecture contexts and neither legacy gate.

## Enforced checks

1. `Layer 1 Experience Skins`
2. `Layer 2 Experience Contract`
3. `Layer 3 Production Orchestration`
4. `Layer 4 Agent & Skill Mesh`
5. `Layer 5 Story / Canon / Evidence`
6. `Layer 6 Provider Runtime`
7. `Layer 7 Validation & Operations`

`Architecture Verification` remains the single ordinary PR workflow. Every PR receives all seven stable check names; impact selection, exact-head evidence, fail-closed unmapped-production handling and permission gates remain owned by the shared verification core.

## Legacy diagnostics

`.github/workflows/pr-gate.yml` and `.github/workflows/product-gate.yml` are retained because they still provide useful explicit broad Linux/Windows diagnostics. They have no `pull_request` trigger and are not required by the Main ruleset.

Their retention must not be confused with merge authority. They are manual diagnostics only.

## Layer 7 architecture update

The canonical `architecture/plotpickle.architecture.json` no longer describes Layer 7 as two normal PR gates. Layer 7 now names:

- Architecture Verification — seven stable required layer checks with exact-head evidence;
- Verification core — catalog, impact graph, typed runners and normalized evidence;
- Live + runtime observers — impact-selected WebMCP/provider/native/platform evidence;
- Release + diagnostics — Full Verification, artifacts, installer and explicit manual diagnostics.

PlotPickle's own living-architecture generator refreshed the full SVG, README overview, C4 projection, Agent Context, README update fingerprint and documentation-drift evidence from that source.

## Final topology

`pull request -> Architecture Verification -> seven required layer jobs -> normalized evidence -> Main ruleset merge authority`

Broad release/full-verification workflows remain outside ordinary PR execution. Expensive native/provider/platform work stays impact-selected or explicitly invoked.

## Guardrails preserved

- exact seven check names remain stable;
- no path filtering can make a required layer disappear;
- unmapped production remains fail-closed;
- WebMCP remains a read-only evidence producer;
- network/native/secrets requirements remain explicit permissions;
- deterministic selection is repository-evidence-driven, never PR prose or model opinion;
- one deterministic test retains one primary execution owner;
- verification remains outside the production dependency path.

## Completion evidence required

Before merging this Phase 7 PR:

- GitHub Main ruleset still requires exactly the seven architecture checks;
- the Phase 7 PR shows only `Architecture Verification` as the ordinary PR workflow;
- all seven required jobs pass on the exact PR head;
- Layer 7 executes the final topology/merge-authority/living-architecture baseline;
- generated architecture projections are synchronized;
- there are no unresolved review blockers.

After the merge is green, #1949, #1951 and parent #1922 can close completed.
