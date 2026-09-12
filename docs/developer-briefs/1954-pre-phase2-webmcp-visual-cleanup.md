# #1954 — Pre-Phase 2 WebMCP / visual cleanup

## Goal

Clear the known Windows startup and Skin V1/WebMCP presentation debt before #1918 begins Phase 2. This is a bounded repair; it does not implement or alter the curriculum integrity harness, the 24-course program map, lesson content, progress, Sage, Agents or provider routing.

## Evidence

The latest local WebMCP run exposed three independent problems:

1. The testing-mode narrative is easy to misread and the observed local output reported Human Testing after WebMCP had been selected. The tracked Windows launcher is `Start-PlotPickle.bat`; no repository `PlotPickle.ps1` exists, so the canonical fix belongs in the launcher that any local wrapper ultimately calls.
2. Writer's Craft received the #1935 selected-row colour/border repair, but it never received the full Dashboard/Settings directory geometry. Its shared menu row therefore falls back to the legacy three-column grid and the command text occupies the narrow first column, producing the one-word-per-line rendering.
3. Visual Director reports two Profile advisories: rendered control padding is off the canonical four-pixel spacing rhythm, and four internal headings compete at the dominant level because the page banner has no semantic `h1` while every internal `h2` uses the title size.

## Slice A — Windows testing-mode narrative

Keep the behavior stable:

- `Y` selects isolated autonomous WebMCP testing;
- `N` opens PlotPickle normally for hands-on testing;
- `--webmcp-testing` and `--human-testing` remain valid overrides;
- WebMCP continues to use the isolated test profile and bounded visual UAT.

Change only the Human-facing copy so the two modes are unmistakable and the readiness line names the actual selected branch.

## Slice B — Writer's Craft directory geometry

Writer's Craft is a Dashboard-owned BBS directory and must consume the same shared geometry already used by Settings/Profile:

- full-width shell and menu measure;
- block directory rows rather than the legacy three-column grid;
- relative row positioning for the status square;
- canonical focus, hover and help geometry;
- canonical selected dark/accent treatment.

Do not change:

- the nine #1915 collection rows or their order;
- keyboard shortcuts/navigation;
- #1932 same-element WebMCP selector contract;
- preview/unwired state;
- curriculum text or #1918 Phase 1 program-map data.

## Slice C — Profile Visual Director advisories

Preserve Profile behavior and identities while making the rendered Skin V1 presentation consume the shared contract:

- snap editable/action control padding to `--pp-skin-space-2` / `--pp-skin-space-3` (8px / 12px on the canonical grid);
- promote the existing `USER PROFILE` banner text to the sole semantic page `h1`;
- keep internal `h2`/`h3` headings visually subordinate at the meta/supporting scale.

Do not alter authentication, BUZZ identity, readiness state, profile storage, or action semantics.

## Verification

Add one focused #1954 regression covering all three slices and register it with the Experience Skins verification catalog. The existing live WebMCP observer remains the rendered proof and should return zero blocking findings and no Profile spacing/hierarchy advisories after this repair.

Development convergence must evaluate the actual PR diff. Architecture Verification must pass on the exact current head before Human merge approval.

## Acceptance

1. Startup copy clearly distinguishes autonomous WebMCP testing from normal/hands-on use and readiness copy follows the selected mode.
2. Writer's Craft uses full Dashboard directory geometry and no longer collapses command text into the legacy first grid column.
3. #1915/#1932/#1935 Writer's Craft contracts remain intact.
4. Profile control padding is on the four-pixel Skin V1 grid.
5. `USER PROFILE` is the single dominant semantic page heading; internal headings are subordinate.
6. Focused #1954 regression is selected by Architecture Verification for Skin/visual changes.
7. Development convergence reports `CONVERGED` for the real diff.
8. Exact-head Architecture Verification is green.
9. #1918 Phase 2 remains blocked until this cleanup is merged/accepted.
