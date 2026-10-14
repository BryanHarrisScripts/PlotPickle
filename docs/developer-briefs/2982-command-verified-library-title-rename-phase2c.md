# #2982 Phase 2c — Command Library title review and Human-confirmed rename

## Human-established intent (2026-10-14)
"Also CMD should also be able to review titles and rename if needed like in this case."

Context: the Human's `PlotPickle open Brotherly Love` failed because no exact matching Human-owned saved PPF was found. Phase 2b #2990 now lets `PlotPickle library` show actual saved current-profile titles, IDs and source classifications. This phase enables a **reviewed, deliberate, title-only rename of the uniquely identified existing saved Human PPF** without leaving Settings → Command.

Do not infer from filename similarity or the person's stated target movie that a saved PPF *is* Brotherly Love. Do not rename examples, synthetic fixtures, a different profile's story, an archived/absent project or a near match. A title edit is not screenplay or media authority.

## Truth contract and authority
- `PlotPickle library`: current-profile read-only titles, source categories and IDs.
- `PlotPickle rename <exact saved project ID> to <new title>`: **PREVIEW ONLY** showing old title, ID, revision and new title; offers the exact confirmation. No mutation, saving, provider calls or agent Run.
- `PlotPickle confirm rename <same ID> revision <same integer> from "<old title>" to "<new title>"`: **explicit Human consent** bound to exact profile, ID, old title and saved revision. The implementation re-reads the current Library summary and project snapshot before any write.
- Block unverified profile, nonunique/absent IDs, reference/synthetic classifications, invalid titles, destination-title conflicts, active different PPF with possible unsaved drafts, changed title/revision after preview, failed flush, failed switch/Save, and uncertain encrypted commitment. Don't convert or overwrite PPFs as a workaround.
- Reuse `saveActiveLibraryProject`, `switchActiveLibraryProject`, `persistActiveProfileProject("", projectId)`, and `flushProfilePrivateWrites`. These are the existing profile-owned and encrypted Library paths; do not create a second title store or modify screenplay import source files.
- On success verify exact selected ID, target title and content equivalence (all PPF fields other than displayed title/revision/update timestamp remain unchanged), current-profile title summary and Save acknowledgement. Emit `TITLE RENAME VERIFIED` **only** for the observed scope, and explicitly state that a fresh process/reopen acceptance has not been demonstrated by the pure tests.
- Existing `PROJECT_LIBRARY_CHANGED_EVENT` emitted by the Library selection and Save routines keeps GUI state in sync. Do not allow unreviewed agent title suggestions to skip the confirmation.

## Existing owners
- `app/_components/settings/plotpickle-creative-command.mjs` + `.d.mts`: exact command parser, preview/rename truth checks, bounded error reports.
- `app/skin-v1/global-dsdd-conversation.tsx`: authenticated current-profile Command dispatch. No HTML-only fake interactions or direct credential access.
- `core/storage/project-library-browser.ts`: real selection and Save with unchanged project ID and existing metadata/source provenance.
- `core/storage/profile-private-browser.ts`: encrypted profile persistence and confirmation; no token in Command receipts.
- `tests/issue-2982-command-creative-discovery.test.mjs`: directly executed pure service-bound operation with positive/negative and post-Save field preservation, plus actual owner wiring assertions.

## Delivery and limits
Test admission under preapproved unchanged white paper v3 W8/W9, focused regressions, seven CI layers, Windows build and Settings Command lane. The mock tests do **not** prove private Brotherly Love content, live Windows user's selected Library snapshot, independently reopened vault, or production/cinematic quality. #2943 remains real authenticated Windows acceptance. #2982 remains open for agent orchestration, OpenAI writing/images, MiniMax H3 motion, durable run receipts and movie assembly under #2986.

This feature does not authorize paid media or allow Command to rename a project merely because it was a likely title match.
