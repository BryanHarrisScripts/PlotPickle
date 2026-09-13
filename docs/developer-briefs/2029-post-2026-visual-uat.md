# Issue #2029 — post-#2026 visual UAT repair

## Human authority
September 13, 2026 live Human UAT after #2026 is authoritative for this repair slice.

## Repair set
- restore the approved Dashboard dragon without restoring the retired Score panel or obsolete Dashboard chrome;
- keep the #2026 Dashboard menu order/grouping/status-column contract;
- keep Writer's Craft entering All Curriculum, but make its top-level Back/Escape return directly to Dashboard rather than the obsolete Journey intermediary;
- use available desktop width so lesson/topic/Craft Module context stays readable on one line when it fits;
- stack the five User Profile readiness signals vertically beneath the identity summary;
- restore Issue Log, Licensing and Agents to the same restrained Skin V1 / Matrix-green presentation language already approved on Community;
- preserve existing behavior, IDs, routes, providers and content except for the explicit Writer's Craft return-path change.

## Visual authority
Community is the immediate reference surface for the repaired colors and typography: black canvas, white Human headings, shared terminal type, subtle Matrix-green accents for borders, focus, selection and state. Do not create a new palette.

## Navigation boundary
Writer's Craft currently renders All Curriculum through the Journey host. The old All Curriculum -> Journey -> Dashboard return chain is no longer useful in the #2026 main navigation. A scoped Dashboard return event remounts the Dashboard host to its default state while preserving the existing Dashboard/Writer's Craft ownership boundary.

## Verification
Focused regression coverage lives in `tests/issue-2029-post-2026-visual-uat.test.mjs`. Run exact-head seven-layer Architecture Verification and inspect only failed jobs.

## Relationship to #2030
#2030 establishes the permanent WebMCP Surface Capture Registry. After Human approval of these repaired surfaces, their approved states must become registered visual references so later work cannot silently regress them while remaining green.
