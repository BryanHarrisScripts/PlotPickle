# #1975 — Slice 7: free-form LEARN language — Paths and Craft Modules

## Status

Brief-first Slice 7. No implementation belongs in this first commit.

- Parent cleanup series: pre-#1918 Phase 5
- #1918 Phase 5: **PAUSED**
- Curriculum expansion: **OUT OF SCOPE**
- Canonical curriculum bodies: **UNCHANGED**
- Program-map IDs and compatibility fields: **UNCHANGED**

## Product intent

PlotPickle LEARN should feel like an open creative journey, not a school timetable.

The current visible `3 YEARS / 6 SEMESTERS / 24 COURSES` language implies deadlines, enrollment periods, and a prescribed academic sequence. That conflicts with PlotPickle's actual authority model: the recommended sequence is advisory, the Human may learn out of order, and no learner should feel bound by a calendar or fixed process.

Slice 7 changes the **visible language only** so the interface tells the truth about that freedom.

## Locked visible vocabulary

Use:

- **JOURNEY** for the overall LEARN experience
- **PATH** for each of the six current semester groupings
- **CRAFT MODULE** for each of the 24 current courses
- **LESSON** for the existing canonical lesson units

Primary summary:

`OPEN JOURNEY / 6 PATHS / 24 CRAFT MODULES`

Primary guidance:

`CHOOSE ANY PATH. MOVE AT YOUR OWN PACE.`

Secondary guidance where useful:

`THE ORDER IS A GUIDE, NOT A GATE.`

`GREEN = AVAILABLE. GRAY = UNAVAILABLE.`

Do not use visible wording that suggests a required school calendar, enrollment term, graduation clock, or mandatory progression sequence.

## Compatibility boundary

This is a presentation-language change, not a curriculum-model migration.

Keep the existing internal architecture intact:

- `year`
- `semester`
- `course`
- `course-01` through `course-24`
- existing prerequisite/advisory metadata
- existing lesson references
- existing PPF lesson-completion authority
- existing program-map ordering

Internal field names may continue to say Year/Semester/Course where changing them would break deterministic contracts, APIs, tests, historical evidence, or compatibility.

The UI may translate those stable internals into Journey/Path/Craft Module at the presentation boundary.

## Guided, never gated

The visible language must reinforce the already-established authority model:

- recommended sequence is advisory only;
- the Human may open any currently available Path or Craft Module in any order;
- completion order is the Human's choice;
- no Path is framed as a school term that must be completed before another;
- no progress copy may imply a deadline or elapsed academic year;
- Sage and future Agents may recommend where to go next, but may not turn recommendations into access control.

## Availability semantics

Preserve the universal Skin V1 rule established in Slice 6:

- **green square = AVAILABLE**
- **gray square = UNAVAILABLE**

There are no alternate meanings for a gray square.

If a Path shell is navigable for preview while its underlying lesson content is not wired, the UI must clearly distinguish shell navigation from content availability. A gray module remains **unavailable** even if its preview row can be highlighted or inspected.

Do not use gray to mean optional, later, advanced, recommended-next, incomplete, or merely unselected.

## Proposed six Path labels

The six Paths should describe craft territory rather than time periods. Use these as the default Slice 7 labels unless implementation review finds a clearer wording that preserves the same meaning:

1. **PATH 01 — STORY FOUNDATIONS**
2. **PATH 02 — STRUCTURE & STORY MOTION**
3. **PATH 03 — CHARACTER, DIALOGUE & VISUAL STORYTELLING**
4. **PATH 04 — DRAFTING THE STORY**
5. **PATH 05 — REVISION & COLLABORATIVE CRAFT**
6. **PATH 06 — PROFESSIONAL PRACTICE**

These labels are presentation metadata only. They must not replace or duplicate canonical curriculum content.

## Craft Module presentation

The existing 24 course titles remain the source of truth for module titles.

Visible row pattern:

`[01] CRAFT MODULE — Story Promise & Foundations`

or, where space is tighter:

`[01] Story Promise & Foundations`

with surrounding UI clearly identifying the list as **CRAFT MODULES**.

Do not rewrite the actual 24 course titles merely to make them sound less academic. The vocabulary change is the container language: Course → Craft Module.

## Journey screen copy

Replace visible academic summary language such as:

`3 YEARS / 6 SEMESTERS / 24 COURSES`

with:

`OPEN JOURNEY / 6 PATHS / 24 CRAFT MODULES`

Replace visible prompts such as:

`SELECT A SEMESTER TO VIEW ITS FOUR COURSES`

with:

`CHOOSE A PATH TO VIEW ITS FOUR CRAFT MODULES.`

Freedom statement:

`MOVE AT YOUR OWN PACE. THE ORDER IS A GUIDE, NOT A GATE.`

When the highlighted destination is unavailable, use the Slice 6 availability language rather than implying it is locked by sequence.

Example:

`GRAY = UNAVAILABLE — THIS CRAFT MODULE'S LESSON CONTENT IS NOT AVAILABLE YET.`

Not:

`LOCKED UNTIL PATH 01 IS COMPLETE.`

## What must not change in Slice 7

Do not:

- wire Paths 02–06 to lesson content;
- begin #1918 Phase 5;
- change canonical LEARN JSON bodies;
- duplicate curriculum bodies into new Path files;
- renumber the 24 existing course IDs;
- replace PPF `completedLessonIds` progress authority;
- add a new progress database or Journey store;
- add Sage journey awareness;
- add APPLY / CHECK / CONTINUE;
- add Agent lenses or `/panel`;
- change prerequisite semantics into gates;
- make unavailable modules green merely because their preview shell is selectable.

## Expected implementation surface

Keep implementation narrow. Likely touched production surfaces are limited to the Journey presentation boundary, especially:

- `app/skin-v1/learn-journey-preview.tsx`
- `app/api/learn/journey-preview/route.ts` only if presentation metadata must be supplied by the preview API

Prefer deriving visible Path/Craft Module labels at the UI boundary if that avoids changing stable API/program-map contracts.

Verification/docs/tests may be added as needed, but this slice should not become a schema migration.

## Regression expectations

Deterministic proof should establish that:

1. the Journey visibly says `6 PATHS / 24 CRAFT MODULES`;
2. visible Journey copy no longer frames the learner in Years/Semesters/Courses;
3. all six existing internal semester groups still map one-to-one to six visible Paths;
4. all 24 existing courses still map one-to-one to 24 visible Craft Modules;
5. course IDs and lesson references are unchanged;
6. guided-not-gated authority is unchanged;
7. green still means available and gray still means unavailable;
8. only the currently wired content remains available; Slice 7 does not perform Phase 5 expansion;
9. keyboard navigation and numeric shortcuts remain intact;
10. existing Phase 0–4 curriculum integrity validators still pass.

## Live UAT expectations

WebMCP/Human UAT should prove at minimum:

- Writer's Craft opens directly into the Journey;
- the Journey header uses Paths/Craft Modules language;
- arrow keys can move across all six Paths;
- a user can inspect Paths out of recommended order;
- Path 01 retains its currently wired lesson behavior;
- later unavailable Craft Modules remain gray and are described as unavailable, not locked by progression;
- Escape/back behavior is unchanged;
- no old visible Year/Semester/Course framing remains on the Journey surface.

## Acceptance criteria

Slice 7 is complete only when:

- the presentation vocabulary is Journey / Path / Craft Module / Lesson;
- the user is explicitly told they may move at their own pace;
- no visible academic timeframe implies a required schedule;
- internal deterministic curriculum compatibility is preserved;
- availability semantics remain universal and truthful;
- #1918 Phase 5 remains unstarted;
- focused #1975 regression passes;
- development convergence is `CONVERGED`;
- exact PR head passes all seven Architecture Verification layers;
- live WebMCP visual/conformance proof is green;
- Human merge authority is given after verification.

## Build order

1. **Brief first** — this document only.
2. Inventory all user-visible Year/Semester/Course strings on the Journey surface.
3. Implement the presentation translation to Path/Craft Module.
4. Add focused regression and convergence evidence.
5. Run exact-head seven-layer Architecture Verification.
6. Fix only defects exposed by verification.
7. Stop for Human merge approval.

Do not proceed from Step 1 to implementation merely because the brief was committed; implementation begins only when the Human says to continue.