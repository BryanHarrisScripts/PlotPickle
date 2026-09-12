# #1918 Phase 4 — Semester 1 vertical slice

## Scope

Phase 4 proves the LEARN Journey content model on one complete semester before PlotPickle wires all 24 courses.

Only **Year 1 / Semester 1 / Courses 01–04** gain lesson-content navigation in this phase:

1. Course 01 — Story Promise & Foundations
2. Course 02 — Theme, Tone & Motif
3. Course 03 — Character Foundations
4. Course 04 — World & Genre Foundations

Semesters 2–6 remain the truthful Phase 3 course-shell preview until Phase 5.

The Human path becomes:

`Dashboard -> Writer's Craft -> J LEARN Journey -> Semester 1 -> Course -> canonical lessons -> lesson content`

## Curriculum authority

The canonical LEARN archive remains the only lesson/content authority.

`app/api/learn/journey-semester-one/route.ts` imports the existing canonical Semester 1 topic documents (`foundations.json`, `theme.json`, `character.json`, `world.json`) and resolves the existing deterministic `lessonRefs` from `learn/program-map-spec.mjs` against those documents at request time.

The Journey therefore does **not** create:

- copied lesson bodies;
- a second Semester 1 curriculum file;
- rewritten/condensed lesson prose;
- a new source/provenance store.

The 24-course map remains an orchestration/index layer. Phase 2's integrity harness continues to protect the 81 archived lessons, 95 bundled sources, 88 presentation lessons and 24-course mapping.

The seven promoted Foundations presentation/reference lessons remain reachable through the existing complete curriculum path. Phase 4 does not change that existing path or its presentation authority.

## Progress authority

Phase 4 does not create a Journey-specific progress database.

The existing `PPFProject.learning.completedLessonIds` array remains the sole lesson-completion truth used by the Journey. The Journey loads/saves the existing active PPF project through `loadFoundationProject` / `saveFoundationProject` and uses the existing `lesson.open`, `lesson.complete` and `lesson.uncomplete` story commands.

Course progress is derived deterministically from mapped lesson IDs:

`completed mapped lessons / total mapped lessons`

There is no separate `courseComplete` flag and no sequential state machine.

This means a learner may complete Course 04 before Course 01, complete lessons inside a course in any order, reopen completed lessons, or mark a lesson incomplete again. Recommended prerequisites remain advisory only.

## Guided, never gated

Every semester remains selectable from day one.

Within Semester 1, every one of the four courses is selectable immediately. No lock icon, `disabled`, `aria-disabled`, prerequisite gate, completion gate or Agent permission is introduced.

For Semesters 2–6, course rows remain selectable preview shells and truthfully show that their lesson content is not wired until Phase 5.

## Lesson presentation

Phase 4 renders the existing canonical lesson fields directly:

- title and overview;
- objectives;
- teaching sections and points;
- definitions;
- example;
- checklist;
- common mistakes;
- exercise;
- PlotPickle application text;
- bundled canonical source documents.

Bundled source text remains the exact stored source content. Phase 4 may change presentation around it but does not alter that text.

## Existing curriculum access

The existing LEARN/full curriculum routes are not removed or redirected. They remain the unrestricted way to reach curriculum outside the Semester 1 Journey slice during Phase 4.

The Journey is an additional view over the same curriculum and project learning state, not a replacement authority.

## Verification

Phase 4 must prove:

- exactly Courses 01–04 are wired;
- exactly Semesters 2–6 remain preview-only;
- Semester 1 lessons resolve from canonical archive files through the deterministic course references;
- no copied curriculum store exists;
- progress uses `PPFProject.learning.completedLessonIds` and existing lesson commands;
- Course 04 can be completed while Course 01 remains incomplete;
- every Semester 1 course and lesson is selectable without prerequisite gates;
- the six-semester Skin V1/Writer's Craft compatibility contract remains intact;
- Phase 0, Phase 1 and Phase 2 validators remain green;
- live WebMCP continues to prove the Journey shell and later-semester preview contract;
- development convergence is `CONVERGED` on the real Phase 4 diff;
- all seven Architecture Verification layers are green on the exact PR head.

The live verifier remains read-only. It must not mark a real user's lesson complete merely to prove navigation.

## Explicitly deferred to Phase 5+

- wiring Semesters 2–6 to lesson content;
- recommended-next Navigator logic;
- Explore / All Curriculum redesign;
- LEARN -> APPLY -> CHECK -> CONTINUE workflow integration;
- Sage journey context;
- Agent lens switching;
- `/panel` synthesis.

Phase 5 is blocked until this four-course vertical slice is independently green and merged.
