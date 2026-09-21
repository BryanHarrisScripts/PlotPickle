# #2320 — Human navigation flattening and horizontal menu convergence

## Human decisions

This issue consolidates four approved navigation decisions.

1. **Learn**
   - Dashboard → Learn opens the Learn directory directly.
   - Remove the visible Learn Journey parent identity.
   - First Learn directory: Explore / All Curriculum plus the six named Paths.
   - Preserve six Paths, 24 Craft Modules, lessons, progress and guided-not-gated behavior.

2. **Review**
   - Rename Dashboard `Analytics` to `Reports`.
   - Preserve the existing reports id/workspace and report sections.

3. **Settings**
   - Remove visible Story Mode as an intermediate directory.
   - Settings direct children: General, Local, Cloud, Hybrid, Node Info, Agents, AI Routing, BUZZ Settings.
   - Preserve Story Mode runtime/policy internals where useful.
   - Local/Cloud/Hybrid return directly to Settings.

4. **Horizontal parent navigation**
   - Library Directory is the approved visual reference.
   - Keep horizontal navigation horizontal.
   - VISUALIZE remains Outline → Storyboard → Previs → Timeline → Production.
   - Converge its palette/selection treatment on Library and expose [O] [S] [P] [T] [D].

## Compatibility boundary

The frozen 30 Standard WebMCP catalogue remains 30. The historical Story Mode standard slot is retained as compatibility evidence, but no visible Human Settings row recreates Story Mode as a parent.

Local, Cloud and Hybrid are direct Settings children in current navigation and Standard WebMCP traversal.

## Verification

Focused:
- #2320 regression
- Dashboard navigation continuity
- Learn navigation/curriculum regressions
- Settings secondary-menu regressions
- five-stage pre-production regression
- Skin V1 menu-contract audit
- WebMCP Settings discovery

Then:
- Surface Census/current-navigation reconciliation
- FULL QA / Visual Director / UI conformance
- exact-head GitHub CI
- merge only when green

Tests must be migrated only where the Human-approved navigation authority changed. Do not weaken unrelated contracts.
