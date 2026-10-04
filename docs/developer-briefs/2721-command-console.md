# Command conversation cleanup and intent correspondence — #2721

## Problem and scope
Settings → Command retains old Human/DSDD messages with no clearing action. A short map-header report also exposes exact-word correspondence failing when a valid interpretation spells joined surface names with spaces. The rejected reply is absent from the screenshot; its actual correctness is unknown.

## Acceptance
1. Explicit Clear console followed by Confirm clear removes the current profile's active conversation from the display, persisted session and future interpretation context. Cancel and failure preserve history; unsent narration is retained.
2. Profile cookie, origin and CSRF boundaries protect clearing. Another profile cannot clear the owner. Empty clearing does not launch Pi or inference.
3. Saved story content, historical locked intent and publication records are preserved. Historical intent cannot authorize new drafting/publication after clearing. Pi retains append-only raw history while context edits hide old Human/assistant messages, including after reopening.
4. MindMap/WorldMap and Mind Map/World Map match symmetrically without lowering integrity thresholds. Repetition, unrelated/stale replies and unjustified no-action remain rejected. Actual header UI changes are outside this repair.
5. Existing focused regressions/UAT and production build run; Windows Product Gate independently observes confirmation, cancel/failure, unsent narration preservation, actual authenticated clearing, unchanged story and real Pi context projection at the exact PR head.

## Owners and decisions
Use the existing global DSDD component, protected profile-private session gateway and Pi session bridge. No new data domain, dependency, filesystem deletion or implementation authority. Preserve historical intents; removing active Human entries naturally invalidates current locked intent. Clear is shared with the existing conversational UAT owner because Command already shares that session.

## Validation
Nearest regressions: tests/issue-2371-dsdd-integrity.test.mjs and tests/issue-2717-command-gateway.test.mjs. Extend the existing Windows scripts/settings-command-product-proof.mjs with real SDK and browser observations. Local Linux checks supplement rather than replace Windows Product Gate. Convergence checks declared scope and evidence; exact-head CI independently reruns gates.
