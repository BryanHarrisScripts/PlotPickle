# #1918 Phase 7 — LEARN -> APPLY -> DETERMINISTIC VIEW -> EA REFLECTION -> CONTINUE

## Goal

Turn lesson completion into a Human-led application/reflection loop without grading, testing, mastery scoring, gatekeeping, or AI authority over story canon.

Canonical loop:

`LEARN -> APPLY -> DETERMINISTIC VIEW -> EA REFLECTION -> CONTINUE`

## Authority

- **Curriculum** teaches the craft concept.
- **Deterministic system** states the facts PlotPickle can prove from the current lesson, Craft Module, application targets, project revision, and bounded project material.
- **Educational Assistant (EA)** reflects on those visible facts through the lesson lens.
- **Human** decides whether the reflection matches intent and whether to revise, retain, discuss, skip, or continue.

The EA must ask rather than judge. Example:

> In your story, Ren's external want is clear, but his emotional need is mostly visible through the way he avoids Isobel. Does that match what you intended?

## Phase 7 requirements

1. Add a deterministic application-view contract that is derived from existing PPF + canonical lesson/Craft Module metadata. Do not create a second story store.
2. The deterministic view must be visible to the Human before the EA reflection and must identify the exact project material the EA is allowed to use.
3. The EA receives only the same bounded application facts visible in that deterministic view.
4. Reuse the existing curriculum-guide Agent/provider path. Do not create a hidden provider/model route.
5. EA reflection mode must explicitly prohibit scores, pass/fail, mastery claims, grading, canon mutation, and authoritative creative verdicts.
6. The EA may conclude that an existing choice already works and does not require revision.
7. `CONTINUE` is always available and never depends on accepting the EA response or changing the story.
8. Preserve `PPFProject.learning.completedLessonIds` as lesson-progress truth. Do not introduce Phase 7 completion evidence or application receipts.
9. Preserve unrestricted Journey and Explore access.
10. Keep Sage longitudinal journey awareness for Phase 8 and `/` specialist Agent lenses for Phase 9.

## Deterministic application view

The view should include:

- project title and current revision;
- current lesson ID/title/topic;
- current Craft Module ID/title;
- Craft Module application targets;
- the lesson's `Apply in PlotPickle` instruction;
- bounded relevant PPF material currently available to PlotPickle;
- source labels for every exposed project fact.

For Foundations/World lessons, prefer the exact saved lesson answers and current brief. For other topics, expose the currently available project briefs/state rather than inventing scene or character evidence that is not in PPF.

## Application routing

The `APPLY` action should reuse the existing topic-to-workflow destinations:

- Foundations -> PLAN / Foundations / lesson
- World -> PLAN / World / lesson
- Character / Theme -> PLAN / Foundations
- Structure -> Structure
- Visual Storytelling -> Storyboard
- Drafting / Dialogue -> PageFlow
- Revision -> Edit
- Responsible AI -> Settings
- Industry -> Production
- Collaboration -> Collab
- fallback -> Plan

Routing is advisory and never changes curriculum access.

## EA reflection contract

The EA prompt must make these boundaries explicit:

- observe the visible deterministic facts;
- connect them to the current lesson;
- make one or two useful story-specific observations;
- ask whether the observation matches the writer's intention;
- do not score, grade, certify mastery, or declare a story choice objectively correct/incorrect;
- do not claim to have seen project material absent from the deterministic view;
- do not silently write or alter project canon.

## Verification

Focused tests must prove:

- deterministic view is derived from existing PPF + canonical lesson/Craft Module data;
- the visible view and EA input share the same fact contract;
- existing curriculum-guide provider authority is reused;
- grading/mastery/gating language is prohibited by the EA reflection prompt;
- APPLY routing covers existing topic destinations;
- CONTINUE and lesson completion remain independent;
- Phase 0-6 curriculum integrity/Journey/Explore regressions remain green;
- development convergence is updated to Phase 7.

## Explicitly out of scope

Do not add:

- Sage longitudinal journey memory (Phase 8);
- `/` specialist Agent switching or `/panel` (Phase 9+);
- learning scores, mastery models, tests, rubrics, unlocks, or gates;
- application receipts/evidence databases;
- new provider/model authority;
- automatic project/canon mutation;
- curriculum rewrites.

Stop after the Phase 7 loop is green and merged.
