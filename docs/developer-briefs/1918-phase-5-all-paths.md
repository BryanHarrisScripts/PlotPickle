# #1918 Phase 5 — expand Journey to all six Paths

## Purpose

Scale the already-proven Phase 4 Path 01 vertical slice across the remaining five Paths without changing curriculum authority, progress authority, or the guided-not-gated contract.

Phase 5 is a scale-out of the existing Journey pattern. It is not a redesign of LEARN and must not begin Phase 6 Explore, Phase 7 Apply/Check, or Phase 8/9 Agent work.

## Starting authority

Phase 0–4 are merged and proven. #1975 is also merged and establishes the Human-facing vocabulary:

- OPEN JOURNEY / 6 PATHS / 24 CRAFT MODULES;
- Path labels describe craft territory rather than academic time periods;
- internal year/semester/course IDs remain stable implementation contracts;
- Path 01 already projects canonical LEARN lessons and records completion only through `PPFProject.learning.completedLessonIds`.

Phase 5 must preserve those decisions.

## Required behavior

1. All 24 Craft Modules are content-available from the Journey.
2. Paths 01–06 use the same course/lesson navigation contract.
3. Every Craft Module resolves its existing `lessonRefs` from `learn/program-map-spec.mjs` against the existing canonical topic JSON documents at request time.
4. No lesson body, bundled source, or teaching text is copied into a Journey-specific curriculum store.
5. Every Path and Craft Module remains selectable regardless of completed prerequisites or recommended sequence.
6. Progress is derived from actual completed lesson IDs in the existing PPF project learning state, including out-of-order completion.
7. Existing `lesson.open`, `lesson.complete`, and `lesson.uncomplete` commands remain the only Journey lesson-history mutations.
8. Escape/Back, numeric shortcuts, arrow navigation, Home/End, and Skin V1 menu semantics remain intact.
9. The existing Phase 4 Semester 1 endpoint remains as compatibility evidence; the live Phase 5 Journey uses one generalized all-Paths content projection rather than adding five near-duplicate semester endpoints.

## Canonical curriculum inputs

The generalized Phase 5 projection may import only the existing LEARN topic documents referenced by the deterministic program map:

- `foundations.json`
- `theme.json`
- `character.json`
- `world.json`
- `structure.json`
- `dialogue.json`
- `visual-storytelling.json`
- `drafting.json`
- `revision.json`
- `responsible-ai.json`
- `collaboration.json`
- `industry.json`

The deterministic map remains `learn/program-map-spec.mjs`. The canonical archive remains curriculum authority.

## API shape

Add one generalized Phase 5 content endpoint, conceptually:

`app/api/learn/journey-courses/route.ts`

It should return exactly 24 courses grouped by the stable course metadata already defined in the program map, with each course projecting its mapped canonical lessons.

The response must state the authority explicitly:

- curriculum owner: existing LEARN archive;
- progress owner: `PPFProject.learning.completedLessonIds`;
- recommended sequence is not access control;
- Human may learn out of order;
- curriculum bodies are not duplicated.

The Journey preview endpoint should advance to a Phase 5 contract where all six internal semester groups report their course content as wired/available.

## UI behavior

The existing `LearnJourneyPreview` surface should be generalized rather than forked.

When the Human opens any Path:

- all four Craft Modules show as available;
- mapped lesson completion is displayed from real PPF lesson history;
- any Craft Module can open immediately;
- the selected Craft Module loads its canonical projected lessons;
- any lesson can open immediately;
- completing a later Path or Craft Module does not imply completion of earlier work;
- recommended/advisory prerequisite data never disables a control.

Visible Human language remains Path/Craft Module. Stable internal `semester`/`course` naming may remain in API data structures and deterministic contracts.

## Compatibility

Preserve the Phase 4 Path 01 route and its canonical projection as a historical compatibility boundary. Update Phase 4 regression expectations only where Phase 5 intentionally supersedes the old preview-only state; do not delete the Phase 4 proof.

Preserve Phase 0–2 validators and Phase 3 shell behavior. Preserve #1975 Path/Craft Module presentation vocabulary.

## Verification

Add a focused Phase 5 regression proving at minimum:

- preview phase is Phase 5 and reports 24/24 courses wired;
- generalized content projection imports all 12 canonical topic documents;
- generalized projection resolves `lessonRefs` directly from canonical lesson arrays;
- exactly 24 courses are returned conceptually and all program-map courses remain `access: open` / advisory-only;
- an out-of-order later course can be complete while an earlier course remains incomplete;
- UI has no prerequisite-based disabled/aria-disabled behavior;
- PPF completed lesson IDs remain the only progress authority;
- Phase 0–2 validators remain green;
- Phase 4 Path 01 compatibility route remains present;
- seven-layer verification owns the new endpoint/test;
- development convergence reports `CONVERGED` against the real diff.

Live Experience Skins evidence must remain authoritative for keyboard/navigation/UI behavior and Visual Director readiness.

## Explicit non-goals

Do not add in Phase 5:

- Explore / All Curriculum;
- curriculum search/filtering;
- LEARN → APPLY → CHECK → CONTINUE workflow wiring;
- new canon/project mutation paths;
- Sage journey awareness;
- `/` Agent lens changes;
- `/panel`;
- curriculum rewriting or new lesson bodies;
- a second progress database;
- prerequisite locks;
- provider/model changes;
- visual redesign unrelated to making all Paths truthfully available.

## Exit condition

Phase 5 is complete when all 24 Craft Modules are reachable through the Journey using canonical lesson content, actual PPF lesson history remains the only completion truth, out-of-order learning is proven, existing curriculum integrity remains green, development convergence is `CONVERGED`, and exact-head repository verification is green.

Only then may #1918 Phase 6 begin.