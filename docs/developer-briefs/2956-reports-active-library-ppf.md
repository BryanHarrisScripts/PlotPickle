# #2956 — Reports reads the selected Library PPF, not an unrelated legacy store

## Human observation and source discrepancy
In the authenticated October 13 Matrix orange preview, Library had a saved Human story and Write/Outline showed actual saved contents while Dashboard > Reports displayed “No saved project was found. Reports is showing the blank canonical project.” Direct inspection of `app/reports/page.tsx` on main confirmed that it reads `window.localStorage["plotpickle.project.v1"]` and passes an unrelated legacy `PlotPickleProject` to `ReportsWorkspace`. That is neither the explicit session-selected Library PPF nor proof of empty project progress.

## Approved truth — REPORT-LIBRARY-001 / WHITE-PAPER-V3 W8/W9
**Identity:** Reports may describe a project only if a live explicit session selection exists and `loadLibraryProjectSnapshot(selection)` returns the **same ID**. Missing/mismatched/unavailable selection must show a visible no-active/unavailable state, never a synthesized zero/blank project or legacy fallback. The selected Library PPF remains sole story authority.

**Evidence:** Reports is read-only. Show only quantities directly derived from the selected PPF: revision, actual stored Block and Mini-Block address count, acceptance timestamps (not finished film), saved Write entries, accepted vs proposed development values, approved non-sensitive writer-reference claims and retained imported screenplay passage/scene/dialogue evidence. Distinguish **retained** imported evidence from reported full passage count and state when truncated. Explicitly mark unsupported runtime, complete scenes, character census, physical production/finished MP4, feedback legacy, and connections as **not verified**. No inference from schema blanks, no counterfeit 24/96 progress, no silent data synchronization.

**No privacy or migration surprise:** Do not migrate or copy privately imported data into `plotpickle.project.v1`; do not alter existing legacy workspace data in unrelated routes. The legacy consolidated model remains in repository but is not called by the active Library Reports route. Avoid claiming support for all its historical advanced cards until an approved canonical PPF projection exists.

## Implementation
- `app/reports/page.tsx` selects `sessionActiveProjectId()` and `loadLibraryProjectSnapshot` through a pure same-ID guard. It refreshes on Library-changed events, focus, page show, and explicit Refresh, using identical entry for direct route and Dashboard lazy Reports surface.
- `modules/reports/model/library-ppf-report.mjs` is the read-only deterministic projection with typed declaration.
- `app/reports/library-ppf-reports-workspace.tsx` renders the nine retained section names against honest PPF-derived evidence, shows active project ID and revision, and labels remaining unavailable material in the UI.
- Negative controls deliberately construct another legacy/mismatched project, no-selection, a truncated import, proposal-only fields, and a synthetic 24×4 structural fixture with only one real acceptance. Source assertions prohibit the old key, other stores, writes, and hidden fallback.
- Scope: five production files (including stylesheet/typed declaration), one fixture test, white-paper catalogue/ownership binding, convergence and brief. The old consolidated reporting engine remains unmodified.

## Evidence limits and Human product follow-up
Synthetic project tests and source-level route/handler checks, plus exact-head seven-layer CI and any selected Windows lanes, prove bounded implementation. They do not show the original real private screenplay, an authenticated Human device, a provider request, actual live browser project switching, full source-equivalence, or an MP4. These outcomes and stale-session/restore-on-restart conditions belong to #2943. CI green is not real product acceptance.
