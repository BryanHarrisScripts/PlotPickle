# #1918 Phase 3 — Visible Skin V1 LEARN Journey shell

## Scope

Phase 3 makes the 24-course LEARN architecture visible without exposing lesson content. It deliberately stops before Phase 4 content wiring.

The Human path is:

`Dashboard -> Writer's Craft -> [J] LEARN Journey -> 6 Semesters -> 4 Course Shells`

The canonical nine Writer's Craft collection rows remain unchanged for #1915 compatibility.

## Authority

- `learn/program-map.mjs` remains the deterministic 24-course authority.
- `app/api/learn/journey-preview/route.ts` projects only safe shell metadata from that map.
- The projection does not return lesson IDs, lesson bodies, source text or curriculum prose.
- The Human may open any semester from day one.
- Recommended prerequisites remain advisory and never become access control.
- Course shells are selectable previews, not disabled/locked rows.
- Activating a course shell does not open lesson content in Phase 3.

## Visible behavior

Writer's Craft gains one explicit connected destination:

`[J] LEARN Journey / 24-Course Program`

The existing nine collection rows remain preview-only and keep their original names and numeric shortcuts.

Journey first shows six semester rows. Arrow keys, Home/End, numeric shortcuts 1–6, Enter/Space and Escape/Back are supported. Selecting a semester opens exactly four course shells sourced from the canonical map.

Course-shell rows support Arrow keys, Home/End, numeric shortcuts 1–4 and Enter/Space. Enter/Space updates the truthful preview notice only. It does not open a lesson or mutate progress.

## Skin V1

The Journey shell consumes the same Skin V1 design tokens and full-width directory geometry used by the repaired Writer's Craft surface. Dashboard remains the visual authority; Phase 3 does not introduce a second theme or design-token owner.

## Verification

Phase 3 must prove:

- 3 years / 6 semesters / 24 courses;
- four course shells per semester;
- canonical program-map derivation;
- nine Writer's Craft compatibility rows preserved;
- J shortcut is connected and keyboard reachable;
- lesson content remains unavailable;
- no disabled/locked semester or course semantics;
- Phase 0, 1 and 2 LEARN validators remain green;
- verification ownership/catalog registration is valid;
- development convergence reports CONVERGED against the real diff;
- the seven-layer Architecture Verification workflow is green on the exact PR head.

## Explicitly deferred to Phase 4

- opening canonical lesson content from course shells;
- Explore / All Curriculum wiring;
- learner progress persistence;
- deterministic Navigator recommendations based on progress;
- LEARN -> APPLY -> CHECK -> CONTINUE integration;
- Sage journey context;
- Agent lens switching.
