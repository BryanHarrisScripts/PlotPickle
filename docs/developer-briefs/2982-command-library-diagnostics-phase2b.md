# #2982 Phase 2b — truth-first Command Library inventory diagnosis

## Reproduced Human evidence (2026-10-14)
After merged #2989, regular PlotPickle Command received `PlotPickle open Brotherly Love` and returned **"No current-profile saved PPF exactly titled BROTHERLY LOVE was found"**. The Human intended Command to discover and select the real Brotherly Love PPF without leaving Settings. The existing operation did not select anything, which is correctly safe but is **not diagnostic enough**: it searches only `listHumanLibraryProjects()` (excludes example/synthetic records) and requires exact normalized title equality; it does not expose any available saved titles or distinguish a non-hydrated profile from a hydrated empty Library.

Human-approved direction in #2982, backed by white paper v3.0 W8/W9: an operational Command must report what it actually observed, preserve precise project/provenance identity and block unsupported transitions, not claim a missing PPF without exposing the search domain.

## Existing owner, no new system
- Pure parser and inspector: `app/_components/settings/plotpickle-creative-command.mjs` + `.d.mts`
- Real Command UI dispatcher: `app/skin-v1/global-dsdd-conversation.tsx`
- Current-profile Library inventories: `listPersistableLibraryProjects()` (all saved categories), `listHumanLibraryProjects()` (Human-owned switch candidates), `sessionActiveProjectId()`, `loadLibraryProjectSnapshot()` and `switchActiveLibraryProject()` in `core/storage/project-library-browser.ts`
- Authenticated vault hydration authority: `profilePrivateBrowserReadyFor(profileId)` and `PROJECT_LIBRARY_ACTIVE_PROFILE_KEY` — not a generic browser localStorage guess.

## Observable outcomes
1. `PlotPickle library` or `PlotPickle list projects` emits a read-only current-profile saved index with actual titles, limited opaque IDs, origin classifications and selected session ID, no story passages, passwords or API keys. **This is a browser-session inventory, not a proof of vault reopen after restart.**
2. If the profile is not verified hydrated for its exact ID, both `open` and `library` fail closed with a profile-specific message and do not reveal stale/cross-profile names.
3. On an unknown exact title, `open` shows bounded near matches (if any) and directs the Human to `PlotPickle library`. If an exact title exists only in an excluded reference/synthetic classification, report the exclusion explicitly; do not overwrite, convert to user, silently select or issue a paid call.
4. When a uniquely named Human PPF really exists, preserve the full prior #2989 successful switch/acknowledged persistence, real status and Block 01 inspection with no extra authorization.
5. A missing title, unloaded Library, unknown current profile and ambiguous candidate are not interchangeable states. Do not use fuzzy matching to choose a story or restore media automatically.
6. Tests must call the actual pure routines on positive/negative current-profile fixtures and assert the UI wiring and authentication guard; green tests remain bounded, with live Human Windows proof **unverified** until rerun.

No OpenAI or MiniMax generation, new project creation, restored archived PPF, DSDD issue publishing, agent Run, source rewrite or bypass of Human creative approvals in this phase. Issue #2982 remains open for real production orchestration.
