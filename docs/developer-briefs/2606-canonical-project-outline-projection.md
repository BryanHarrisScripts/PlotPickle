# Issue #2606 — Canonical project projection + end-to-end proof toward Outline

## Goal

Complete Phase 5 of #2601 by proving Blank and Afterglow use the same canonical project model from Mind Map through World Map and Learn, then define the stable read-only contract Outline can consume next.

## Implementation

- Add `modules/plan/projections/canonical-project-outline.ts`.
- Version the projection contract independently from persisted project schema.
- Derive all Learn-backed canonical fields through `storyDevelopmentFieldView`.
- Derive the 24 Block / 96 Mini-Block structure from `project.structure`.
- Include project identity and revision so downstream consumers can identify the exact canonical source revision.
- Do not persist the projection and do not add an Outline-owned copy of Foundations, World, Character, Theme, Structure, or other project truth.
- Have the existing Matrix Outline surface instantiate the projection and expose only non-visual diagnostic attributes for verification.
- Preserve current Outline Story Map, readiness, Story Card, written-story and Mini-Block behavior.

## End-to-end evidence

The focused #2606 regression proves:

1. Blank remains the default detached startup state.
2. First Mind Map Save promotes Blank into a durable project identity.
3. Mind Map and World Map read the same canonical field adapter.
4. World Map Learn links and Edit in Mind Map routing retain exact topic/field identity.
5. Packaged Afterglow remains explicit and contains canonical Foundations, Character evidence and 24-Block structure.
6. Outline consumes a versioned derived projection and does not own a duplicate persistent story store.
7. Existing Outline composition remains present.

## Verification routing

The new projection is Story Canon production code. The #2606 focused test is registered as a baseline/impact Story Canon check so project/canon/storage/surface/navigation changes select it deterministically.
