# #3302 — F00 W8/W9 independent admission candidate packet
**Date:** 2026-10-27
**Status:** AUTHOR-PREPARED, NOT ADMITTED, NOT INDEPENDENTLY SIGNED.

## Reviewer mandate and boundary

This packet requests genuinely independent examination of three NEW test editions on draft PR #3322. It does not grant ADMIT, protected truth modification, Windows process trust, reviewer credentials, Lane B execution or merge permissions. The reviewer `PP-F00-D02-W0001` (alias `PP-F00-LA-W0001`) is not yet provisioned/qualified; no one may act as that identity just because the owner authorised engineering work.

**Frozen code/test checkpoint before this packet:** `59dfd821d82b022cf19b2aa532ca29b9085dac56`. Re-fetch the final PR HEAD at review; compare exact SHA-256 for each test and implementation input. The packet commit itself is not a signed reviewer receipt.

## Exact test editions, proposed existing WHITE-PAPER-V3 truths

| Test target | SHA-256 content digest | Git blob ID | Proposed truth obligation |
| --- | --- | --- | --- |
| `tests/issue-3302-lane-a-admission-receipt.test.mjs` | `8bd678493cdfd433b0a443d65bbe1c7c14c8f1f15d719d56536c4d1ff3e9c4f8` | `84b9378cf651653053a748d129fa3e4105d1ee10` | WHITE-PAPER-V3 W8 + W9 |
| `tests/issue-3302-lane-a-reviewer-enrollment.test.mjs` | `5e6769c3d67fca127142acf1320e2484164d35f4fadfea8b3f9fa1c306cf3eea` | `524ec800b05356d0f8798400736e711d1b5fcc57` | WHITE-PAPER-V3 W8 + W9 |
| `tests/issue-3302-lane-a-service-identity-policy.test.mjs` | `6ecba980d77b8be6a6b3f6a3d26bba003785c1045edb5933ed4029d121eb03f6` | `3bf35db8ee275f031580fdddb6698f22d1c88e6a` | WHITE-PAPER-V3 W8 + W9 |

**Approved normative source** `docs/white-papers/AI_Programming_Evolution_White_Paper.md`: SHA-256 `7fd538b813014cf94505903a32e171fca344068d67d15036fbe0fdcb7859c27d`, independently matched by author to `config/verification/test-catalog.json`'s already approved WHITE-PAPER-V3 3.0 sourceDigest. W8 = independent verification as acceptance; W9 = preserve source obligations, prevent repeated repair and unexpected changes. Author-computed match is not a reviewer-issued ADMIT.

## Direct and transitive implementation inputs

| Input | Exact SHA-256 | Git blob |
| --- | --- | --- |
| `scripts/engineering-team/verification/lane-a-admission-receipt.mjs` | `3b00a47641f1d6a27a42dbf31a233f208b960dd6527af59dd8f9c47543437b67` | `252dbb7907f61b870dea0360ba6c778fac5ef571` |
| `scripts/engineering-team/verification/lane-a-reviewer-enrollment.mjs` | `421870e19b224ac41ca9ff998722c0b858fa2a79035af8b06d14f80c229f92d7` | `6856a5eaf6c31dbb51e7403e64400e8f3b2e4ed1` |
| `scripts/engineering-team/verification/lane-a-admission-chain.mjs` | `de5369c7f881afc83a6695a1b82ccd4d266969f87f76aea9b311708afcd6f173` | `0572e93e888306397235fbc348105b9be73a6fb5` |
| `scripts/engineering-team/verification/lane-a-service-identity-policy.mjs` | `911c833e1719f618e31808499e92acb771dcca9fb895b28852b7e2bff450c573` | `4afc6f83477d7ee29cb16727684f366f75de8e9d` |
| `scripts/engineering-team/windows/verification/Inspect-PlotPickleLaneAService.ps1` | `ea73e47509dee34eefec7fcd8dee81f4a4b5627f960289492561db4d7763b352` | `9972479edbc6346360cff42e4076bb206272b7fb` |
| `scripts/engineering-team/windows/verification/Inspect-PlotPickleLaneAIdentity.ps1` | `c1f73f1fa6b1bb1495a63b4aeca0027aea25c290addd75b839af1ec8c4f430be` | `fd704743a5a020320108d572434b02ddd35528cd` |

Catalogue-binding **proposal only**, to be considered after actual independent signer verdict: one binding per test path and targetDigest, exact `inputs` digest set for imported/runtime-read files, `truthRefs: [{truthId:"WHITE-PAPER-V3",obligationId:"W8"},{truthId:"WHITE-PAPER-V3",obligationId:"W9"}]`, `scopes: ["unit-fixture","static-source"]`, and explicit limits. A separately authorised maintainer must select/create a reviewed `verification.*` catalogue entry. Do not insert self-approved bindings into `config/verification/test-catalog.json`.

## Existing author-side evidence and limits

- Receipt-verifier tests cover Ed25519 signatures/tampering, exact **40-character** Git commit, nonempty test/input editions, expected author, forbidden self-review, revoked key and negative FIX/UNPROVEN. Corrected privilege bug: a valid ADMIT remains evidence **only**; unsigned top-level privilege extensions and malformed signed timestamps are rejected, `mayUpdateCatalogue:false`; a different maintainer is required.
- Reviewer enrollment fixtures cover Ed25519 registrar + reviewer proof-of-possession, fixed actor/alias and distinct claimed Windows SIDs, key revocation, expiry and role scope. A verified fixture remains `SIGNED_ENROLLMENT_CANDIDATE`, not reviewer activation.
- New service identity policy is fixed to noninteractive `NT SERVICE\PlotPickleLaneA` with canonical actor `PP-F00-D02-W0001`, one Always-on installer, separate coding SID, fixed binary digest and observed registrar evidence, read-only candidate output, STOP and no catalogue/coding/merge capability. **11/11 source-equivalent author V8 assertions PASS** including a static inspection of Windows PowerShell script; not native Windows or actual Node test-runner.
- The Windows PowerShell service inspector is **read-only**, examines fixed SCM service, optional running process token via CIM and reports `independentlyAttested:false`. It has not run on owner Windows; a source-local observation is not the independent registrar.
- Approved single installer architecture is on MAIN (#3324) and shared four-factory workflow on MAIN (#3326), neither creating an actual reviewer identity.
- Exact-head Architecture Verification is intentionally BLOCKED on **unadmitted** #3302 tests; any new test editions in this PR also require independent admission. No source mutation in MAIN, no signer key or protected catalogue updates.
- The live owner Windows Supervisor is independent of PR authorship and running but the coding worker and independent reviewer service are **not** proven. A passing old allowlisted Windows test is not proof of #3322.

## Adversarial checks required of independent F00 reviewer

Verify actual exact-head unit tests (not author-supplied results), recompute test/input SHA-256 from trusted GitHub editions, inspect all denied privileges and STOP/replay negatives, explicitly reject author/registrar/reviewer identity collapse, challenge ledger replay, forged local observation, mutable trust registry, and discrepancy between claimed signer identity and real Windows process-token SID. Demand evidence of non-exportability/ACL isolation or mark `UNPROVEN`. Review service-host SCM correctness (Session 0, signed native service, no raw script-as-service) and avoid claiming installer proof from declarative policy alone.

**Allowed independent verdicts:** `ADMIT`, `FIX`, `REJECT`, or `UNPROVEN`, signed by an independently qualified nonauthor with its own protected key and cited exact evidence. If admission is not independently attributable, verdict is UNPROVEN and all production controls remain disabled. A valid independent ADMIT may allow a **different** authorised catalogue maintainer to propose source-exact bindings, never a reviewer self-merge.

## 2026-10-27 author-side unsigned-extension hardening

The enrollment verifier now rejects any unrecognized top-level field, including attempted unsigned `mayMerge` or `canEditCatalogue` privilege assertions, before checking enrollment signatures. A focused negative regression was added. The SHA-256 and Git blob entries above were refreshed for the two changed files. This is an author-prepared source edition update, NOT independent admission, NOT a trusted reviewer receipt, and NOT evidence of native Node/Windows test execution. Recompute all editions and obtain separately signed W8/W9 review before protected catalogue binding or release.
