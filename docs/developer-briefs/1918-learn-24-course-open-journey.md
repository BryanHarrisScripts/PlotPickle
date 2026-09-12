# Developer Brief — #1918 LEARN 24-Course Open Journey

## Purpose

Reorganize PlotPickle LEARN into a human-scale, degree-style learning journey without deleting, condensing, rewriting, hiding, or gatekeeping any canonical curriculum.

The default experience should feel like a coherent three-year program: six semesters, four courses per semester, 24 courses total. The learner should see a manageable current block rather than the full curriculum at once, while still retaining unrestricted access to every course, lesson and reference.

The design principle is:

**Guided, never gatekept.**

PlotPickle provides structure and orientation. The learner controls sequence and depth.

## Existing authority and preservation contract

The existing LEARN curriculum remains the source of teaching truth.

Current canonical inventory:

- 12 curriculum topics;
- 81 archived lessons;
- 95 bundled teaching/source documents;
- 88 presentation lessons after the existing Foundations presentation expansion.

The 24-course system is an orchestration/indexing layer above this material. It must point to existing lessons rather than copy lesson bodies into a second curriculum store.

Existing provenance, source text, RAG inventory, hashes, lesson content, current LEARN validation and Human/canon boundaries remain authoritative unless a separate content-change issue explicitly changes them.

No curriculum data should be removed merely to make the UX feel smaller.

## Educational model

The university analogy is deliberate.

A learner taking four courses per semester for six semesters experiences gradual knowledge ingestion over three years. PlotPickle should use the same principle: early learning should prioritize intuitive story craft and practical application; later learning should introduce material that becomes more meaningful after the learner has actually built story material.

Recommended program shape:

- Year 1 / Semester 1: Courses 01–04
- Year 1 / Semester 2: Courses 05–08
- Year 2 / Semester 3: Courses 09–12
- Year 2 / Semester 4: Courses 13–16
- Year 3 / Semester 5: Courses 17–20
- Year 3 / Semester 6: Courses 21–24

Each semester therefore presents four courses as the primary current block.

The exact course names and lesson assignments should be derived from the canonical curriculum inventory, not invented independently in UI code.

## Sequencing philosophy

Recommended sequencing should generally move through these phases:

1. story foundations and basic visual/story literacy;
2. premise/theme, character, world/genre and introductory structure;
3. PlotPickle application and the 24/96 story model;
4. deeper character, dialogue, scene movement, visual storytelling and drafting;
5. revision, collaboration and responsible AI/provenance;
6. advanced application, ownership, industry and professional context.

Less intuitive professional material such as deeper Industry/business knowledge should generally appear later, after the learner has enough practical story experience for it to be relatable and useful.

This is sequencing guidance, not a rule that prevents earlier access.

Do not force equal lesson counts per course. Group for comprehension and application, while preserving all curriculum coverage.

## Deterministic program map

Add one canonical program-map owner outside the UI, conceptually:

`learn/program-map.json`

The exact location may follow current repository conventions, but there must be one deterministic owner containing exactly 24 stable courses.

Each course should declare at minimum:

- stable course ID;
- course number;
- year;
- semester;
- title;
- purpose/learning intent;
- canonical lesson IDs included;
- advisory prerequisite/dependency references;
- intended PlotPickle application target(s);
- optional estimated effort/read time;
- mapping version/status.

The map references canonical lesson IDs. It does not duplicate curriculum prose or bundled source documents.

The program map is deterministic. Agents do not improvise the course structure at runtime.

## Access model: recommended sequence without gates

Recommended order, prerequisites and current semester are advisory only.

From day one, the learner must ultimately be able to:

- open any semester;
- open any course;
- open any lesson/reference through Explore/All Curriculum;
- move backward and forward freely;
- complete a later course before an earlier one;
- revisit completed content;
- ignore the recommended journey entirely.

Do not use lock icons, disabled course rows, hidden curriculum, Agent permission, or completion gates as prerequisites.

A later course may say something like `Usually taken after Structure Fundamentals`, but it remains selectable.

Progress records what the learner actually completed, not what PlotPickle thinks they should have completed.

## Navigation model

LEARN should eventually expose two complementary views over the same curriculum/progress authority.

### Journey

Primary guided path:

`LEARN -> Year -> Semester -> 4 Courses -> Lessons -> Apply in PlotPickle`

The learner sees a manageable four-course semester block, current progress, recommended next work, and why a course matters.

### Explore / All Curriculum

Unrestricted reference/index mode across the complete curriculum.

Explore should support useful discovery dimensions such as:

- topic;
- course;
- lesson;
- concept;
- PlotPickle application area.

Journey and Explore must not maintain separate progress truth.

## Curriculum Navigator

The Navigator is deterministic orientation, not an Agent opinion.

It should be able to answer:

- Where am I in the recommended journey?
- Which four courses are in this semester?
- What have I actually completed?
- What is the recommended next course or lesson?
- What will this course teach?
- Why is it placed here?
- Where will I apply it in PlotPickle?
- What did I already complete out of sequence?

Navigator output comes from the program map plus real learner progress.

## Curriculum Integrity Harness

A deterministic integrity harness is required so the UX can be reorganized aggressively without fear of silently losing curriculum.

At minimum it must verify:

- 81/81 archived lessons remain present;
- 95/95 bundled teaching/source documents remain present;
- 88/88 current presentation lessons remain reachable/accounted for;
- 24/24 courses exist;
- every course references valid canonical lessons;
- every canonical presentation lesson is reachable through Journey and/or explicitly classified reference coverage;
- no unintended orphaned lesson exists;
- no duplicate curriculum ownership is introduced;
- advisory prerequisite/course references resolve;
- Explore can reach the complete canonical curriculum;
- source content/hashes remain unchanged unless an explicit curriculum-content change is intended.

The harness protects integrity and mapping. It does not choose pedagogy or creative answers.

## Learning rhythm

The curriculum should not become passive reading only.

Preferred course rhythm:

`LEARN -> APPLY -> CHECK -> CONTINUE`

Where appropriate, APPLY should create or refine something meaningful in the active PlotPickle project, such as:

- character decisions;
- world material;
- structural choices;
- 24/96 work;
- dialogue;
- draft material;
- revision decisions;
- collaboration/provenance records.

CHECK should record learning/application evidence rather than an opaque AI score.

The Human remains creative and canon authority. Completing a course, exercise or Agent conversation must not silently mutate PPF/canon.

## Sage contract

Sage is a teacher/guide, not the curriculum authority.

When relevant, Sage may receive bounded learner context:

- current year/semester/course/lesson;
- actual completed courses/lessons;
- relevant PlotPickle application state;
- canonical retrieved curriculum for the question.

Sage may explain educational continuity, for example that a current concept extends something learned earlier.

Sage may also teach material out of sequence whenever the learner asks.

Sage must never refuse legitimate curriculum access because a recommended prerequisite has not been completed.

## `/` Agent switching

PlotPickle already has the concept of selecting an Agent using `/`. In LEARN and creative work, this should become a genuine perspective mechanism.

Switching Agents must change more than personality or prose tone.

Each eligible Agent should have an explicit skill package and input/output contract so the same question can produce meaningfully different expert analysis.

Possible lenses include:

- Sage — curriculum teacher;
- Fresh Reader — audience/first-read experience;
- Structure specialist — 24/96 architecture and structural movement;
- Character specialist — want, need, contradiction, stakes, agency;
- Dialogue specialist — objective, tactics, subtext, voice, silence/action;
- Producer/Industry specialist — professional and commercial communicability.

The exact Agent list must come from PlotPickle's canonical Agent roster/configuration rather than another hard-coded list.

All Agents may receive the same permitted project evidence and relevant canonical curriculum, while their skills, context shaping, evaluation criteria and response format differ.

Creative disagreement is valid and useful. PlotPickle must not force Agent answers to converge into one synthetic opinion.

## Agent authority boundaries

Agents are expert lenses over shared knowledge and project evidence.

- LEARN curriculum remains shared canonical knowledge.
- PPF/project evidence remains the project truth/canon boundary.
- Agents may interpret, critique and recommend differently.
- Agents cannot rewrite canonical curriculum.
- Agents cannot silently mutate canon/project state.
- Agent disagreement remains advisory.
- The Human decides which advice to use.
- Existing provider/model/tool authority remains in force.

A future `/panel` capability may ask several Agents independently and summarize agreements/disagreements, but it is optional and should not expand the first implementation unnecessarily.

## Skin V1 staging and #1915 compatibility

The current #1915 Writer's Craft work deliberately introduced exactly one first submenu using nine existing collection names and stopped before lesson/module navigation.

That compatibility boundary must be respected.

Existing collection names/order remain valid:

1. Screenwriting Foundations
2. Visual Writing & PlotPickle
3. The 24 Blocks Method
4. AI-Assisted Revision
5. Characters in Motion
6. Dialogue in Motion
7. Story Craft Essentials
8. Working Together
9. Collaboration, Formats & Ownership

Do not simply replace those nine rows with the 24-course model in one large navigation rewrite.

The 24-course Journey should be introduced as an additional orchestration/navigation layer beneath or alongside the approved Writer's Craft hierarchy, with a migration only if focused regressions prove the existing contract is preserved.

## First visible UI target

The first UI slice should show the architecture without opening new curriculum content.

Desired visible route:

`Dashboard -> Writer's Craft -> LEARN Journey -> 6 Semesters -> 4 Course shells each`

Requirements:

- Journey destination is genuinely wired and keyboard reachable;
- six semesters are visible/navigable;
- each semester exposes four course shells/titles;
- Back/Escape and Skin V1 keyboard-directory semantics work;
- the course-content destination remains truthfully unavailable/preview-only at this stage;
- no lesson body is newly exposed from the Journey rows;
- unfinished destinations must not display connected status.

This allows visual/UX review before the curriculum itself is rewired.

## Gradual implementation plan

This issue must not be attempted as one PR.

### Phase 0 — baseline inventory

Freeze the current LEARN evidence before reorganizing anything.

- record 12 topics / 81 archived / 95 sources / 88 presentation lessons;
- add reproducible baseline/hash evidence;
- record #1915's nine Writer's Craft rows as compatibility evidence;
- no UI, curriculum or Agent changes.

Exit: baseline reproducible and existing LEARN validation green.

### Phase 1 — 24-course map only

Design the journey without UI changes.

- add schema/owner;
- define 24 stable course IDs, four per semester;
- map canonical lesson IDs;
- record purpose/advisory prerequisites/application targets;
- place deeper Industry/professional material primarily later;
- no locks.

Exit: 24/24 courses validate and curriculum content is unchanged.

### Phase 2 — integrity harness

Prove the mapping cannot lose knowledge.

- validate complete lesson/source/presentation coverage;
- detect orphaned lessons, duplicate ownership, invalid refs and broken prerequisites;
- preserve existing LEARN validator behavior.

Exit: deliberate bad fixtures fail closed.

### Phase 3 — visible Skin V1 Journey shell

Make the 6 x 4 structure visible before content wiring.

- preserve #1915 Writer's Craft submenu;
- add wired Journey destination;
- show years/semesters/course shells;
- support keyboard/back navigation;
- keep lesson content unavailable from the new rows.

Exit: UX is visible/testable without curriculum mutation.

### Phase 4 — one-semester vertical slice

Wire only Semester 1's four courses.

- connect four course shells to mapped canonical lessons;
- prove no copied content;
- preserve unrestricted existing curriculum access;
- add progress that permits out-of-order completion.

Exit: one complete four-course semester works end-to-end.

### Phase 5 — expand to six semesters

Scale the proven pattern to Courses 05–24.

- reuse the same components/contracts;
- keep all courses selectable;
- recommended-next remains advisory;
- actual progress may be out of order.

Exit: 24/24 courses reachable.

### Phase 6 — Explore / All Curriculum

Make self-directed learning a first-class path.

- unrestricted browse/search across all curriculum;
- same progress authority as Journey;
- no hidden/locked lessons.

Exit: user can ignore Journey completely if desired.

### Phase 7 — APPLY / CHECK

Connect learning to real PlotPickle work.

- begin with one or two representative course/application paths;
- Human explicitly approves project/canon changes;
- CHECK records evidence, not an opaque score.

Exit: educational loop proven safely.

### Phase 8 — Sage journey awareness

Only after deterministic Journey is stable:

- pass bounded current-course/progress context to Sage;
- support continuity teaching;
- preserve unrestricted out-of-order teaching.

Exit: Sage improves guidance without becoming authority.

### Phase 9 — `/` Agent lenses

Only after the learning architecture is stable:

- reuse canonical Agent roster;
- define real skill/input/output differences;
- prove same question produces genuinely different expert perspectives;
- preserve provider/tool/canon boundaries.

Exit: at least two or three qualified Agents provide materially different analyses.

### Phase 10 — optional `/panel`

Only if useful after Agent lenses are proven.

- independently query multiple Agents;
- summarize agreement/disagreement;
- no new creative authority.

This phase is optional and should not block #1918 if it materially expands scope.

## Merge discipline

Prefer one PR per phase. Split a phase again if it starts touching too many ownership boundaries.

Do not combine curriculum mapping, navigation redesign, progress persistence, Agent contracts and project-application behavior in one PR.

For every phase:

- start from current main;
- run focused regression first;
- run existing LEARN and #1915 compatibility tests;
- preserve curriculum hashes/content unless explicitly required otherwise;
- stop and fix regression before expanding scope;
- require convergence and exact-head gates where repository policy requires them.

The intended accumulation is:

`inventory -> map -> integrity -> visible shell -> one semester -> all semesters -> Explore -> Apply -> Sage -> Agent lenses`

## Non-goals

- deleting curriculum to simplify UX;
- condensing 88 presentation lessons into 24 replacement documents;
- locking later semesters;
- forcing prerequisites;
- requiring an Agent to unlock knowledge;
- letting an Agent decide canonical course order at runtime;
- making Sage or another Agent final creative authority;
- forcing Agents to agree;
- exposing unfinished lesson content during the initial Journey shell;
- changing PPF canon authority;
- changing PlotPickle Score authority;
- creating another Agent registry/provider layer;
- duplicating source text.

## Acceptance criteria

1. Exactly 24 deterministic courses are grouped four per semester across six semesters.
2. The program map references existing curriculum rather than duplicating it.
3. 81 archived lessons, 95 bundled sources and 88 presentation lessons remain accounted for.
4. The integrity harness fails closed on missing/orphaned/invalid mapping.
5. Recommended sequence never becomes access control.
6. Journey and Explore share one curriculum/progress authority.
7. The learner can ultimately open any semester/course/lesson regardless of prior completion.
8. Industry/professional material is generally sequenced later unless a specific dependency justifies earlier placement.
9. LEARN -> APPLY -> CHECK -> CONTINUE preserves explicit Human authority over project/canon changes.
10. Sage uses bounded journey context but cannot gatekeep or rewrite curriculum.
11. `/` Agent switching uses canonical Agent registration and materially different skill/input/output contracts.
12. Agent disagreement remains advisory and visible.
13. Initial Skin V1 work shows the 6-semester / 4-course shell without exposing new lesson content.
14. Unavailable content destinations are represented truthfully as unavailable, not falsely connected.
15. Existing #1915 Writer's Craft compatibility is preserved or deliberately migrated with regression evidence.
16. Each implementation phase is independently testable and mergeable.
17. Convergence and required exact-head gates are green before each merge.

## Governing product statement

PlotPickle should feel like a well-designed learning program without behaving like a gatekeeper.

The curriculum provides knowledge. The Journey recommends a path. The Navigator explains where the learner is. The harness protects completeness. Sage teaches. Other Agents provide different expert lenses. The Human chooses the route and the advice.