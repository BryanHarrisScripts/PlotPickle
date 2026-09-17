# #2124 Human Visual Review Fixes

## Purpose

Close the concrete gaps found during Human review of the expanded WebMCP visual-readiness corpus without creating a second design system, verifier, story authority, or baseline workflow.

The reviewed local WebMCP run captured 26 registered surfaces, compared 25 candidates against Dashboard, reported 0 automated blockers and 16 advisories, and left Dashboard as the sole locked baseline. Human review found several issues that should be corrected before any additional baseline is locked.

## Human-reviewed findings in scope

### 1. Dashboard mathematical contract must be visible in verification evidence

The current Dashboard source renders `PlotPickleScorePanel`, including the unrated `NR / NOT RATED` state when no active story exists. The reviewed `dashboard-canonical.png` did not visibly contain that panel.

Exact-head CI confirmed the same rendered absence. The root cause was the older `#2026` Dashboard menu-reset stylesheet explicitly grouping `[data-plotpickle-score="v1"]` with hidden Dashboard chrome. The #2124 repair restores the existing Score panel while preserving the intentionally hidden shell title and BBS title.

Repair the existing WebMCP readiness contract so Dashboard capture cannot pass unless the PlotPickle Score surface is rendered inside the canonical Dashboard. Do not synthesize a score or invent story evidence. The existing unrated state is the correct no-story presentation.

### 2. Hybrid Story Mode must use the same subordinate Matrix shell as Local and Cloud

The reviewed Hybrid capture rendered as a shallow policy strip while Local and Cloud used the established subordinate Skin V1 shell. Reuse the existing shell and title treatment. Do not create a Hybrid provider layer or change Story Mode routing semantics.

### 3. Avery Library surface must consume canonical Skin V1 tokens

The Visual Director reported two concrete Avery advisories:

- **140 rendered palette deviations** outside Dashboard's canonical Skin V1 palette.
- **60 padding values** outside the canonical four-pixel spacing rhythm.

The Human review agreed the difference is visually material. Replace Avery's local teal/rounded/glass presentation values with existing `--pp-skin-*` palette, spacing, border, typography and state tokens. Preserve Avery behavior, synthetic-evidence semantics, data ownership, API calls and read-only boundaries.

Acceptance intent: remove the local palette and non-four-pixel padding sources rather than suppressing the Visual Director findings.

### 4. Library Archive must read as part of the Matrix Library surface

The reviewed Archive surface still reads like an older nested component, especially the oversized `Stories` heading and local green presentation. Keep the shared Archive component reusable, but strengthen the existing Skin V1 integration layer so hierarchy, palette, controls and empty-state presentation match Library's current Matrix language.

### 5. Empty Visual Story / Scene Timeline evidence remains truthful

The reviewed Visual Story and Scene Timeline captures are valid empty states. They must not manufacture Scene, Beat, Shot or Frame data solely to fill a verification screenshot.

A future populated verification fixture is allowed only if it enters through an existing PlotPickle story authority and remains verification-owned. This repair slice does not weaken that authority boundary.

## Explicit non-goals

- Do not lock any new visual baseline automatically.
- Do not make generated reference imagery a baseline.
- Do not shrink Story Map's structural interaction regions merely to imitate Dashboard's 34px menu controls.
- Do not treat every Visual Director advisory as a defect when the surface has a legitimate structural reason to differ.
- Do not create a second Visual Director, WebMCP runner, Matrix token set, Library archive implementation, Story Mode router, or story data store.

## Implementation plan

1. Restore the existing PlotPickle Score panel from the legacy #2026 hide rule and make canonical Dashboard readiness require it.
2. Bring Hybrid Story Mode into the existing subordinate Skin V1 shell and heading hierarchy.
3. Retoken Avery's session-history CSS onto `--pp-skin-*` and the four-pixel spacing grid.
4. Extend the existing Skin V1 Library Archive adapter to normalize hierarchy, palette and controls without changing the shared Archive component.
5. Add focused regression tests for the above contracts.
6. Run repository tests/Architecture Verification, fix any failures, and merge only when green.

## Exit criteria

- Dashboard visibly renders its existing `NR / NOT RATED` PlotPickle Score state when there is no active story.
- Dashboard WebMCP capture cannot be declared ready without `[data-plotpickle-score='v1']` inside the canonical Dashboard.
- Hybrid Story Mode uses the same subordinate shell contract as Local/Cloud.
- Avery no longer sources its visible Skin V1 palette from local teal/rgba/hex presentation values, and its explicit paddings sit on the four-pixel grid.
- Archive's Skin V1 presentation uses canonical Matrix tokens and a subordinate heading scale rather than the old oversized heading treatment.
- Existing story/provider/canon boundaries are unchanged.
- No new baseline is locked automatically by the implementation.
- CI is green before merge.
