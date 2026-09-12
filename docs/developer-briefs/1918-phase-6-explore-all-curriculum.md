# #1918 Phase 6 — Explore / All Curriculum

Parent: #1918

## Goal

Make self-directed learning a first-class LEARN mode alongside the guided Journey without creating a second curriculum, a second completion system, or a new authority boundary.

Phase 6 adds an unrestricted `EXPLORE / ALL CURRICULUM` view over the same canonical LEARN knowledge and the same Human learning history already used by the Journey.

## Human-facing model

The LEARN root keeps the existing guided Journey and adds one explicit open-exploration entry:

`Writer's Craft -> LEARN Journey -> [E] Explore / All Curriculum`

The Human may continue through the six guided Paths or deliberately ignore that order and browse/search the complete curriculum directly.

Explore is not a fallback or an advanced unlock. It is available immediately.

## Canonical curriculum authority

Explore must consume the existing presentation adapter:

`adapters/curriculum/current-catalog.ts`

That adapter is already the deterministic presentation owner for:

- 12 canonical topics;
- 81 archived lessons;
- seven promoted Foundations reference lessons;
- 88 presentation lessons total;
- 95 unique bundled source documents.

Phase 6 must not copy lesson bodies, source content, promoted Foundations material, or course mappings into a new store.

The 24-Craft-Module Journey remains defined by `learn/program-map-spec.mjs` and continues to index the canonical archive. Explore adds metadata that relates each presentation lesson back to its canonical Journey owner.

For the seven promoted Foundations presentation lessons, use the existing Phase 2 reference-coverage relationship: source -> canonical Foundations lesson -> owning Craft Module. Do not pretend those seven lessons are separate Journey-owned archive lessons.

## Shared progress authority

Journey and Explore must use exactly one progress truth:

`PPFProject.learning.completedLessonIds`

Opening a lesson continues to use the existing `lesson.open` story command.

Marking a lesson complete/incomplete continues to use the existing `lesson.complete` / `lesson.uncomplete` commands through `applyStoryCommand` and `saveFoundationProject`.

Do not add Explore-specific localStorage keys, course completion state, progress mirrors, or synchronization jobs.

For the 81 Journey-backed presentation lessons, the stable lesson ID is the same in both views, so completion must appear immediately in either view. The seven promoted Foundations references are Explore-only presentation lessons but still write to the same PPF lesson-history owner.

## Explore index contract

Add one server projection under the existing LEARN API boundary. It should expose all 88 presentation lessons with deterministic metadata sufficient for unrestricted discovery.

Each entry should expose:

- presentation lesson ID and presentation order;
- canonical lesson ID used for Journey ownership;
- coverage mode (`journey` or `reference-coverage`);
- topic ID/title;
- owning Craft Module ID/title/path metadata;
- searchable concept terms derived from canonical lesson tags/definitions/section headings;
- PlotPickle application areas derived from the canonical lesson `apply` field plus the owning Craft Module application targets;
- the canonical presentation `CurriculumLesson` itself.

The endpoint must fail closed if the projected inventory is not exactly:

- 12 topics;
- 88 presentation lessons;
- 24 represented Craft Modules;
- 95 unique bundled sources.

## Search and browse dimensions

The Human must be able to discover material by at least these dimensions without changing curriculum authority:

- topic;
- Craft Module/course association;
- lesson title/content metadata;
- concept;
- PlotPickle application area.

Phase 6 should provide:

- one free-text search across those dimensions;
- a Topic filter;
- a Craft Module filter;
- the complete result list when no filters are active.

Search is deterministic client-side filtering over the canonical Explore projection. It is not semantic retrieval, RAG, Agent inference, or provider-backed search.

## Skin V1 behavior

Preserve the existing Path/Craft Module vocabulary and Journey visuals from #1975/Phase 5.

At the Journey root:

- show `[E] EXPLORE / ALL CURRICULUM` as a clearly available destination;
- keep Paths 01–06 unchanged;
- `E` opens Explore;
- Escape from Explore returns to Journey;
- Back returns through the existing hierarchy.

Explore should use the same Skin V1 directory/panel geometry and visual tokens.

Explore results should make topic, Craft Module association, availability and actual completion state legible without introducing locks.

Opening an Explore lesson shows the canonical presentation lesson and bundled source material. The Human may mark it complete or incomplete using the shared PPF progress authority.

## Guided, never gatekept

Explore must never:

- disable later topics or Craft Modules;
- require Journey completion;
- require prerequisites;
- hide professional/Industry material;
- rank results by progress as an access rule;
- require Sage or another Agent to unlock knowledge.

Journey order remains useful guidance. Explore deliberately provides a clean way to ignore it.

## Compatibility requirements

Phase 6 must preserve:

- Phase 0 baseline counts/hashes;
- Phase 1 deterministic 24-course map;
- Phase 2 curriculum integrity harness;
- Phase 3 Journey shell/navigation contract;
- Phase 4 Path 01 compatibility endpoint;
- Phase 5 all-six-Path Journey wiring;
- #1975 Path/Craft Module Human-facing language;
- #1967 direct Writer's Craft -> Journey cutover;
- existing Skin V1 keyboard/back behavior;
- existing provider, Agent, PPF and canon authority.

## Do not add in Phase 6

Do not add:

- LEARN -> APPLY -> CHECK -> CONTINUE workflow logic (Phase 7);
- project/canon mutation from learning exercises;
- Sage journey awareness (Phase 8);
- `/` Agent lenses (Phase 9);
- `/panel`;
- semantic/vector search;
- new RAG ingestion;
- new provider/model paths;
- new curriculum text;
- a separate Explore progress database;
- a second course map.

## Verification

Focused regression must prove:

1. Explore projects exactly 88 presentation lessons across 12 topics and all 24 Craft Modules while retaining 95 unique bundled sources.
2. The endpoint consumes `plotPickleCurriculum` from the existing presentation adapter and `LEARN_PROGRAM_COURSE_SPECS` rather than a copied curriculum/map.
3. The seven promoted Foundations lessons retain explicit reference-coverage ownership through their canonical Foundations lessons.
4. Search metadata includes topic, Craft Module, lesson, concept and PlotPickle application dimensions.
5. Journey and Explore both use `PPFProject.learning.completedLessonIds` and the existing lesson commands.
6. Explore is unrestricted and contains no prerequisite/access gating.
7. The Journey remains fully wired and unchanged in authority.
8. Phase 0–2 deterministic validators remain green.
9. The seven-layer ownership map governs the new Explore endpoint.
10. #1918 development convergence reports `CONVERGED`.
11. Exact-head Architecture Verification, including existing live WebMCP/UI conformance and Visual Director evidence, remains green.

## Stop condition

Phase 6 is complete when the Human can open Explore from the Journey, browse/search all canonical presentation lessons, open any result, and share completion truth with Journey while all verification is green.

Stop there. Do not begin Phase 7 in the same PR.