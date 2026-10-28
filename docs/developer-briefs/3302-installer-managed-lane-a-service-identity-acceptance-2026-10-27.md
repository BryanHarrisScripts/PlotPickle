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
