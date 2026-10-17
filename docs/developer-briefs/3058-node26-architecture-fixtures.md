# Node 26 architecture fixture execution

Issue: #3058. The shipped runtime and Windows product CI already use Node 26.12.0. Architecture CI retained Node 22.13.0 because the active Creative Transaction provider fixture requested the removed `stripTypeScriptTypes` transform mode.

Use native type stripping for that fixture's erasable TypeScript and run all seven architecture layers on the same exact Node 26.12.0 version as the product. Preserve every provider lifecycle, fingerprint, review, recovery, and fail-closed assertion. The Node 26 runtime regression must execute without a skip and reject the old architecture runner pin.

Only the active verification catalogue is in scope. Historical, uncatalogued fixtures with obsolete transform-mode calls remain historical execution debt; do not broaden this repair into unrelated assertions or application changes. No compiler dependency, provider calls, project mutation, or story changes are needed.

Verification: admit revised tests against approved WHITE-PAPER-V3 W8/W9; reproduce the active provider fixture failure on Node 26; pass the unchanged behavioral assertions with native stripping; pass native Temporal/runtime pin checks, focused UAT contracts, production build, independent exact-head seven-layer CI and applicable Windows product gates. PR #3060 separately supplies full installer lifecycle proof. Keep #3058 open until both changes and their proof succeed.
