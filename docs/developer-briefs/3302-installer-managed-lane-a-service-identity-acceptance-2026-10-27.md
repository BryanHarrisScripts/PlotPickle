# #3302 / #3268 — Installer-managed Lane A reviewer service acceptance
## Owner-approved architecture, 27 October 2026

**State:** security policy and read-only Windows inspection implemented on DRAFT PR #3322. **No actual SCM service, reviewer token, trusted private key, registrar or W8/W9 ADMIT deployed.** Do not call an observed service account proof of independent review.

### One installer, two security boundaries, no additional user mode

- The user sees **one Always-on PlotPickle installation option**. The installer owns the top-level PlotPickle Service Manager registration with necessary Windows elevation/consent, and an internally isolated **Lane A reviewer service**. There is no separate user-facing installer mode, second MCP tunnel or second coding Supervisor.
- The background manager runs only bounded lifecycle coordination and observation. It cannot access, generate, export, sign with or replace the F00 independent reviewer private key, trust-store root, challenge ledger or catalogue approval.
- Pin the review-only service name `PlotPickleLaneA`; candidate noninteractive Windows service account `NT SERVICE\PlotPickleLaneA`, actor ID `PP-F00-D02-W0001`, alias `PP-F00-LA-W0001`. The profile in `scripts/engineering-team/verification/lane-a-service-identity-policy.mjs` is a **static contract, not an installer**.
- Installer may choose a supported restricted service identity mechanism under the hood, but any change from the pinned profile must be independently reviewed and versioned before evidence can be accepted. A normal interactive user account is not required.
- **Review work starts disabled**, even when installed. The installer may start a strictly inert, non-signing diagnostics host under the reviewer service token solely to permit independent Windows SID/ACL observation; it must not read a real signing key, claim jobs, submit reviews or call models. A diagnostic host showing SCM RUNNING remains `REVIEWER_NOT_ADMITTED`. Only independently verified token/SID separation, protected key/ACL, registrar/qualification, one-use nonce and owner STOP checks can support a later activation proposal. Installed is not ADMIT and does not confer F00 principal trust.
- Do not register a raw `node.exe`, `powershell.exe` or a script file as the SCM service executable without a genuine Windows Service host implementing SCM control/state transitions. Windows error 1053 is not an acceptable workaround. Separate service host and user-session companion are required for Session 0 safety.

### Fixed reviewer capabilities

May read exact immutable source editions and ratified WHITE-PAPER-V3 W8/W9 truth, inspect tests, and write a **signed review receipt** only after external qualification.

May **not** edit source, tests, protected `config/verification/test-catalog.json`, invoke a paid coder, clear persistent STOP, claim Lane B, start an engineering worker, create branches, publish PRs or merge. Any extra permission detected fails closed.

The receipt verifier is now **permission-neutral**: an authentic ADMIT signature may be admissible evidence for a **different** authorized catalogue maintainer, but cannot directly grant the signer `mayUpdateCatalogue`. Independent Windows Product Gate and exact-head CI remain distinct.

### First implementation slice (no native installation)

1. `lane-a-service-identity-policy.mjs`: immutable fixed service profile and defensive candidate-only validation of installer, identity, known binary edition, external registrar evidence, prohibited scopes and sticky STOP.
2. `Inspect-PlotPickleLaneAService.ps1`: **read-only** SCM and running process-token SID inspection of fixed `PlotPickleLaneA`. Output contains no key material or service executable path, and always says **not independently attested**. Not run on owner Windows so far.
3. `Inspect-PlotPickleLaneAIdentity.ps1`: older restricted file-key ACL/coding token diagnostic. Its local self-reports are not independent registrar proof. Must be adapted for the chosen Windows service-account/key storage mechanism under a separate reviewed PR.
4. Cryptographically signed `PP-LANE-A-ENROLL-V1` and `PP-TEST-ADMISSION-V1` fixtures: prove signature verification logic *only*, not an independent review or proof that installer created accounts.
5. The first actual installer PR will consume the fixed profile and register a native service with signed executable, minimal privileges, tested uninstall/upgrade/reboot and independent token witness. No source controlled by an unverified PR may alter the trust root.

### Effective token and SCM permission witness required for the next slice

The candidate-only service policy now fails closed with `WINDOWS_TOKEN_PRIVILEGE_ISOLATION_UNPROVEN` unless the separately collected observation explicitly reports:

- `privilegeObservationState: COMPLETE` based on actual owner-Windows token inspection, not an author-supplied policy string.
- `reviewerTokenElevated: false` and `reviewerTokenAdministratorsEnabled: false`, based on effective token elevation/group attributes.
- `reviewerTokenUnexpectedPrivileges: []`, based on a reviewed allowlist of the restricted service token's actual enabled privileges.
- `codingCanControlReviewerService: false` and `reviewerCanControlManagerService: false`, based on Windows SCM access checks for the **actual separately operated tokens**.

No existing reviewer SCM service, Windows witness, or token-access broker is installed. `Inspect-PlotPickleLaneAService.ps1` currently proves neither effective token privileges nor SCM access control; its process owner SID observation cannot substitute for these checks. The next bounded native-Windows implementation must collect these facts through a supported, read-only Windows security API with explicit denied/unknown outcomes, separate identity and registrar verification, and a distinct reviewer/admission decision. Do not populate these fields from fixture constants, self-signed observations or service names. Missing inspection must stay BLOCKED; diagnostics must not start a reviewer, modify service ACLs, read signing-key bytes, alter STOP, create an authority or grant catalogue admission.

### Windows native acceptance before production activation

- [ ] Clean-install single mode with owner-approved UAC consent, signed/verified binaries, trusted installation root, rollback on partial install and no conflict with existing Task Scheduler Supervisor/tunnel.
- [ ] SCM shows one fixed reviewer service; its **noninteractive** token is independently observed and distinct from Software Factory coding and manager tokens, including group/privilege review. A Windows service SID can coexist with a more privileged underlying token; proof must validate effective access, not only the service name.
- [ ] Reviewer's protected Ed25519 private key is generated under independently governed reviewer principal and is inaccessible to coding worker/GUI/manager (including inherited ACL/backup/grant paths). Prefer nonexportable OS-backed key only after Windows Ed25519 compatibility has been proven; never place key in repository, GitHub Actions, ChatGPT or an arbitrary environment variable.
- [ ] Registrar lives outside the coding process, separately controls its own trust root and nonce consumption, inspects actual Windows token and ACL, and signs bounded one-time enrollment. Its public key is pinned from authorized admin policy, **not from PR/user-supplied candidate evidence**.
- [ ] Independent reviewer passes W8/W9 training and adversarial qualification under a different evaluator. It can issue a signed **UNPROVEN** fixture against pinned sources without any ability to edit code, catalogue or merge. A signed ADMIT must be independently examined by the catalogue maintainer.
- [ ] Intentional STOP persists over reboot; startup/service recovery never silently starts reviewer, clears STOP or replays an interrupted review. PIDs are not guessed; unrelated sentinel processes survive.
- [ ] The one-tunnel arrangement remains unchanged, externally authorized plugin reconnect is observed separately. No auto-auth claims from port or heartbeat.
- [ ] Native owner-Windows diagnostics verify installer/service/token/key isolation and capture redacted, uniquely attributable receipts, separate from simulated fixture tests and hosted CI.
- [ ] Test editions and normative bindings receive actual independently signed Lane A verdict + authorized catalogue maintenance, exact-source CI passes, and owner Windows acceptance is recorded before a production release.

### Known blockers — do not misrepresent as complete

#3321/#3322/#3325 contain new **unadmitted** test editions and exact-head Architecture Verification presently rejects them at protected test-truth preflight. The existing authenticated tunnel can run previously allowlisted tests on an older Windows MAIN; it cannot provision a service account/key or independently sign an admission. An owner saying “approved” authorizes continuing engineering, **not** impersonation of a separate F00 principal. Preserve the old Windows Supervisor until the replacement lifecycle/STOP is natively accepted. No live service migration is authorized by this document.

### Native Windows evidence ladder — use the existing installer, not a new user choice

**Stage 0 — Source lock:** An independently authorized Windows verifier must have an isolated exact-PR-head checkout approved by the existing Factory ownership/STOP protections. The owner machine is currently on an older clean MAIN and its Supervisor has no fresh owned heartbeat; the authenticated `factory-pr-head` request for this PR returned `CANDIDATE_BASE_MISMATCH`. Do **not** force-sync the live installation or copy an unknown executable into Program Files.

**Stage 1 — Non-admin native compiler smoke test:** From that isolated Windows checkout, after W8/W9 source review admission, run the reviewed command:

```powershell
powershell.exe -NoProfile -NonInteractive -File .\scripts\engineering-team\windows\verification\Test-PlotPickleLaneAHost.ps1 -RunNativeCompile
```

It compiles the .NET Framework `ServiceBase` source using the Windows native `Framework64\v4.0.30319\csc.exe` under a temporary directory, runs the executable's **inert** `--self-test`, removes the temporary binary, and emits bounded JSON. Expected **scope-limited** result is `nativeCompile: INERT_CSC_SELF_TEST_PASS`; the very same JSON must still show `independentTokenWitness: UNPROVEN`, `signingKeyProvisioned: UNPROVEN`, `w8w9TestAdmission: UNPROVEN`, `canAdmit: false`. A compiler pass is **not** a production signer, SCM identity, independently admitted test or Product Gate receipt.

**Stage 2 — Native SCM and token acceptance:** Separately approved, Authenticode-signed package and external trusted publisher/release policy must first exist. The internal `Install-PlotPickleLaneAService.ps1` defaults to a read-only PLAN; its mutating `-Apply` is an **installer-controlled later acceptance step**, not an instruction for an end user or coding agent to run. It may install only an inert, demand-start service under `NT SERVICE\PlotPickleLaneA` with restricted SID; no auto-start or reviewer key. After owner-approved SCM diagnostic start, use the read-only `Inspect-PlotPickleLaneAService.ps1` and independent registrar witness to prove *actual* process token SID, privileges, no unrelated process disruption, persistent STOP and managed owner identity. STOP remains a barrier to startup; no local probe may clear it.

**Stage 3 — Protected signer and external registrar:** The restricted reviewer identity creates/holds an Ed25519 key using an independently accepted Windows-compatible mechanism; no private key is supplied to ChatGPT/GitHub or accessible to F01/Service Manager. Independent registrar (not this coding principal) observes the actual token, verifies ACL and possession, issues a fresh challenge and signs the bounded enrollment. The existing `PP-LANE-A-ENROLL-V1` verifier is only a candidate validator until that real evidence is independently authenticated.

**Stage 4 — Out-of-band W8/W9 bootstrap and CI:** Because the F00 signer itself is **not yet qualified**, the first four #3322 test editions cannot self-admit. A genuinely separate authorised reviewer must examine the exact SHA-256 packet and issue an attributable ADMIT/FIX/REJECT/UNPROVEN; a **different authorised catalogue maintainer** may then bind W8/W9 test truth. Only then rerun unchanged exact-head Architecture Verification and native owner-Windows Product Gate. No CI rerun with failed truth is evidence of readiness; never disable the gate.

**No native Windows stage above was executed by the assistant.** The existing authenticated tunnel has only allowlisted test suites and does not provide arbitrary C# compilation, SCM registration or credential-store operations. The first native test on an actual Windows machine remains pending.
