# #2982 Phase 2a — select a real saved Library PPF from Settings → Command

**Source of Human intent:** October 14, 2026 Windows UAT: after `PlotPickle status` and `PlotPickle plan Block 01` reported no verified active PPF, the Human asked why Command could not open Library, load/select Brotherly Love itself, and continue without manually returning to Command. See #2982 and #2988. Governing white paper v3.0, unchanged approved story/canon and DSDD contracts.

## Human-visible business truth

A Human who issues the explicit command `PlotPickle open Brotherly Love` with **one** matching existing saved profile-owned PPF and **no different selected PPF** gets that exact Library PPF selected and durable-profile-save acknowledgement verified; Command itself then prints real selected PPF status and Block 01 Plan inspection without moving surfaces.

Command MUST NOT create a new story, load a default Afterglow, switch to a fuzzy match, destroy unsaved work, treat a pending encrypted write as confirmed, forge creative approval, or call OpenAI/MiniMax without a separate grant. Duplicates, missing/unhydrated Library records, stale title/ID/revision, unrelated currently selected PPF, and unknown Save outcomes remain BLOCKED with truthful recovery wording. Explicitly named selection is not a creative Run or paid-media authorization.

## Verified existing implementation owners

- `app/_components/settings/plotpickle-creative-command.mjs` and `.d.mts`: exact PlotPickle command parsing, text/status/plan inspection, and small, injected Command-to-Library selection operation.
- `app/skin-v1/global-dsdd-conversation.tsx`: authenticated Settings → Command UI dispatch, the existing DSDD/voice/OpenPencil paths.
- `core/storage/project-library-browser.ts`: existing `listHumanLibraryProjects`, `loadLibraryProjectSnapshot`, `switchActiveLibraryProject`, `loadActiveLibraryProject`, `sessionActiveProjectId`. The switch broadcasts the existing Library change event, ensuring GUI consumers use the same project.
- `core/storage/profile-private-browser.ts`: existing `persistActiveProfileProject` and `flushProfilePrivateWrites` for encrypted Save acknowledgment, just as `modules/library/ui/library-workspace.tsx` does when opening a saved story.
- `tests/issue-2982-command-creative-discovery.test.mjs`: real command parsing, injected live operation, negative controls and a static GUI owner path audit.

## Invariants

1. Exact title resolves to **one** unarchived current-profile Human PPF; no search across profiles or bundled examples. Duplicate title resolution must be explicit, not automatic.
2. Same existing selected PPF is idempotent. If another PPF is active, fail closed, since Command lacks reliable visibility into unsaved drafts in all workspaces; manual Library confirmation remains the deliberate safe path for cross-project switching in this slice.
3. Candidate ID, title and revision must agree between Library summary, stored snapshot, switch return and post-acknowledgment readback.
4. Only the existing Library selection path is used. No screenplay, accepted Outline plans, media, Run, model/provider keys or story content is mutated by this Command operation.
5. On failure after a possible switch, state and persistence are honestly UNCERTAIN; no success message or automatic paid retry. Subsequent verification must inspect real Library state.
6. The successful Command reply includes project identity/revision and real status and Block 01 inspection; the 25-shot generation pilot, provider readiness and Windows acceptance remain UNPROVEN.

## Test and delivery

Run existing #2982 tests with added execution-path, idempotence, not-found, duplicate, wrong-active-story, snapshot mismatch and encrypted Save uncertainty cases. Preserve older Phase 1 read-only discovery, Pi/DSDD and OpenPencil routes. Run routing-selected regressions, compile/build and seven PR CI gates. This PR is an incremental operation, **not completion of #2982**; phase 2 provider authority registry, phase 3 creative stage execution, phase 4 durable run evidence and #2986 playable production remain outstanding. Live authenticated Windows GUI proof is separately tracked by #2943. Merge only after exact-head checks genuinely succeed.
