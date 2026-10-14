# Issue #2961 — explicit Library New identity, film format and intended runtime

## Observed failure / accepted direction
In the authenticated synthetic short-film session, Library > New > Create New Project immediately created **Untitled Story / Feature** with no title, Short Film selection or runtime prompt. Library > Load then described the wrong format. Human wanted a short film. Reuse the existing **profile-owned Library PPF**, its `ProjectLibrarySummary.format`, and its stable ID; never create a parallel store, infer preference from a screenplay title, or rewrite existing projects. This is separate from FDX title parsing #2954.

## Truth requirements — LIBRARY-NEW-001, WHITE-PAPER-V3 W8/W9
- Before any write, require an explicit nonempty Human title (max 160 characters), **Short Film or Feature** choice with no preselected format, and integer intended minutes 1–240. Form suggests 15 for Short Film or 120 for Feature but Human may edit the intended length.
- The first visible Library New action must save those exact normalized Human choices on a *fresh stable profile-owned PPF ID*; summary title/format and canonical project's optional `storyIntent` agree.
- `storyIntent.targetMinutes` is a **planning target**, not screenplay-derived duration, not evidence that any 3-second shot exists and never license to rewrite the approved 4 Acts / 24 Blocks / 96 Mini-Blocks or the 120-minute structural baseline. The target is visible in Library Load.
- Existing Library snapshots, Afterglow Example, Blank startup, imported source and other profiles are not edited, renamed, copied or migrated.
- An existing PPF without `storyIntent` normalizes to `null`; no new creative choice is fabricated for a historical story. The browser Save/Lock path preserves prior intent when it receives an older partial project.
- Do not show a successfully created/loaded project until the encrypted profile save and flush have returned, with active selected identity still intact. A transient confirmation failure must not silently create duplicate entries on an exact retry; hold the original identity, report failure and permit safe retry.
- A confirmed new story uses the existing Matrix Dashboard return/handoff.

## Implementation
- Pure `modules/library/model/new-story-intent.mjs` validates Human input before writing, with a typed declaration and bounded values.
- `modules/library/ui/library-workspace.tsx` presents a labeled title/format/minutes form and pending-save state, passes validated format and intent to `createLibraryUserProject`, requires profile persistence and active-ID confirmation, and displays the target in Load cards.
- The existing Library core's `createProfileUserProject` passes optional intent to its canonical factory, `core/storage/project-library-browser.ts` passes it through to `normalizeLibraryProject`, and `core/storage/library-project.ts` normalizes it as an optional field without changing stored story structure.
- The pre-existing #1969 and #2603 tests are **revised to assert the corrected Human-intent requirement**, not skipped or made green by ignoring the old behavior.
- An independent `tests/issue-2961-library-new-story-intent.test.mjs` tests rejected/no-title/no-format/fractional/out-of-range inputs, a real Library-core in-memory registry and project snapshot roundtrip, nonmutation of another story, exact 24×4 structure, actual source wiring and encrypted save gates.

## Human acceptance and limits
CI fixtures are not a witnessed real authenticated Windows user action. Windows acceptance (open Library New; create a named 13-minute Short Film; see Short Film/13-minute metadata in Load, unload and restart; reopen and compare unique ID/profile snapshot; test invalid input, failure/retry, no duplicate, other story intact) remains independent under #2943 until actually observed. Do not call target minutes a generated runtime or mark screenshots/console evidence as witnessed when absent. No private screenplay, account secrets or provider calls are required by tests.
