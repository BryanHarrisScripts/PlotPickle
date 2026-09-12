# #1969 — Explicit story startup

Parent: #1962  
Related roadmap: #1918 — Phase 5 remains paused.

## Problem

PlotPickle's root router currently treats a persisted active Library project as permission to reopen the Dashboard automatically. That makes PlotPickle Score and other story-facing surfaces appear to restore the previous story on launch even when the Human has not chosen a story in the new session.

The Library persistence model is not the problem. Saved stories and the active Library record are durable local project state and should remain intact. The startup router is the regression: bare `/` currently selects Dashboard whenever `hasActiveLibraryProject()` is true.

## Product contract

Normal PlotPickle startup must begin with no story-facing workspace entered automatically.

Bare startup flow:

`PlotPickle launch -> Library -> Human chooses Resume / Open Story / New Story -> story-facing workspace`

A previous story may remain visible in Library as the last active/resumable project, but PlotPickle must not take the Human into that story merely because it exists.

## Implementation

Keep the existing Library/project authority unchanged.

1. `requestedWorkspace()` in `app/page.tsx` defaults to `library` instead of consulting `hasActiveLibraryProject()`.
2. Explicit `?workspace=...` requests remain honored exactly as today.
3. The initial React workspace state is `library`, matching the startup contract before browser storage is ready.
4. Persisted-project repair runs only when a workspace was explicitly requested. Bare startup does not repair-load a prior story as part of automatic restoration.
5. Existing Library actions remain the explicit entry points:
   - `Resume` / `Open Story` -> `/?workspace=dashboard`
   - `New Story` -> `/?workspace=learn`
   - confirmed example/preset/story loads preserve the current safe-switch flow.

## Authority boundaries

- Project Library remains the only project persistence authority.
- PPF/canon is unchanged.
- PlotPickle Score authority is unchanged; this slice changes only whether a story-facing workspace is entered automatically.
- No project is deleted, archived, cleared, rewritten, or replaced on startup.
- No new local/session storage authority is introduced.
- No `Load last story on startup` preference is added in this slice. If added later, it must default Off.
- No Community, BUZZ, LEARN curriculum, Agent/provider, branding/favicon, or menu-footer work belongs here.

## Verification

Focused regression: `tests/issue-1969-explicit-story-startup.test.mjs`.

It proves:

- bare startup resolves to Library even when an active project exists;
- explicit workspace routing still works;
- bare startup no longer unconditionally repairs/loads persisted project state;
- Library still requires explicit Resume/Open/Create actions to enter story work;
- persistence authority remains unchanged;
- no future startup-preference mechanism was smuggled into this slice;
- ownership/test-catalog registration is present;
- issue-specific convergence reports `CONVERGED` against the real diff.

Exact-head seven-layer Architecture Verification remains merge authority. Stop for Human merge approval when green.
