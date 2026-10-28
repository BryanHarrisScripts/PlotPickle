# #3302 — F00 W8/W9 independent admission candidate packet
**Date:** 2026-10-27
**Status:** AUTHOR-PREPARED, NOT ADMITTED, NOT INDEPENDENTLY SIGNED.

## Reviewer mandate and boundary

This packet requests genuinely independent examination of three NEW test editions on draft PR #3322. It does not grant ADMIT, protected truth modification, Windows process trust, reviewer credentials, Lane B execution or merge permissions. The reviewer `PP-F00-D02-W0001` (alias `PP-F00-LA-W0001`) is not yet provisioned/qualified; no one may act as that identity just because the owner authorised engineering work.

**Frozen code/test checkpoint before this packet:** `59dfd821d82b022cf19b2aa532ca29b9085dac56`. Re-fetch the final PR HEAD at review; compare exact SHA-256 for each test and implementation input. The packet commit itself is not a signed reviewer receipt.

## Exact test editions, proposed existing WHITE-PAPER-V3 truths

| Test target | SHA-256 content digest | Git blob ID | Proposed truth obligation |
| --- | --- | --- | --- |
| `tests/issue-3302-lane-a-admission-receipt.test.mjs` | `PENDING-INDEPENDENT-RECOMPUTATION` | `8f45b63742bf7c9587f690317e9e2ba1b4c5bf85` | WHITE-PAPER-V3 W8 + W9 |
| `tests/issue-3302-lane-a-reviewer-enrollment.test.mjs` | `PENDING-INDEPENDENT-RECOMPUTATION` | `140e202b0700c937f6f7fa5c76e51c18abf99a8a` | WHITE-PAPER-V3 W8 + W9 |
| `tests/issue-3302-lane-a-service-identity-policy.test.mjs` | `111cb146ddf8713601402f604733e86e182f4615b74705f127d413d4e8939ebf` | `54ef181f259660027cf51fe368eec43abb0cd430` | WHITE-PAPER-V3 W8 + W9 |

**Approved normative source** `docs/white-papers/AI_Programming_Evolution_White_Paper.md`: SHA-256 `7fd538b813014cf94505903a32e171fca344068d67d15036fbe0fdcb7859c27d`, independently matched by author to `config/verification/test-catalog.json`'s already approved WHITE-PAPER-V3 3.0 sourceDigest. W8 = independent verification as acceptance; W9 = preserve source obligations, prevent repeated repair and unexpected changes. Author-computed match is not a reviewer-issued ADMIT.

## Direct and transitive implementation inputs

| Input | Exact SHA-256 | Git blob |
| --- | --- | --- |
| `scripts/engineering-team/verification/lane-a-admission-receipt.mjs` | `PENDING-INDEPENDENT-RECOMPUTATION` | `6062c823dace5583789f1ec73c39956c8c570815` |
| `scripts/engineering-team/verification/lane-a-reviewer-enrollment.mjs` | `PENDING-INDEPENDENT-RECOMPUTATION` | `5bf2ac5399545c25f0164ad2115fc97b0af2b77b` |
| `scripts/engineering-team/verification/lane-a-admission-chain.mjs` | `de5369c7f881afc83a6695a1b82ccd4d266969f87f76aea9b311708afcd6f173` | `0572e93e888306397235fbc348105b9be73a6fb5` |
| `scripts/engineering-team/verification/lane-a-service-identity-policy.mjs` | `260f982e24ba6e8b87f90974554ea95d1cab35094be5b24c1cd754d69a612dbd` | `ad5db88e457d6b82e6bf38868f4376b9bd7aa764` |
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
- The owner Windows Supervisor currently reports **OFFLINE / NO_FRESH_OWNED_HEARTBEAT** on the authenticated Factory observer. The coding worker and independent reviewer service are **not** proven. A passing old allowlisted Windows test is not proof of #3322.

## Adversarial checks required of independent F00 reviewer

Verify actual exact-head unit tests (not author-supplied results), recompute test/input SHA-256 from trusted GitHub editions, inspect all denied privileges and STOP/replay negatives, explicitly reject author/registrar/reviewer identity collapse, challenge ledger replay, forged local observation, mutable trust registry, and discrepancy between claimed signer identity and real Windows process-token SID. Demand evidence of non-exportability/ACL isolation or mark `UNPROVEN`. Review service-host SCM correctness (Session 0, signed native service, no raw script-as-service) and avoid claiming installer proof from declarative policy alone.

**Allowed independent verdicts:** `ADMIT`, `FIX`, `REJECT`, or `UNPROVEN`, signed by an independently qualified nonauthor with its own protected key and cited exact evidence. If admission is not independently attributable, verdict is UNPROVEN and all production controls remain disabled. A valid independent ADMIT may allow a **different** authorised catalogue maintainer to propose source-exact bindings, never a reviewer self-merge.

## 2026-10-27 author-side unsigned-extension hardening

The enrollment verifier now rejects any unrecognized top-level field, including attempted unsigned `mayMerge` or `canEditCatalogue` privilege assertions, before checking enrollment signatures. A focused negative regression was added. The SHA-256 and Git blob entries above were refreshed for the two changed files. This is an author-prepared source edition update, NOT independent admission, NOT a trusted reviewer receipt, and NOT evidence of native Node/Windows test execution. Recompute all editions and obtain separately signed W8/W9 review before protected catalogue binding or release.

## Author-side effective-token privilege isolation amendment (NOT ADMITTED)

PR #3322 now requires explicit observed effective-token and service-control facts before the fixed reviewer identity can even be a nonoperational candidate: a completed privilege observation, no elevated reviewer token, no enabled Administrators group, no unexpected token privileges, no coding-worker control of the reviewer SCM service, and no reviewer control of the manager SCM service. A process owner SID alone cannot prove least privilege. Missing, false-format, or adverse facts produce `WINDOWS_TOKEN_PRIVILEGE_ISOLATION_UNPROVEN`, not a candidate. The candidate response still grants no execution, ADMIT, catalogue editing, coding, or merge. The existing read-only Windows inspector does not yet collect these extra effective-token/SCM permissions; real Windows privilege and ACL witnessing remains required and is **not** being inferred from a synthetic fixture.

The service-policy test edition above includes negative checks for elevated/admin tokens, unexpected privileges, missing observations and cross-service SCM control. The above SHA-256 editions and Git blob IDs are the new candidate inputs. No independent signed W8/W9 review, catalogue admission, actual owner-Windows token observation or native service enrollment has occurred from this author-side change. If any further source/test bytes change, the hashes must be recomputed again before review.

## 2026-10-27 signed-evidence validation hardening (AUTHOR ONLY)

The receipt verifier now rejects blank, non-string and oversized findings/evidence entries, impossible UTC calendar dates (including normalized February 30), and absent/malformed expected edition maps without throwing. Two negative regression cases were added to the existing unadmitted test source. Author-computed SHA-256 and Git blob IDs above were refreshed for these two files. This does not admit the new edition, grant reviewer credentials or demonstrate native Windows acceptance. An independent reviewer must recompute the exact bytes and sign W8/W9 before protected catalogue updates. No claim of test execution or CI PASS is made here.

## 2026-10-28 signed receipt time-window safety (AUTHOR ONLY)

The receipt verifier previously accepted an otherwise correctly signed ADMIT indefinitely when the exact head and digests remained unchanged. The author now requires `observedAtMs` from the independent caller: a missing, non-safe, or unrepresentable observation clock fails with `TRUSTED_CLOCK_UNAVAILABLE`. A signed timestamp older than 24 hours or more than 60 seconds in the future relative to that supplied observation fails with `RECEIPT_OUTSIDE_TIME_WINDOW`. The verifier does not create an independent clock, prove Windows time integrity, consume replay IDs, activate Lane A, or confer catalogue/merge authority. Production trust still requires a separate reviewer and registrar, external one-use ledger, and protected source-exact test admission.

Author commits: `804d064808b7cb61aa37d6e94930cc5b5f88763f` (receipt verifier), `c101bccf7f6bd2e45850703683423f755cf87fe3` (receipt negative regression), `f88d9f4885fff154a56f9bfc4de98c0971a795d2` (deterministic clock in enrollment chain fixture). A separate local Node v22.16.0 `node --test` run executed **8/8 PASS, 0 FAIL** focused Ed25519 positive/negative cases against the exact source bytes of `lane-a-admission-receipt.mjs` (SHA-256 `2e3f2e21ed5a60e5978ee85ab74ccda814fa62eda9eb6c3f2cc83066f2852f7a` matched GitHub). This is **not** execution of the complete changed repository test files, exact-head CI, independent W8/W9 admission or owner Windows acceptance. The test and source SHA-256 / Git blob IDs in the tables above were recomputed from exact GitHub content using an author-side SHA-256 implementation checked against the standard `abc` vector and the previously recorded source digest. Independent reviewer must recompute independently.

All three changed test/source editions remain **UNADMITTED**. Do not merge this draft, bypass test-truth governance, install reviewer credentials, or start Lane B based on this packet.

## 2026-10-28 enrollment timestamp and clock regression (AUTHOR ONLY)

The reviewer enrollment verifier previously used permissive `Date.parse` for signed issued/expires timestamps, allowing normalized impossible calendar dates, and silently defaulted the verification clock to the local process time when no caller observation was supplied. The current source proposal rejects noncanonical UTC timestamps and impossible calendar dates, requires an explicit representable safe-integer observation clock, and keeps the enrollment result inert. The new negative regression cases cover normalized February 30, timezone-offset text, missing/NaN clocks, and out-of-range clocks.

Source commit `7640fba4273b1ce28f91195e2dee736d15d5e733`; test proposal commit `6b536b5b94883cf8eaf287aa2529ee3c7ab775a0`. Current Git blob IDs are recorded in the table above. The two prior SHA-256 entries were explicitly invalidated and marked PENDING-INDEPENDENT-RECOMPUTATION; no digest, W8/W9 approval, test execution, or independent Windows receipt is asserted. The exact branch head and all transitive inputs must be re-fetched before any independent review. This candidate is NOT ADMITTED and must not merge.

## 2026-10-28 independent truth-scope completeness repair (AUTHOR ONLY; UNADMITTED)

A signed `ADMIT` previously passed when its `truthRefs` named only W8, even though the candidate's required obligations are W8 AND W9. The verifier now requires an externally supplied nonempty `requiredTruthRefs` list for ADMIT, validates its entries against the allowed normative scope, rejects duplicate truth references, and rejects any ADMIT omitting a required obligation. FIX/REJECT/UNPROVEN remain nonpromoting evidence and may cite a narrower allowed scope. This prevents a partial signed review from masquerading as a complete W8/W9 admission. The separate reviewer, registrar, catalogue maintainer, actual Windows identity and signature checks are still required.

Source commit `6544a549d2bbf6eed055c851f17e1720ea5a25ad`; proposed test-edition commit `b6c5475c7e999f09298b8398305589e00e8ea6ff`. The new regression proposal covers omitted W9, missing/untrusted required obligations, duplicate references and nonpromoting FIX. The two superseded SHA-256 entries in the tables above are deliberately invalidated; the new Git blob IDs are recorded but independent SHA-256 recomputation and signed W8/W9 admission are PENDING. Do not execute the revised unadmitted test edition as an approved test, alter protected truth bindings, or merge this draft based on this author change. Exact-head CI and owner Windows Product Gate remain required.

The pre-existing signed enrollment-chain positive fixture also required an update: its synthetic ADMIT previously named only W8 and omitted the now-required independent W9 scope. The fixture now signs both W8/W9 and supplies the independent required set. Proposed test-only commit `ee14dd8f4dd063cbbe49566284e73e3256ce6a2d`; replacement test blob `140e202b0700c937f6f7fa5c76e51c18abf99a8a`. This revised test edition is UNADMITTED, its SHA-256 remains pending independent recomputation, and no execution or approval is claimed.

## 2026-10-28 independent evidence non-reuse hardening (AUTHOR ONLY; UNADMITTED)

A signed Lane A enrollment previously accepted identical process-token and private-key ACL SHA-256 digests, or duplicate `evidenceRefs`, as if two independent Windows observations had been supplied. The verifier now rejects equal attestation digests (`ATTESTATION_EVIDENCE_NOT_DISTINCT`) and duplicate evidence references (`EVIDENCE_REFS_NOT_DISTINCT`) before cryptographic verification. This does not independently validate either observation; the registrar and protected Windows identity/ACL inspection remain mandatory.

Source commit `fc494fe013b651f1e2d6dd11969e6ab5968a50c5` / Git blob `21793efc2667776ec240853ad15675a7610074d1`. Proposed negative test edition commit `6f82c83b52e1b98a8d9fb4dcdd2ea16148054b23` / Git blob `804bb2ab708f3971a524f920c860651316735174`. The prior source blob `5bf2ac5399545c25f0164ad2115fc97b0af2b77b` and test blob `140e202b0700c937f6f7fa5c76e51c18abf99a8a` are superseded. Any earlier SHA-256 editions for these paths in this packet are invalid; independent recomputation from the exact GitHub blobs is PENDING. The negative regression has NOT been executed or admitted. No W8/W9 signature, catalogue update, Windows acceptance or merge authority is claimed.
