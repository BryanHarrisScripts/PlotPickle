# #3302 Lane A — Separate reviewer identity enrollment and Windows gate

**2026-10-27. State: CODED CRYPTOGRAPHIC PRECHECK; PRODUCTION IDENTITY NOT YET PROVISIONED.**

## Reuse existing authority rather than create a second verifier

The approved #2937 verifier-admission contract already requires an independently operated Ed25519 private key outside PlotPickle, host-controlled public-key trust, source and scope binding, and fail-closed missing trust. Lane A follows that architectural pattern for **test-catalogue** reviews, not the #2937 real-product evidence scope. Do not feed a test-review receipt into Casebook or DSDD as evidence that real product behavior passed.

Our named role `PP-F00-LA-W0001` is an operator-facing **alias**. The organization-chart registry's canonical actor ID is `PP-F00-D02-W0001` (central independent quality). Preserve both identities; do not create two separate principals or claims.

## Independent operating principals (not author-issued)

- Coding principal: existing Software Factory identity / real owner-Windows SID, to be independently measured.
- Reviewer principal: **different independently observed Windows service execution token/SID** and reviewer actor `PP-F00-D02-W0001`; it need not be a normal interactive Windows login. Its service identity must be protected from the coding and manager identities, with no GitHub write token, model coding grant, catalogue-editing or merge permission.
- Registrar / trust authority: separately authorized F00 owner or security administrator, external to the coding process. Registrar holds a separately protected Ed25519 signing key and controls the trusted public-key registry and the one-use challenge ledger.
- Registrar must observe the real Windows process token SID and the reviewer's private-key ACL **out of process** before attesting their SHA-256 evidence. Reviewer-provided JSON claiming those observations is not proof.
- Host consumer receives only the independently installed reviewer's **public** key after registrar approval. A committed PR, self-published GitHub comment, synthetic test signing key, or arbitrary key registry supplied by a review request may never establish trust.
- Do not run this ceremony under the coding account or reuse the current authenticated Factory tunnel token as reviewer credentials.

## Enrollment sequence (no password or private key through ChatGPT)

1. The single approved **Always-on PlotPickle installer** (owner-reviewed elevation/consent) provisions a dedicated **noninteractive, restricted reviewer service execution identity**, such as a supported service SID/virtual account or a separate least-privilege managed local account. There is **no separate installer choice** requiring a normal user to create an interactive login. The exact Windows SCM identity method, upgrade/rollback and access-control configuration must first pass native Windows acceptance. Installer completion alone cannot activate Lane A or create independent review authority; pre-install and tests must remain inert.
2. An external registrar independently observes the actual reviewer service process token/SID and the Software Factory coding process token/SID and confirms they are distinct. A service name, task name or worker label is not SID evidence; a manager-owned JSON assertion is not an independent observation.
3. Generate and store an Ed25519 signing key **only within the approved restricted reviewer identity** using an independently reviewed signing ceremony. Prefer a nonexportable OS-backed key **only after proving real Ed25519 compatibility and process-bound isolation** on the supported Windows release; otherwise use a protected key file outside all Git checkouts with inheritance disabled and a verified NTFS ACL limited to the reviewer's distinct service SID plus strictly necessary OS security principals. Never send the private key, recovery secret or password into GitHub, ChatGPT, PRs, the Service Manager or the coding worker. The registrar captures a redacted token/ACL/key-fingerprint witness out of process.

4. Independently authorize the registrar key and reviewer account; registrar issues a **fresh one-use challenge nonce**, bound to the reviewer role, canonical actor, actual SID, host ID and public-key fingerprint. Reviewer signs the challenge using its isolated private key. Registrar checks key possession, Windows token and private-key ACL independently.
5. Registrar signs a time-bounded `PP-LANE-A-ENROLL-V1` envelope containing the role alias/canonical identity, SID, host, reviewer key, challenge, scope, observed evidence digests, and timestamps. Its signing key and trust registry remain outside PlotPickle and outside PR control.
6. The read-only `lane-a-reviewer-enrollment.mjs` verifier checks registrar signature, possession signature, reviewer/coder SID separation, approved scope, nonce, evidence claims and expiry. Its result is deliberately a **candidate only**; the actual Windows process/ACL observation and challenge-consumption receipt must be separately accepted.
7. The `lane-a-admission-chain.mjs` fixture can verify an enrollment and an Ed25519 test verdict end-to-end, but always reports `CRYPTOGRAPHIC_DRY_RUN` and **no production powers**. Production activation needs an additional independently governed integration with the existing owner-controlled verifier trust boundary and process monitor.
8. After independent reviewer qualification, it may inspect the actual #3321/#3322 editions and issue an attributable `ADMIT`, `FIX`, `REJECT` or `UNPROVEN` for each edition. **A cryptographically verified fixture is not a real independent judgement.**
9. A different authorized catalogue maintainer may update `config/verification/test-catalog.json` *only* after a genuine independently signed `ADMIT` matches exact current test and implementation digests, approved WHITE-PAPER-V3 W8/W9 and source revision. Then rerun seven-layer exact-head CI, retain Windows Product Gate and STOP as separate release conditions. Do not start Lane B as a shortcut.

## Proof and STOP checklist

- [ ] Single installer provisions a restricted **noninteractive** reviewer service identity with clean-install/update/uninstall and rollback proof; no separate user account setup required.
- [ ] Distinct actual Windows service/coding process token SIDs observed **out of process** with durable evidence, including supervisor provenance.
- [ ] Reviewer-only private-key access established and ACL inspected by external registrar.
- [ ] Separate registrar trust root installed via protected operator configuration; private keys never in repo.
- [ ] Fresh nonce recorded by registrar; replay refused even after restart.
- [ ] Reviewer proves possession of the expected Ed25519 private key; signer/author/registrar remain separate.
- [ ] A real signed **non-ADMIT** training verdict is validated on the owner Windows host with source hashes and preserved evidence.
- [ ] Independent reviewer completes W8/W9 normative and security training; its verdict quality is reviewed separately.
- [ ] Key loss, suspected compromise or STOP revokes activation; uncertainty never implies success, and an old ADMIT cannot defeat a revocation.
- [ ] Privilege inspection confirms **no GitHub branch writes, no coding, no merge, no protected catalogue edits and no Lane B claims**.

## Existing evidence and current blockers

- PR #3321: local negative tests pass; exact-head CI blocked by independently governed test-truth admission; prototype `wx` claim is not tamper-resistant, so Lane B must remain off.
- PR #3322: synthetic Ed25519 tests pass; exact-head CI blocked by the same truth gate. New enrollment tests are additional **unadmitted** editions. Neither self-approves.
- The existing Factory tunnel can inspect the Supervisor and execute allowlisted tests, but exposes **no supported Windows service-identity or credential provisioning action**. Supervisor heartbeat does not prove reviewer process ownership.
- The draft `Inspect-PlotPickleLaneAIdentity.ps1` is currently a **read-only file-key ACL inspection prototype** executed as the candidate reviewer. It does **not** prove an installer-created Windows virtual service principal, a nonexportable OS-backed key, independent registrar attestation, trusted challenge consumption or a running reviewer service; those require separately reviewed native Windows integration.
- This draft PR provisions **no** account, service identity, key, registrar, trust activation, test admission or reviewer on the owner host. The approved installer must deliver reviewed native service-identity creation, but trusted F00 admission remains separately credentialled and independently verified even after a successful installation. No duplicate tunnel or second supervisor is introduced.

## Fail-closed test doctrine

The enrolled public key is never accepted from the test-review request itself. Different prompts, threads, models or labels do not prove identity isolation. Registrar and reviewer signatures authenticate signed bytes, not the truth of an unverified Windows observation. All claims of real operation require separately collected owner-machine evidence. Draft PRs must stay unmergeable until all exact-head gates pass.
