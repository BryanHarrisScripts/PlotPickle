# Skin V1 geometry calibration — first #2270 WebMCP run

Issue: #2272  
Date: 2026-09-19  
Status: Phase 1 calibration evidence

This document records the Human-reviewed calibration conclusions from the first rendered-geometry run. It is evidence only and does not replace the Skin V1 token/composition/anatomy/declaration authorities.

## Corpus

- 30 standard WebMCP surface screenshots.
- 30 rendered-geometry JSON profiles.
- Visual Director: 0 existing blockers, 69 advisories.
- Geometry remains in advisory-census mode.

## Typography result

The rendered corpus contains 1,082 inspected typography-bearing items:

- 1,081 use the canonical JetBrains Mono UI stack.
- 1 uses Arial/Helvetica: the deliberate Dashboard PlotPickle brand heading.

Conclusion: font-family is unified. Apparent font inconsistency is primarily semantic hierarchy drift (size, weight, line height, tracking, casing and colour), not multiple screen-level font families.

## Confirmed true-positive families

- Repeated 17px right-frame escape across multiple standard/settings/production surfaces.
- Repeated ~26px × 44px sibling intersection across the same shared shell family.
- Story Mode family ~34px gutter asymmetry.
- Scene Workspace ~36px gutter asymmetry.
- Write contextual-learning region extends materially below the governed root.
- Library has unusually large structural vertical dead space.

## Calibration false/ambiguous positives

### Menu completeness

Rendered labels include shortcut prefixes and descriptive suffixes, for example:

- [N] NEW
- [L] LOAD (1)
- [L] LOCAL - Local-first Story compute and generation

Contract comparison must normalize these before declaring registered destinations missing.

### Column selection

The first collector selected the largest grid by area, which can be the wrong semantic workspace:

- PageFlow selected a shallow four-across context grid.
- Write selected an enclosing one-column grid instead of the editor/inspector grid.
- Scene Workspace selected an enclosing one-column grid instead of the three-region workspace.

Phase 1 broadens grid collection and prefers a matching declared workspace-column candidate. Shallow subordinate four-across groups are not shell evidence.

## Story Map correction

The rendered Story Map states: Four Acts, six Blocks per Act.

Any local Act jump menu therefore contains Act 1 through Act 4. Six refers to Blocks per Act.

## Phase 1 rule

Calibration may remove detector noise. It must not suppress the confirmed shared frame escape or add broad exceptions that make genuine overlap invisible.
