# #3123 — Story Factory selected-project disappearance, safe transition evidence

## Windows observation
Owner read-only UAT ran on exact main `6593047fc002e48e31dac751166006fffb75cb06`. Dashboard startup, 32-surface catalogue and 126-element UI conformance passed, but Story Factory reported 55 checkpoints with six failed project-continuity assertions. Every failure expects the same project fingerprint (`7E9B462480EA`) and observes `none`: Outline, Write, Storyboard, Previs, Timeline, and final story stability. Port 4173 was free after the owner test. These are observed facts, not evidence that the user switched projects.

## Boundary
The verifier currently checks the first non-empty `plotpickle.project-library.session-project` key regardless of profile. The authenticated profile has a specific session project key and profile-scoped registry. A non-empty session key for a foreign profile must never satisfy the genuine Human's story continuity.

`hydrateProfilePrivateBrowser` may clear browser session data while hydrating profile state, and `loadActiveLibraryProject` may clear the selection when the requested project snapshot does not exist. These are candidate sources of disappearance; neither is proven by the owner's abbreviated report. Do not automatically restore, overwrite, select, save or change the Human's project to make a test pass.

## This diagnostic PR
Capture a safe read-only transition report under `.artifacts/webmcp-acceptance/story-factory-read-only-journey/exact-head-project-session-evidence.json`. Sample before entering each downstream stage, once rendered, and after returning to the Dashboard. Include only Boolean indicators and small counts of current-profile key presence, matching expectation, other-profile selection keys, registry presence/shape, registry active match, and whether registry contains expected unarchived ID.

Do not include raw project IDs, profile IDs, user content, tokens, credentials, storage values or project snapshots in the new report. Preserve the existing exact-project equality assertions as the PASS/FAIL gate and leave browser diagnostics intact. No Generate/Save/Lock/Approve or provider calls are added.

## Verification and remaining work
The new #3123 Node tests simulate private sessionStorage and assert report keys expose no raw identifiers, never mutate browser storage, distinguish missing selection from foreign-profile selection and preserve the existing journey's project assertions. Static/fixture CI is NOT a Windows Browser PASS or a repair to project persistence.

After exact-head gates: run owner isolated LOCAL Windows Story Factory UAT and inspect the safe report. If the exact profile's key disappears while its registry still holds the expected project, investigate profile rehydration and lazy snapshot reads; if the selected key survives but verifier's unscoped read is inconsistent, fix the verifier; if registry also loses the selection, trace durable profile writes. No issue closure until full read-only journey has zero failing checkpoints, followed by production STOP proof for #3118.
