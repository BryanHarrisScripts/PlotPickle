# #3302 Independent F00 Lane A — exact-edition W8/W9 admission request

**Prepared:** October 28, 2026. **AUTHOR-SIDE REQUEST ONLY — NOT INDEPENDENT ADMISSION.**
**PR:** [#3322](https://github.com/BryanHarrisScripts/PlotPickle/pull/3322). Author-source checkpoint before this packet update: `990acd674080ce4b15bb6c318b7805b1477b5465`. The independent reviewer must bind its verdict to the **actual final PR head and current file editions** when reviewing, not to a stale author-prepared checkpoint.

## Trust and bootstrap barrier

The proposed F00 reviewer `PP-F00-D02-W0001` / alias `PP-F00-LA-W0001` has **not been independently enrolled or qualified**. The Windows native service host now exists as **source code only** and is intentionally inert. It is not installed, running, independently witnessed, a key holder, or capable of ADMIT. The owner GitHub account is currently the CODEOWNER for all source; do not misrepresent a review performed through the same coding connector identity as an independent signed F00 verdict.

**Bootstrap requires an independently authorized, separately attributable, out-of-band reviewer/registrar** to assess these first tests and exact source inputs. An authorized catalogue maintainer distinct from the test author may change protected truth bindings only after that separate review's verifiable ADMIT. No new software may approve its own verifier's admission. Owner instruction "continue" is **not** a test-specific signed reviewer verdict.

## Approved normative source

`WHITE-PAPER-V3`, version 3.0, `docs/white-papers/AI_Programming_Evolution_White_Paper.md`, exact SHA-256:
`7fd538b813014cf94505903a32e171fca344068d67d15036fbe0fdcb7859c27d` (**matches protected approved normative digest**). Candidate obligations: **W8** independent verification and **W9** preserved normative obligations and evidence. Reviewer must independently confirm the assertion-to-obligation mapping and actual input set.

## Four NEW/REVISED test editions — candidate bindings

| Proposed test target | SHA-256 of UTF-8 contents | Git blob SHA |
| --- | --- | --- |
| `tests/issue-3302-lane-a-admission-receipt.test.mjs` | `9e0f34fa6a7fb323463e256bebbe99896db7e6e7fdadbdf59a9df18e266881a7` | `8f45b63742bf7c9587f690317e9e2ba1b4c5bf85` |
| `tests/issue-3302-lane-a-reviewer-enrollment.test.mjs` | `ae63d4c185b21708483fd6dae00a164735a8d08fcc83c84b9b9c78dc16024ec5` | `804bb2ab708f3971a524f920c860651316735174` |
| `tests/issue-3302-lane-a-service-identity-policy.test.mjs` | `111cb146ddf8713601402f604733e86e182f4615b74705f127d413d4e8939ebf` | `54ef181f259660027cf51fe368eec43abb0cd430` |
| `tests/issue-3302-lane-a-native-service-host.test.mjs` | `ab47213c1e2f054b4e8dc8ed29270d429b95aa48b72072ab7efe1c8d9933a5de` | `a68f9ed1e531623950613a1104339f28c0457d34` |

`tests/issue-3302-lane-a-native-service-host.test.mjs` contains **5 source/static assertions** and **1 opt-in Windows-native build test**. The five were exercised by the author with injected V8 source fixtures. The Windows-only test has **NOT BEEN EXECUTED**. None of those results proves independent review or SCM installation.

## Direct and transitive implementation input editions

| Required source or read-only inspector | SHA-256 of UTF-8 contents | Git blob SHA |
| --- | --- | --- |
| `scripts/engineering-team/verification/lane-a-admission-receipt.mjs` | `ec83e941074d38134657f317efffcfe9d0eb7831e1567e33320cd0a9da9a6b60` | `6062c823dace5583789f1ec73c39956c8c570815` |
| `scripts/engineering-team/verification/lane-a-reviewer-enrollment.mjs` | `5b2bf3418d374326cf828d58bc3c1631fca4e154273e0aa5ac55341c2711937d` | `21793efc2667776ec240853ad15675a7610074d1` |
| `scripts/engineering-team/verification/lane-a-admission-chain.mjs` | `de5369c7f881afc83a6695a1b82ccd4d266969f87f76aea9b311708afcd6f173` | `0572e93e888306397235fbc348105b9be73a6fb5` |
| `scripts/engineering-team/verification/lane-a-service-identity-policy.mjs` | `260f982e24ba6e8b87f90974554ea95d1cab35094be5b24c1cd754d69a612dbd` | `ad5db88e457d6b82e6bf38868f4376b9bd7aa764` |
| `scripts/engineering-team/windows/verification/Inspect-PlotPickleLaneAService.ps1` | `ea73e47509dee34eefec7fcd8dee81f4a4b5627f960289492561db4d7763b352` | `9972479edbc6346360cff42e4076bb206272b7fb` |
| `scripts/engineering-team/windows/verification/Inspect-PlotPickleLaneAIdentity.ps1` | `c1f73f1fa6b1bb1495a63b4aeca0027aea25c290addd75b839af1ec8c4f430be` | `fd704743a5a020320108d572434b02ddd35528cd` |
| `scripts/engineering-team/windows/verification/PlotPickleLaneAService.cs` | `e7ca01301248cabcfc75d7cada4826587efec5b0b53aa824886d8303028044c5` | `92a488a759db8c9d931ce2c157513736a2ddaafb` |
| `scripts/engineering-team/windows/verification/Build-PlotPickleLaneAService.ps1` | `3a2ff59a9774b0f2376bf614ac2ce73032f0517b720774e4de162fea77100e29` | `c2666545a40763a3f41d5c8127e43fb63937bead` |
| `scripts/engineering-team/windows/verification/Install-PlotPickleLaneAService.ps1` | `be98e813d583af0d045b891a53fd780aec30f5a165cffa97a8e5942d567c078e` | `0fd189ff2e3dcaa2ae692dd71299bd35c952eddd` |
| `scripts/engineering-team/windows/verification/Test-PlotPickleLaneAHost.ps1` | `a1f5181fd715dcfc3da6aac526b60df7af47862bd485440677160cba1b106a1c` | `20ec28dce4d87133939611d91a0ce7643be35dad` |

The separate maintainer must bind each target to its exact file digest, the actual imported files and static-read inputs, approved `WHITE-PAPER-V3` W8/W9 references, suitable existing test catalogue suites and honest `unit-fixture`/`static-source` scope. **Do not self-edit `config/verification/test-catalog.json` in this PR.**

## Native Windows implementation and acceptance boundary

* `PlotPickleLaneAService.cs` is a `.NET Framework 4.8` **native SCM ServiceBase** diagnostic process. At SCM OnStart it requires noninteractive execution and the actual `NT SERVICE\\PlotPickleLaneA` token, and exposes no network listener, key access, process spawning, authoring or signed-review operation. SCM RUNNING would mean diagnostics host only.
* `Build-PlotPickleLaneAService.ps1` defaults to **PLAN_ONLY** and compiles an unsigned diagnostic EXE only with explicit `-Build`; its `--self-test` does not prove the actual service token or qualification.
* `Install-PlotPickleLaneAService.ps1` is an **internal future one-installer component**; default is PLAN_ONLY. `-Apply` requires Windows elevation, fixed install path, a matching reviewed SHA-256, a Valid Authenticode signature from a separately pinned publisher thumbprint, non-reparse/non-broad-writable install folders, dedicated virtual service account, and `sc.exe sidtype restricted`. It creates an **inert demand-start** service and never auto-starts it, creates a private signing key or authorizes reviews. **No independently approved signed release artifact/trusted publisher exists yet; do not execute -Apply.**
* `Test-PlotPickleLaneAHost.ps1` returns a bounded, fail-closed Windows diagnostic receipt. With explicit `-RunNativeCompile` it builds and smoke-tests the inert diagnostic host in a temporary folder, then deletes it. The report still sets token attestation, signer key, registrar, W8/W9 admission, CI and Product Gate to **UNPROVEN**.
* The authenticated Factory tunnel **does not provide arbitrary compilation/SCM installation or secure-key creation**. Its read-only candidate check at owner host source `8a6bec0b1137adf6d515f8314d158df155357b9d` returned `BLOCKED/CANDIDATE_BASE_MISMATCH`; no PR code was staged or executed on Windows. The supervisor has no fresh owned heartbeat as last observed. **No native Windows execution of this PR is claimed.**

## Review conditions

A separate qualified reviewer must recompute all digests from trusted source, inspect C# / PowerShell security and startup contracts, prove developer-supplied fixture assertions do not masquerade as accepted truth, check Ed25519 reviewer/registrar isolation, STOP/restart no-replay, Windows virtual-account and restricted SID, signed code / ACL, signer key custody, and identify any FIX/REJECT outcome. Real Windows acceptance must show actual build, service SID, process token, STOP and unrelated-process noninterference; source static tests cannot substitute.

Admissible reviewer verdicts are **ADMIT, FIX, REJECT, UNPROVEN**, signed with the *reviewer's* separately protected key and tied to the final source head. A verified ADMIT is evidence for a **different** authorized catalogue maintainer; it carries `mayUpdateCatalogue:false` and cannot itself merge or run Lane B.

**STOP state:** reviewer not provisioned, signer absent, test editions unadmitted, native service not installed, release gates blocked. No credential or private key belongs in a PR/comment/ChatGPT log. Keep draft and do not merge.
