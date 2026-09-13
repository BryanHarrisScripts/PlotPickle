# #1976 Phase D — Canonical integration of authored enrichment

## Goal
Promote the eight independently authored C1/C2 lessons into the live canonical LEARN runtime without rewriting or duplicating their lesson bodies.

## Canonical integration model
The original 81-lesson / 95-source #1918 archive remains an immutable historical baseline. Phase D adds an explicit canonical enrichment layer that references the already-authored C1/C2 lesson files.

The current product inventory after promotion is:

- 12 topics
- 89 canonical archived lessons
- 95 bundled source documents
- 96 presentation lessons (89 canonical lessons + 7 promoted Foundations references)
- 24 Craft Modules
- 8 #1976 enrichment lessons

The eight enrichment lessons add no bundled external source bodies. Their research/provenance metadata remains attached to the authored files, so the 95 bundled-source baseline does not change.

## Authority
- Curriculum teaching body: existing LEARN archive plus `learn/enrichment/1976-canonical.json` references.
- Program map: index/orchestration only; exactly one owner Craft Module per canonical lesson.
- Completion/progress: unchanged at `PPFProject.learning.completedLessonIds`.
- Human learning sequence authority: unchanged; all Paths, Craft Modules and Explore remain unrestricted.
- EA/Sage: unchanged by Phase D.
- C3 specialist enrichment: explicitly out of scope.

## Ownership assignments
- `scene-craft-pressure-and-turn` → course-15 Drafting Fundamentals
- `screenplay-format-and-delivery` → course-15 Drafting Fundamentals
- `adaptation-source-to-screen` → course-16 Drafting the Full Story
- `professional-pitching-and-representation` → course-24 Professional Practice & Industry Context
- `series-episode-season-architecture` → course-08 Structure in Motion
- `series-engine-and-bible` → course-09 24/96 Story Architecture
- `writers-room-story-breaking` → course-21 Collaboration Workflow & Handoff
- `half-hour-comedy-craft` → course-08 Structure in Motion

## Integration requirements
1. Create a canonical #1976 registry that references all eight authored files and assigns stable canonical numbers/owners.
2. Build one adapter that augments the 12 topic documents at runtime without copying lesson bodies.
3. Extend the 24-course map so every enrichment lesson has exactly one owner.
4. Journey and Explore must surface all eight lessons automatically from the same canonical projection.
5. Current catalog totals become 89 archived / 96 presentation / 95 bundled sources.
6. Preserve the original #1918 baseline hashes and validate the enrichment layer separately.
7. Add a deterministic enrichment-content SHA-256 and freeze it after the first CI calculation.
8. No grading, gating, compulsory revision or Agent story authority is introduced.

## Verification
Phase D must prove:
- all eight IDs are canonical and reachable in Journey + Explore;
- exactly one Craft Module owns each canonical lesson;
- 89 canonical archived lessons and 96 presentation lessons resolve;
- bundled source count remains 95 and source IDs remain unique;
- #1918 base lesson/source hashes remain unchanged;
- #1976 enrichment lesson bodies match a frozen Phase D enrichment hash;
- C1/C2 source files remain single-source teaching bodies rather than duplicated JSON;
- Paths remain open/advisory-only and progress semantics are unchanged;
- C3 remains absent.

## Non-goals
Do not author C3 lessons, alter EA/Sage behavior, add Agent lenses, change project learning schema, or modify story canon authority.
