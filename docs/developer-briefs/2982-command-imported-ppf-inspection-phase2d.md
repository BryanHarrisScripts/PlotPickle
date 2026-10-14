# #2982 Phase 2d — read-only imported PPF identity inspection from Command

## Human evidence and purpose (2026-10-14)
After merged #2990 and #2991 the Human ran `PlotPickle library` in authenticated Windows PlotPickle. The genuine current-profile Library reports 44 entries, no session-selected project, a **single import whose displayed title is a dash (`-`)**, an Untitled Story, and many Afterglow examples. The Human says the imported story is likely Brotherly Love. This is a **candidate identity**, not verified screenplay title evidence.

The original `PlotPickle open Brotherly Love` is correctly blocked because it matches no saved title. Even the safe rename preview #2991 must not encourage renaming an arbitrary imported story without a source-identification inspection first.

## Approved truth and behavior
1. `PlotPickle inspect <exact saved PPF ID>` is a read-only per-project operation in Settings → Command that inspects the authenticated, hydrated current-profile saved Library snapshot WITHOUT selecting the PPF, renaming, saving, creating, restoring, import/conversion, running an AI agent, spending API credits, or changing screenplay.
2. Verify the exact ID exists in the same profile's saved non-placeholder Library index and agree on saved ID, title and integer revision before inspecting. Recheck profile identity/authority before showing private evidence. Absent ID, inconsistent summary, non-hydrated profile, changed profile or missing snapshot fail closed.
3. Present Library title even when `-`/punctuation-only; ID and revision; saved source classification and origin reference if recorded; screenplay filename/format/analysis status; reported passage census and retention/truncation; at most 3 source section headings and 2 short opening retained passages (limited disclosure inside the signed-in local Command only). Distinguish absent evidence clearly.
4. Never claim the saved PPF is Brotherly Love merely because `sourceKind: "import"`. Let the Human review the report and decide if the source really matches the intended film before offering any title rename. No automatic rename/approval, even for the sole import.
5. Existing `PlotPickle rename <ID> to Brotherly Love` (read-only preview) and separately locked `PlotPickle confirm rename ...` (#2991) retain their exact revision/old-title protections if Human elects to act after inspection.
6. No private screenplay passages, personal local PPF IDs, or snapshots committed to GitHub/CI logs; tests use synthetic content only. No new story store, plaintext credentials, or cloud route.
7. White paper v3 W8/W9 tests must check executed read-only inspection, absent/incorrect title, absent provenance, hydration and profile-change guards, static ownership of existing real Library service, and absence of writes. A green test is **not** local Windows user-content or independent vault-restart acceptance.

### Implementation owners
- `app/_components/settings/plotpickle-creative-command.mjs` and `.d.mts`
- `app/skin-v1/global-dsdd-conversation.tsx`, already wired to `listPersistableLibraryProjects()`, `loadLibraryProjectSnapshot()` and same-profile authority.
- `core/contracts/imported-screenplay-evidence/index.ts` is the approved screenplay provenance contract (sourceFileName, sourceFormat, analysisStatus, totalPassageCount, passages, passagesTruncated, sectionMarkers).
- `tests/issue-2982-command-creative-discovery.test.mjs`, `config/verification/test-catalog.json`, and `config/development-convergence/2982.json`.

### Release and next UAT
On exact-head seven-layer and impact-selected Windows proof success, merge phase into main. Human then updates/restarts and runs:
`PlotPickle inspect <imported project ID from their actual Library inventory>`
Review the filename and opening passage evidence before ever running a rename. If evidence is incomplete, stop and check actual imported source/recovery; do not infer identity. #2982 remains open for creative production orchestration and #2986 for first OpenAI/MiniMax H3 media pilot.
