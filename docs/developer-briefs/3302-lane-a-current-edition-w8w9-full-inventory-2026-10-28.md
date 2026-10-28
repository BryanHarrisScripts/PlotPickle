# #3302 Lane A W8/W9 — current candidate source inventory
Date: October 28, 2026. This is an **AUTHOR-PREPARED REVIEW INTAKE**, not test approval, a signed F00 verdict or Windows Product Gate.

## Exact source checkpoint and independently required decisions

The following source and normative editions were read from GitHub on existing draft PR #3322 at commit `eac2119554174ca442307faa4dd8191633d38b24`. All SHA-256 values were computed from the retrieved UTF-8 file content with an implementation checked against published SHA-256 known vectors; all 40-hex blob IDs were independently returned by the GitHub file API. **Neither operation establishes an independent reviewer**. The commit containing this inventory itself is later; a reviewer must re-read the actual final PR head and confirm all listed file editions before admission.

This inventory enumerates **all eight changed `issue-3302-lane-a-*.test.mjs` tests**, all eight changed direct/transitive Lane A verification modules, and ten changed Windows-source/diagnostic inputs. The normative WHITE-PAPER-V3 is supplied separately and unchanged. Documentary developer briefs are not executable test inputs and are not reproduced here. The independent reviewer must also inspect any test-specific static file reads, module graph edges, normative obligations, CI workflow policy and *all* imported inputs before issuing a verdict; this inventory is a starting evidence set, **not a claim of validated dependency closure**.

## All eight test editions — proposed / not independently admitted

| Exact test path | SHA-256 | Git blob |
| --- | --- | --- |
| `tests/issue-3302-lane-a-admission-receipt.test.mjs` | `9e0f34fa6a7fb323463e256bebbe99896db7e6e7fdadbdf59a9df18e266881a7` | `8f45b63742bf7c9587f690317e9e2ba1b4c5bf85` |
| `tests/issue-3302-lane-a-automated-reviewer-cli.test.mjs` | `0b47851852f6c63875712da2baae1e4e3fa08443ef6b1450135abdbe250fb715` | `0d36f85f2c3ac63119fac243059ce0be4c8fa915` |
| `tests/issue-3302-lane-a-automated-reviewer.test.mjs` | `1f14832e1a6d507fa97becee807f1531cb32559a6b48715255076bc1666c1408` | `c1d7827a4725a030b8983f282954dd292b5e9556` |
| `tests/issue-3302-lane-a-external-trust-bootstrap.test.mjs` | `e699445cc2161364f19132ed17c1f9d83c230cd915126230bb470336c086af79` | `fd695200eaf64d5aadba87e711effb09dfcad209` |
| `tests/issue-3302-lane-a-native-service-host.test.mjs` | `0f305a0097e13618c779cc2c666b1193cd07c51c3ad0a7f43a8f7848844d5498` | `00515c2932993d9f47841698bedd09af3b0b4381` |
| `tests/issue-3302-lane-a-reviewer-enrollment.test.mjs` | `ae63d4c185b21708483fd6dae00a164735a8d08fcc83c84b9b9c78dc16024ec5` | `804bb2ab708f3971a524f920c860651316735174` |
| `tests/issue-3302-lane-a-service-identity-policy.test.mjs` | `111cb146ddf8713601402f604733e86e182f4615b74705f127d413d4e8939ebf` | `54ef181f259660027cf51fe368eec43abb0cd430` |
| `tests/issue-3302-lane-a-signed-registrar-policy.test.mjs` | `378e8a6fdc999f22e3ab10de9c50646dbfc03eb65f0ca032b1dfd97b4d90c6ea` | `7e019b41c62440424c0efd41426d46d82f9b9540` |

## Changed verification implementation sources

All paths below begin with `scripts/engineering-team/verification/`.

| File | SHA-256 | Git blob |
| --- | --- | --- |
| `lane-a-admission-chain.mjs` | `de5369c7f881afc83a6695a1b82ccd4d266969f87f76aea9b311708afcd6f173` | `0572e93e888306397235fbc348105b9be73a6fb5` |
| `lane-a-admission-receipt.mjs` | `ec83e941074d38134657f317efffcfe9d0eb7831e1567e33320cd0a9da9a6b60` | `6062c823dace5583789f1ec73c39956c8c570815` |
| `lane-a-automated-reviewer-cli.mjs` | `5e0490322aa95f419ea021f016f2e5ce6e18e154e385afc7e05f595fce179370` | `ff0680969cad095f09d4fab4b4bc8751e3cc0efd` |
| `lane-a-automated-reviewer.mjs` | `a366bca6679f1f15de356d1c36aaa69463c9b899eba4002358a59f27bd152a02` | `9f5e0ecb7eaa8f78cc7b0b97e8731e3f2a402793` |
| `lane-a-external-trust-bootstrap.mjs` | `c6e837fbeb75ce001cb5b90eb1018dbe16e7b281e49dac5d7bcd949381662f7e` | `7d97746df4b1a0f6ec8dee23c9a3a733e59eea60` |
| `lane-a-reviewer-enrollment.mjs` | `5b2bf3418d374326cf828d58bc3c1631fca4e154273e0aa5ac55341c2711937d` | `21793efc2667776ec240853ad15675a7610074d1` |
| `lane-a-service-identity-policy.mjs` | `260f982e24ba6e8b87f90974554ea95d1cab35094be5b24c1cd754d69a612dbd` | `ad5db88e457d6b82e6bf38868f4376b9bd7aa764` |
| `lane-a-signed-registrar-policy.mjs` | `52f018057735b9250199006745cb173fedbda2d1ebe1870562f4fc4563f25495` | `21b8c27b56eb8bead7100b309fde897922870492` |

## Windows native host and related diagnostic input editions

All paths except the workflow below begin with `scripts/engineering-team/windows/verification/`.

| File | SHA-256 | Git blob |
| --- | --- | --- |
| `Build-PlotPickleLaneAService.ps1` | `3a2ff59a9774b0f2376bf614ac2ce73032f0517b720774e4de162fea77100e29` | `c2666545a40763a3f41d5c8127e43fb63937bead` |
| `Inspect-PlotPickleLaneAIdentity.ps1` | `c1f73f1fa6b1bb1495a63b4aeca0027aea25c290addd75b839af1ec8c4f430be` | `fd704743a5a020320108d572434b02ddd35528cd` |
| `Inspect-PlotPickleLaneAOwnerAcceptance.ps1` | `c4b83fa5ea9c8b9d13e58ad985240205f0916ffbbbec76763b2be13b4b320b8f` | `bf70c7cf846ad6d625a920a819a55ddb156046a6` |
| `Inspect-PlotPickleLaneAService.ps1` | `49d085966c86f517c032e2a9da3ccfd6856f1d091fdbc6302f7e150419ec6a53` | `1cff4fd3ec05f0a1f1280799fa172bccf06dff5c` |
| `Inspect-PlotPickleLaneATrustRoot.ps1` | `59ba24baeed30587a227c4d504c9b4a900087e32bf0a5426e8ed356c2d118be2` | `a260bfed363ff7783b7fa9112915392aefcaae24` |
| `Install-PlotPickleLaneAService.ps1` | `be98e813d583af0d045b891a53fd780aec30f5a165cffa97a8e5942d567c078e` | `0fd189ff2e3dcaa2ae692dd71299bd35c952eddd` |
| `PlotPickleLaneAService.cs` | `e7ca01301248cabcfc75d7cada4826587efec5b0b53aa824886d8303028044c5` | `92a488a759db8c9d931ce2c157513736a2ddaafb` |
| `Test-PlotPickleLaneAHost.ps1` | `87ae1c07b4a896d791816ab37af0856bac930e4069170748626b77b6f5e6ff4f` | `c972337c87d5c0d41c46f33fb755d5411015f35d` |
| `Test-PlotPickleLaneAScmCanary.CI.ps1` | `ff3fc1254968f503c061f949cf9b4d620c0eb22c0265c17aa55ca4d7b1cb7896` | `71743948a3e8a4c9f57956f4525af10b344904d3` |
| `.github/workflows/issue-3302-lane-a-native-diagnostic.yml` | `9894a8799c341b41f4bbeb257a6f78391c012098b031c57ba9f313773a3a96f0` | `af82935bd223b1a81a30b923d68a40274951f7cd` |

## Externally approved normative source (not author-editable)

`docs/white-papers/AI_Programming_Evolution_White_Paper.md`: SHA-256 `7fd538b813014cf94505903a32e171fca344068d67d15036fbe0fdcb7859c27d`; Git blob `1d3d49300d04f9784d94568d9cb36348eb290ba3`. The reviewer must independently confirm that this *approved* unchanged normative source defines the applicable W8/W9 obligations and that every proposed test assertion maps to them. Matching a hash is not approval of assertion adequacy.

## Separate required trust/Windows/CI gates

1. Independent authorized F00 reviewer/registrar (not the source author or GitHub coding identity), independently pinned Ed25519 trust root, protected signing credential and one-use challenge ledger. No root or reviewer may approve its own bootstrap.
2. Recompute all actual final-head hashes and the complete transitive dependency set; inspect test assertions for forbidden self-admission, fabricated evidence and code/STOP/resource ownership races; sign source-bound ADMIT/FIX/REJECT/UNPROVEN.
3. Only a **distinct authorized protected-catalogue maintainer** may bind editions after verifying a real signed ADMIT. Do not change `config/verification/test-catalog.json` from the author-side PR without this process.
4. Rerun the unchanged exact-head seven-layer Architecture Verification, all applicable native Windows checks and real owner-Windows Product Gate; do not count author-authored CI fixtures as F00 review.
5. Only after those gates and an authorized real coding/publishing worker succeed may issue #3142 attempt a first, then an automatically initiated second, independently verified engineering cycle. Keep #3322 DRAFT, no self-merge or STOP override.

**Observed release state at source checkpoint:** Architecture Verification #40698552779 FAILED protected W8/W9 test admission; native Windows diagnostic #40698552770 PASSED but was NON-RELEASE, with owner acceptance SKIPPED. No approved F00 credential, signed verdict, catalogue change, Product Gate or genuine autonomous cycle. Stop here, retaining all evidence, until independent trust is established.


## October 28 Windows tracked-source correction — supersedes two editions above

This is an AUTHOR-SIDE source-edition change, **not** a signed F00 ADMIT. The reviewer must use these NEW editions instead of the old entries above, recompute them independently at the final reviewed PR head and inspect W8/W9 semantics. The owner-Windows acceptance inspector previously used `git status --porcelain`, which reports intentionally untracked local operator startup scripts as dirty. It now uses `git status --porcelain --untracked-files=no`, matching the existing approved independent Supervisor's tracked-clean-MAIN rule. This does not allow modified tracked code, STOP overrides, reviewer self-signing, or any installation.

| Changed item | New UTF-8 SHA-256 (author-side, vector-tested) | New Git blob |
| --- | --- | --- |
| `scripts/engineering-team/windows/verification/Inspect-PlotPickleLaneAOwnerAcceptance.ps1` | `9672be7692cc103613efbffeae1b8a48bbc65097db3981e3912fecb219d2244b` | `c2bb65b949111bf585b58836eb98cce84d10d2fc` |
| `tests/issue-3302-lane-a-native-service-host.test.mjs` | `2bb30b4100f4c28da6e427bf30f7207e08b7c24c6798849f99ecfc9a12b3c8dc` | `c1e57fe7a063e66e4eecb8bc8e5f4f913877712f` |

The proposed regression asserts that the read-only owner acceptance command has tracked-only Git status. It has **not** been executed under a qualified F00 identity or admitted to protected truth. Exact source check before this documentation commit: `0275fe028d292a52e5fa3107900e8dbfb9970675`. CI for this source head: Architecture Verification #40712662099 **FAILED** all seven layers because all eight changed W8/W9 tests remain unadmitted; hosted NON-RELEASE native diagnostic #40712661805 **PASSED**. No owner-Windows Product Gate, signed reviewer, distinct registrar or protected-catalogue maintainer observed. Both results are intentionally non-promotable to ADMIT.


## October 28 owner-approved commissioning: trust-record revocation hardening (AUTHOR-SIDE ONLY)

Owner approval to continue engineering **does not designate a separate independent publisher, registrar or F00 reviewer** and does **not** satisfy signed W8/W9 admission. The current coding principal cannot self-issue the initial protected trust root, registrar enrollment, reviewer qualification or catalogue-maintainer authority.

Two separate F00 cryptographic verification paths formerly accepted a purportedly trusted key if its `revoked` field was absent, null, or a falsy malformed value. Now **only an explicit boolean `revoked: false`** is allowed: in `verifyReviewerEnrollment` for the externally trusted registrar, and in `verifyAdmissionReceipt` for the enrolled reviewer key. This also rejects literal `'false'` strings and integer zero, and preserves rejection of `true`. Positive cryptographic *test fixtures* were updated with explicit `revoked:false`. Proposed negative tests cover `undefined`, `null`, `'false'`, `0`, and `true`. The production source retains all existing external trust and no-self-review checks; it does not create keys or certify its own truth.

**Updated editions observed at PR source/test HEAD `ad5726f703eeadfce5610bf882f1fe4fd15a10c0`** (author-side SHA-256 implementation checked against standard SHA-256 vectors; independent F00 must independently recompute final HEAD and full import/static-read closure):

| Changed file | UTF-8 SHA-256 | Git blob SHA |
| --- | --- | --- |
| `scripts/engineering-team/verification/lane-a-reviewer-enrollment.mjs` | `9396000f92c1e063143ca35342a9a71406ec9c3f21a39dd5746ec1b2c0a7305b` | `16bd80a42bad7bd80ccea0d2de20d7a2a86af6c4` |
| `scripts/engineering-team/verification/lane-a-admission-receipt.mjs` | `2a40c0f7b27e396da91a1f5b734c50091c76ea53ed405caa8e9846b7f5e522fc` | `e1a4a29bcb9b0e9c693e5d6ed3e825e4d31cc094` |
| `tests/issue-3302-lane-a-reviewer-enrollment.test.mjs` | `6aae2c1a6996e270526a6cead59ea0db1991b2bab5e6ac52a92fd61e87c6c6ab` | `ccbcb2534724039460dee99d7109188597ec8b59` |
| `tests/issue-3302-lane-a-admission-receipt.test.mjs` | `eda0c193605a4b4976dad71306ce93c567ba57faa5d469cc19a4474a0ac4ee8f` | `c9d5c144f7635b4e711d47e14d73429a27130d68` |

**Independent review intake, not a claim of signing:** Review all eight actual current Lane A test edits and the full source/input graph against unchanged WHITE-PAPER-V3 W8+W9. The separate registrar must obtain an out-of-band approved public root fingerprint, demonstrate distinct Windows coder/reviewer tokens and key ACLs, atomically consume the nonce and issue a source-bound signed enrollment. A qualified independent reviewer must issue a signed ADMIT, FIX, REJECT, or UNPROVEN disposition for the exact current digest set. A distinct protected-catalogue maintainer may bind only a legitimate signed ADMIT and must preserve current MAIN approved bindings. Do **not** infer an ADMIT from passing hosted diagnostics, test-fixture Ed25519 keys or a GitHub comment. No private keys or authentication secrets belong in this repository or issue.


## October 28 — registrar nonce-ledger proposal integrated into EXISTING eight-test intake

The initial ninth-test proposal was deliberately withdrawn (test file deleted), preserving the independently announced eight-governed-test inventory and the immutable intake tool's strict no-unlisted-tests check. Existing governance remains in force; source changes still require separately admitted normative W8/W9 evidence.

| Current changed edition | UTF-8 SHA-256 | Git blob |
| --- | --- | --- |
| scripts/engineering-team/verification/lane-a-nonce-ledger.mjs | a9b6a57d1bb09382550c1e97ea99a751f472094e0ad55c0d61aab1ff8406f7fe | c80ca99f82a5d0a6c3b5ff7f76080b7d48b86543 |
| tests/issue-3302-lane-a-signed-registrar-policy.test.mjs (existing governed test, updated) | f7eac3fabb5dd6938fb3663f6d6cd3548573fa8308227110cb4d889f3ac06b4c | f3abfb25d3ed1807c7a60a7f97f6e5d31aab68b1 |

Source is committed on draft #3322. SHA-256 is author-computed and self-checked against standard digest vectors; a distinct F00 reviewer must independently re-fetch/rehash on the final PR head, including the new input dependency in the existing registrar test, before any ADMIT.

**Author-side synthetic evidence:** Six focused local Linux Node 22 tests of the exact registrar-source blob and an earlier isolated proposed test blob passed, covering single spend, 16 concurrent attempts, wrong scope, missing root, corrupt spent marker and symlink directory denial. The existing signed-registrar governed test has since been extended with FIVE corresponding nonce cases; the combined governed edition is PROPOSED, has not received independent W8/W9 admission or native Windows Product Gate. The newly added registrar module uses atomic wx file creation, file fsync and parent-directory fsync. If Windows directory fsync is unsupported, it retains created markers and FAILS CLOSED rather than promising durable consumption. Independent Windows crash recovery, separate-process claims, Windows ancestor ACL/symlink protection, protected root custody and inability of coding identity to delete spent markers remain UNPROVEN.

**Authority status:** nonceConsumedForProduction=false, independentAuthorityVerified=false, mayAdmit=false, mayEnroll=false, mayEditCatalogue=false, mayCode=false, mayMerge=false. This code does not sign enrollment or build a trusted root. Do not issue production reviewer credentials or update the protected truth catalogue from the coding session. The source review packet includes EXACTLY EIGHT changed governed Lane A test targets; the old hash for signed-registrar-policy.test.mjs above is superseded by the updated edition in this section.
