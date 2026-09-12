# Developer Brief — #1920 Profile WebMCP Readiness Repair

## Purpose
Repair stale verification ownership left after #1915 removed the intermediate Profile menu, made User Profile a direct Dashboard destination, and moved Local Story Mode and Node Info under Options & Settings.

## Failure
Local WebMCP startup UAT reports PROFILE readiness as `not-ready` because verification still waits for `section[aria-label='Profile menu'] .pp-skin-v1-bbs`, while the live product renders `section[aria-label='User Profile'].pp-skin-v1-profile-surface`.

The same stale verifier also attempts to reach Local Story Mode and Node from Profile even though #1915 moved those destinations to Settings.

## Repair
- Point WebMCP PROFILE readiness, current-surface detection and surface scope at the direct User Profile surface.
- Route WebMCP Local Story Mode and Node through Settings rows `local-story-mode` and `node-info`.
- Point Skin V1 Visual Director Profile readiness/root at the direct User Profile surface and route Local/Node through Settings.
- Point the Profile visual-baseline candidate selector at the direct User Profile surface.
- Add a focused regression that forbids verification dependence on the removed Profile menu and preserves Settings ownership for Local/Node.

## Boundaries
Do not change product Profile behavior, auth/session behavior, curriculum/LEARN, PPF/canon, or restore the removed Profile menu. Do not weaken readiness or visual-conformance checks.

## Exit
The focused #1920 regression and #1915 regression pass, live WebMCP can traverse Profile/Local Story Mode/Node without readiness findings, convergence reports CONVERGED, and PR Gate plus Product Gate pass on the same exact head.
