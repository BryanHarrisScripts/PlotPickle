# #3302 — Option A: independently secured automated Lane A reviewer
## Developer brief, 28 October 2026

**Decision:** One PlotPickle Always-on installation; one top-level Service Manager and Settings → Compute → Services control panel. Internally separate restricted Windows/service identities and signing authorities for Coding (F01), Independent Test Admission (F00 Lane A), Registry/Registrar (F00 root custody), and protected Catalogue Maintenance. These are capabilities, **not additional user installation choices**.

**Status:** Automated evidence **preflight implemented and tested**; independently governed production review **not activated**. The default does not request new OpenAI API credentials or spend model tokens. The real reviewer/registrar root is not yet provisioned.

### Reusable lifecycle

`INTAKE → PIN WORK-ORDER / EXACT GIT HEAD → ISOLATED SOURCE DIGEST PREFLIGHT → INDEPENDENT SEMANTIC/ADVERSARIAL TEST REVIEW → SIGNED ADMIT / FIX / REJECT / UNPROVEN → SEPARATE CATALOGUE MAINTAINER → EXACT-HEAD CI → WINDOWS PRODUCT GATE → GREEN-ONLY MERGE`.

The same workflow and immutable evidence/handoff contracts apply to F02 Learning & Evolution, F03 Story Builder, F04 Game Factory and the Semantic Story Coordinator. Each supplies distinct Skills, input rights, test requirements and release authorities: F03 Human Save/Lock/canon remains nondelegable; F02 knowledge/Skill admission and F04 game-rule release are not GitHub PR merge.

### Four separate trust zones

**F01 coding worker (untrusted candidate author).** May change code only with a valid one-use coding grant. May submit immutable source work orders. Must not read F00 secrets, alter F00 trusted policy, modify reviewer qualifications, self-admit W8/W9, or write the protected catalogue.

**F00 automatic reviewer (restricted service).** Fixed `PlotPickleLaneA` SCM service, `NT SERVICE\PlotPickleLaneA`, canonical actor `PP-F00-D02-W0001`. Initially an **inert** native C# host. A future installer-approved, separately token-bound reviewer runtime may read immutable source editions and external normative policy, run only allowlisted/evidence-bounded review Skills, and propose source-specific FIX/REJECT/UNPROVEN or qualified ADMIT. Candidate tests are **never executed inside the signer token**. Execute test binaries/fixtures in a sandbox worker with NO review key, then review signed provenance and results.

**External registrar/trust publisher.** A distinct, separately protected authority controls the initial Ed25519 publisher public-key fingerprint, registrar's private key, Windows SID/ACL witness, reviewer qualification, and atomic nonce-consumption ledger. The root **must not be minted or first declared by the author-controlled PR/Service Manager**. A root policy signed by the independently pinned publisher may delegate only reviewer enrollment to the independent registrar; root/registrar/reviewer signing keys must be distinct. A one-time owner-approved vendor/organizational trust policy may be installed as part of the **same** graphical installer; it is not an extra installation mode. Without such a policy, the Services panel says `EXTERNAL_TRUST_ROOT_NOT_ESTABLISHED`.

**Protected catalogue maintainer.** A different principal with narrowly scoped write authorization validates the F00 reviewer signature, reviewer admission/qualification, exact head/digests, protected truth roots, all owner STOP barriers and immutable review ledger before proposing a catalog binding. Reviewer ADMIT **never carries catalogue edit or merge permission**. Release controller is separately gated by exact-head Architecture Verification and owner Windows Product Gate.

### Implemented engineering interfaces (draft #3322)

- `lane-a-automated-reviewer.mjs`: deterministic non-executing preflight of bounded immutable source bytes, pinned expected SHA-256 editions, exact source head, W8+W9 truth reference set and a separately supplied approved normative digest. If mismatch: **FIX proposal**. If hashes agree: **UNPROVEN** pending semantic independent review. All permissions false.
- `lane-a-automated-reviewer-cli.mjs --inspect`: actual standalone, non-signing JSON stdin worker. Strict maximum request size/file limits, base64 decoding, no arbitrary subcommands, no filesystem reads, network access, subprocesses, model calls, signing, catalogue edits or secrets.
- `lane-a-signed-registrar-policy.mjs`: verifies an externally pinned Ed25519 publisher root's signature delegating only `reviewer-enrollment-only` to a **different** registrar key. Requires fresh signed policy and rejects role escalation, root-key substitution, issuer/registrar key collapse and STOP. Returns **SIGNED_POLICY_CANDIDATE_ONLY**, not trusted activation.
- `lane-a-external-trust-bootstrap.mjs`: verifies registrar-signed reviewer key possession, separate Windows reviewer/coder SIDs, protected token/ACL evidence references and freshness. Cannot independently establish out-of-band provenance or consume a nonce.
- `Inspect-PlotPickleLaneATrustRoot.ps1`: read-only Windows machine-level `HKLM\SOFTWARE\PlotPickle\ServiceManager\Trust\LaneA` observation with out-of-band fingerprint requirement and basic broad-writable ACL denial. Returns **LOCAL_TRUST_ROOT_CANDIDATE_ONLY** at most; do not treat HKLM as independent custody by itself.
- Native `PlotPickleLaneAService.cs` + `Build-PlotPickleLaneAService.ps1` + internal `Install-PlotPickleLaneAService.ps1`: guarded noninteractive Windows native service host and one-installer subcomponent. Currently inert, demand-start. Ephemeral Windows runner has proven compilation, virtual-account process SID, SCM STOP and cleanup—not owner Windows release acceptance.
- `Inspect-PlotPickleLaneAOwnerAcceptance.ps1`: read-only source/identity/STOP/publisher binary observation. Never admits tests, starts services or writes credentials.

### Independence must be **real**, not naming

- Separate Windows process token/SID, signed installed code edition, effective privileges, NTFS/registry ACLs, and a privately held reviewer key prove isolation, **not merely different labels, ChatGPT threads, or API keys**.
- The Service Manager itself must not access reviewer/registrar signing keys, protected root pins, test catalogue edit grants or reusable coding grants.
- Model-assisted semantic review, when enabled later, requires a reviewer-specific approved model/Skill, an explicit spend envelope and a distinct review execution context. Model output alone is not an Ed25519 admission.
- All external trust-root metadata originates from an independently controlled signed release or owner-approved organizational policy **outside this PR**. The initial root custody/first W8/W9 certification cannot be self-assigned by code which is itself under review. Independent bootstrap is a prerequisite for operational automation, not a recurring end-user installation choice.
- A duplicate or unreadable STOP marker, source mismatch, stale CI, missing nonce consumption, missing identity witness, revoked key, or unknown crash outcome blocks progression. No guessed PID killing, automatic STOP clearing or replay.

### Minimum implementation/acceptance order

1. **This slice:** deterministic automated reviewer and CLI; cryptographically verified external registrar delegation; read-only Windows trust-anchor observer; negative tests on a Windows non-release diagnostic lane. Output is FIX/UNPROVEN only, not ADMIT.
2. **Separate OS principal + trust root:** pre-approved issuer provides signed distributor policy to the single installer. Owner-machine acceptance verifies service binary, C# SCM startup, separate SID, ACL/coding isolation and STOP persistence. The reviewer key is created/retained only under independently protected F00 identity after trusted provisioning. Do **not** install or create keys from GitHub Actions.
3. **Independent reviewer qualification:** separate evaluator/registrar tests adversarial W8/W9 cases, reads actual Windows token/ACL and signs enrollment/qualification, durably consumes the nonce and pins signed reviewer public key. Until qualified, no admission receipts can be produced.
4. **Limited automated W8/W9 lane:** read-only candidate snapshot → separate unprivileged test sandbox → qualified reviewer semantic inspection → independently signed disposition → different authorized catalogue maintainer. Genuine ADMIT only after all evidence is sufficient; otherwise FIX/REJECT/UNPROVEN. The catalogue maintainer must never run candidate source.
5. **Release:** protect required checks, rerun seven Architecture Verification layers at exact head, owner Windows Product Gate and merge-when-green. Expand worker count only after verified stop/no-replay, simultaneous claims and resource ownership.

### Current gaps, deliberately visible

The connected owner Windows Factory tunnel supports bounded read-only inspection and named tests only; its Supervisor is OFFLINE without a fresh heartbeat, its local checkout is an older clean MAIN, and the candidate PR head has not been safely staged. There is no independently approved external root fingerprint, registrar private key, protected nonce ledger, qualified reviewer signing key, real owner-Windows service installation, or W8/W9 ADMIT. The protected test-catalogue preflight properly blocks the unadmitted new tests. Green hosted diagnostic tests are valuable **engineering diagnostics**, not independent release evidence.

**No credentials, service installations, signing keys, API charges or catalogue mutations may be inferred from this developer brief.** Preserve one installer, one manager, one tunnel and separate authority boundaries.


### Owner-custodied bootstrap proposal — NOT admitted or activated

**Decision state: PROPOSED FOR GOVERNANCE REVIEW, NOT AN OWNER ADMIT.** The owner wishes to avoid recurring outside human approvals while retaining genuine separation of coding, Lane A, Lane B, registrar and release. This section explains a possible *initial root-custody* route, not a modification to the accepted WHITE-PAPER-V3/W8/W9 truth source and not a waiver of the independent initial reviewer/qualification requirement stated elsewhere in this brief. The owner's general "continue" or queue-order approval is not approval of a particular root fingerprint, signer, source edition, W8/W9 test or release.

**The owner may be the initial external root publisher/custodian, but not automatically the independent reviewer.** The key difference is who can produce and use an assertion. Source authored by F01 or installed by the untrusted candidate cannot declare its own root trusted. An owner-approved public fingerprint and immutable signed root policy must arrive through an independently confirmed channel *outside* this PR, coding service, ChatGPT conversation and runtime installation path. A text fingerprint pasted in a coding-generated GitHub comment or a locally generated fixture is not that channel. Owner authority is an explicit, revocable trust-placement decision; it is not a substitute for qualified semantic review.

**Proposed independent security zones, if separately approved:**

1. **Root publisher/custodian — owner-controlled out of band.** Retain nonexportable or appropriately OS-protected publisher signing authority under an owner security principal, with a separate recovery/revocation plan. Verify fingerprint against an independent second channel/physical observation before a policy is eligible for protected installation. The code author, Factory tunnel, general Service Manager and GitHub App must not have signing or trust-store write access. No private key, token, SID/path pairing or recovery secret enters a PR, CI log or ChatGPT.
2. **Enrollment registrar — a different protected principal and key.** Require a signed limited-scope root delegation, independent registrar token and ACL/privilege witness, durable one-use challenge consumption and independent provenance of Windows process identity. The registrar cannot sign its own parent delegation, qualify itself, admit tests, edit protected catalogue or merge.
3. **PP-QA-A-W1 — independently qualified Lane A reviewer.** Its protected key lives under a *third*, restricted Windows service identity. The qualified reviewer may independently read exact Git source/test blobs and immutable normative W8/W9 bytes, review adversarial assertions, and emit an attributable signed ADMIT/FIX/REJECT/UNPROVEN. Merely changing model/provider/prompt, or signing a review produced by the coding identity, is not independent. It cannot edit code or protected catalogue and must not execute candidate tests inside its signing token.
4. **Separate protected catalogue maintainer.** Independently validates the actual reviewer identity, signature, exact source SHA, normalized input/test SHA-256 maps, admitted truth obligations, STOP and one-use review event before adding approved bindings. Cannot self-issue Lane A ADMIT. A distinct PP-QA-B-W1 verifies bounded test evidence; PP-WIN-W1 attests applicable Windows acceptance; PP-REL-W1 applies release policy.
5. **STOP and failure invariants.** Missing external pin, unavailable witnessed ACL/token, denied directory fsync, ambiguous crash/nonce journal state, stale head, missing reviewer qualification or unsigned truth receipt returns BLOCKED/UNPROVEN. No fallback to candidate source identity, silent root generation, side-channel key copying, replay, elevated coding, catalogue bypass, or automatic merge.

**Bootstrap ceremony — design gates, no execution authorization here:**

A. Freeze the exact candidate and normative input editions and seek a source-specific W8/W9 **governance decision** about whether a person acting as owner root publisher (separate from F01) may satisfy the bootstrap independence policy. If a genuinely separate initial evaluator is required, record that as **UNPROVEN**; do not silently rewrite "independent" as "same operator with a new role label".

B. Use a separately vetted, signed owner-machine provisioning component and independent physical/OS witness to create or import the **owner-controlled root public fingerprint** into a protected policy location. Require explicit owner confirmation of the observed public fingerprint, authenticated installed binary publisher, preexisting STOP state and protected trust-store ACL; record only public digest and immutable receipt. The candidate PR and current diagnostic-only service **cannot perform this provisioning today**.

C. Have a registrar under a distinct security principal demonstrate nonexportable key custody, mutually exclusive nonce journal writes, crash/reboot recovery and process/token/ACL isolation. Independently review Windows EPERM and path-swap/reparse negative controls. Neither success from a hosted ephemeral SCM fixture nor a simulated signed object is enough.

D. Independently qualify Lane A against the W8/W9 adversarial assessment matrix; only a qualified identity can issue an exact-edition signed test admission. The separate catalogue maintainer then validates/reconciles the approval without author-side truth changes. Lane B, owner Windows Product Gate, release and merge remain separate.

E. Verify on the *then current* PR HEAD and MAIN, complete exact-head seven-layer CI, CodeQL, and applicable native owner Windows tests. Do not merge draft #3322 or proceed to frozen #3321 or #3331 until all actual gates pass.

**Current state:** No independently pinned root, owner-held verified publisher signing key, protected registrar/service reviewer key, independent Windows principal witness, accepted source-specific W8/W9 admission or owner Windows Product Gate has been observed. This section has **zero executable grants** and does not authorize installation or activation. It preserves the one-installer user experience once independently commissioned.
