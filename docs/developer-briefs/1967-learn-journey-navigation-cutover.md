# #1967 — Writer's Craft / LEARN Journey navigation cutover

Parent: #1962  
Related roadmap: #1918 — Phase 5 remains paused.

## Human observation

The current Writer's Craft path exposes two competing navigation models:

1. a dedicated `[J] LEARN Journey / 24-Course Program` bridge row; and
2. nine legacy `Existing Collection Preview` rows from the older Learning Studio organization.

The Human has approved retiring the nine legacy rows from visible navigation and using the canonical 6-semester / 24-course Journey as the Writer's Craft navigation itself.

## Target experience

`Dashboard → Writer's Craft → 6 Semesters → 4 Courses → Lessons where currently wired`

There is no extra Journey bridge click and no visible legacy collection directory.

The Dashboard Writer's Craft description should use broad story-craft language rather than `Learn Storytelling Essentials (Screenplay Writing)`.

## Authority and compatibility

The cutover changes navigation only.

- `learn/program-map-spec.mjs` and the resolved program map remain the 24-course authority.
- `learn/journey-baseline.json` continues to record the nine #1915 collection names as historical compatibility evidence.
- The legacy collection names are not deleted from baseline/history merely because they are no longer a Human-facing route.
- No canonical lesson/source body is changed.
- The Phase 0/1/2 integrity validators remain authoritative for 81 archived lessons, 95 bundled sources, 88 presentation lessons and 24-course coverage.
- PPF `learning.completedLessonIds` remains progress truth.

## Phase 4 behavior preserved

This cleanup must not become #1918 Phase 5 by accident.

- Semester 1 / Courses 01–04 remain wired to canonical lessons.
- Semesters 2–6 remain preview-only.
- All six semesters remain selectable from day one.
- Course order is advisory only.
- Escape/Back returns from the Journey to Dashboard.

## Skin V1 navigation

Dashboard `Writer's Craft` remains the connected primary menu destination and shortcut `1` remains stable.

When activated, Dashboard mounts `LearnJourneyPreview` directly. The former `writer-craft` collection-menu surface and `[J]` bridge are retired from the live Human route. The Journey retains the existing Skin V1 full-width directory geometry, keyboard shortcuts and status indicators.

The live WebMCP audit must therefore prove:

- keyboard shortcut `1` opens `[data-skin-menu='learn-journey']` directly;
- exactly six semester rows are visible;
- no `writer-craft` legacy menu step is required;
- Semester 6 can still be opened directly and shows four preview-only course shells;
- Escape from courses returns to semesters and Escape from semesters returns to Dashboard.

## Regression migration

Older #1915/#1954/#1918 tests intentionally protected the nine collection rows while the Journey was being staged. #1967 is the explicit migration point.

Those tests must now protect the durable contracts instead:

- Dashboard naming/logoff/settings behavior remains intact;
- the baseline still records nine historical collection names;
- the Dashboard production component no longer renders those collection labels;
- the Journey is directly reachable and preserves its full-width Skin V1 geometry;
- Phase 4 Semester 1 wiring and guided-not-gated behavior remain unchanged.

Do not restore obsolete collection-preview UI merely to satisfy historical assertions.

## Out of scope

- #1918 Phase 5 expansion;
- wiring Semesters 2–6;
- Explore / All Curriculum;
- LEARN → APPLY → CHECK → CONTINUE;
- Sage or `/` Agent lenses;
- curriculum prose/source changes;
- startup defaults;
- favicon/product-identity sweep;
- Community changes;
- dashboard footer feedback.

## Acceptance

1. Writer's Craft dashboard copy no longer says `(Screenplay Writing)` and points to the 24-course Journey.
2. Writer's Craft opens the six-semester Journey directly.
3. The nine old collection rows are absent from live production navigation while their compatibility baseline remains intact.
4. Phase 4 Semester 1 remains wired and Semesters 2–6 remain preview-only.
5. Keyboard, direct-semester shortcuts and Escape/Back behavior remain correct.
6. Phase 0/1/2 curriculum validators remain green.
7. Live WebMCP/UI conformance and Visual Director are green.
8. #1967 development convergence reports `CONVERGED` against the real diff.
9. Stop for Human merge approval when the exact PR head is green.