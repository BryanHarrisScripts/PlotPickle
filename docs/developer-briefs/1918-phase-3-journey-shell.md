# #1918 Phase 3 — Visible Skin V1 LEARN Journey shell

## Scope

Phase 3 makes the 24-course LEARN architecture visible without exposing lesson content. It deliberately stops before Phase 4 content wiring.

The Human path is:

`Dashboard -> Writer's Craft -> [J] LEARN Journey -> 6 Semesters -> 4 Course Shells`

The canonical nine Writer's Craft collection rows remain unchanged for #1915 compatibility.

## Authority

- `learn/program-map-spec.mjs` is the single runtime-safe owner of the 24 course specifications, semester grouping and guided-not-gated shell authority.
- `learn/program-map.mjs` remains the canonical resolved map: it consumes those same specifications and is the only layer that binds them to the 81 canonical lesson IDs.
- `app/api/learn/journey-preview/route.ts` consumes only the runtime-safe course specifications. It does not load the curriculum archive at app runtime.
- Focused regression proves every shell field in the resolved program map exactly equals the shared course specification, so the extraction cannot create a second or drifting course definition.
- The preview projection does not return lesson IDs, lesson bodies, source text or curriculum prose.
- The Human may open any semester from day one.
- Recommended prerequisites remain advisory and never become access control.
- Course shells are selectable previews, not disabled/locked rows.
- Activating a course shell does not open lesson content in Phase 3.

The spec extraction is a runtime-boundary refactor only. It does not change any of the 24 course definitions, their lesson references, ordering, prerequisites, application targets or canonical curriculum bindings.

## Visible behavior

Writer's Craft gains one explicit connected destination:

`[J] LEARN Journey / 24-Course Program`

The existing nine collection rows remain preview-only and keep their original names and numeric shortcuts.

Journey first shows six semester rows. Arrow keys, Home/End, numeric shortcuts 1–6, Enter/Space and Escape/Back are supported. Selecting a semester opens exactly four course shells sourced from the canonical specifications.

Course-shell rows support Arrow keys, Home/End, numeric shortcuts 1–4 and Enter/Space. Enter/Space updates the truthful preview notice only. It does not open a lesson or mutate progress.

## Skin V1

The Journey shell consumes the same Skin V1 design tokens and full-width directory geometry used by the repaired Writer's Craft surface. Dashboard remains the visual authority; Phase 3 does not introduce a second theme or design-token owner.

## Verification

Phase 3 must prove:

- 3 years / 6 semesters / 24 courses;
- four course shells per semester;
- runtime-safe course specifications exactly match the resolved canonical program map;
- all previous 81-lesson bindings and Phase 0/1/2 validators remain green;
- nine Writer's Craft compatibility rows are preserved;
- J shortcut is connected and keyboard reachable;
- live WebMCP can traverse `J -> Semester 6 -> Course 24`;
- lesson content remains unavailable;
- no disabled/locked semester or course semantics;
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
