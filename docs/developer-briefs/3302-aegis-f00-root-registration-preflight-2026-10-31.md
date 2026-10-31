# #3302 AEGIS/F00 protected public-root installation preflight (candidate)

**31 October 2026. Engineering proposal only; not signed policy, admission or permission to alter owner Windows.**

## Recorded source and owner-Windows facts

- AEGIS mathematical preflight is already merged from PR #3345. Reuse F00 Lane A and the existing single PlotPickle Always-on installer / Service Manager; do not create a competing verifier, supervisor or tunnel.
- Owner-Windows native C# service compiler and inert self-test returned `INERT_CSC_SELF_TEST_PASS` on clean MAIN `f7b1323ecc78a3e8799503d8c9e15c12406ac35a`; the fixed Windows service `PlotPickleLaneA` was `NOT_INSTALLED`.
- A previously provisioned encrypted offline Ed25519 root private key and its public SPKI DER exist on separate owner-controlled storage. The public DER SHA-256 matched the fingerprint already recorded by the owner. This proves continuity of the public bytes, **not** separate registrar custody, independent review, whole-device encryption, or release approval. Keep the private PEM out of the checkout, service installer, GitHub and ChatGPT.
- Owner ran the existing read-only `Inspect-PlotPickleLaneATrustRoot.ps1`; it returned `ROOT_NOT_INSTALLED`, `registryPresent=false`, `independentPublisherAttestation=UNPROVEN`, and all operational grants false. Do not treat root absence as authorization to create a registry key.
- No eligible Authenticode code-signing certificates appeared in the owner's two ordinary Windows Personal stores. Authenticode publisher trust is independent of the offline Ed25519 AEGIS/registrar root. Neither may be substituted for the other.
- An authenticated Windows engineering runner exposed a missing `$env:OS` variable, incorrectly producing `WINDOWS_REQUIRED`. This PR proposes only an OS-platform guard correction to the **read-only** trust inspector. No registry mutation or new trust path is introduced.

## Distinct principals and trust boundaries

1. **Publisher / offline root custodian:** Holds the established root private key offline and approves specific registrar delegations with an out-of-band fingerprint witness. A local fingerprint check performed by the coding principal is a candidate observation, not independent custody evidence.
2. **Registrar:** Holds a **different**, independently authorized Ed25519 private key outside coding and Manager authority. Maintains a replay-resistant, protected challenge/nonce journal and attests actual reviewer token, permissions and key-access evidence.
3. **F00 Lane A independent reviewer:** Runs as the restricted `NT SERVICE\PlotPickleLaneA` identity only after reviewed native service installation, independently witnessed effective token privileges, SCM DACLs, isolated reviewer key and challenge enrollment. It may review exact test truth and sign bounded verdicts; cannot update source, protected catalogue, merge or self-enroll.
4. **Protected catalogue maintainer:** Distinct from both the test author and F00 signer; binds W8/W9 test truth only after genuine independently signed ADMIT for the exact source/test editions.
5. **Green-only release authority:** Distinct owner release authorization, exact-head seven-layer CI, native Windows Product Gate and sticky STOP/PAUSE.

A different process name, Windows login string, ChatGPT thread, directory, or new self-signed key is **not** independent authority. A locally administered HKLM key does not independently attest who approved the root.

## Protected public root: proposed installation contract (NOT implemented)

Proposed fixed registry observation interface is the existing read-only path
`HKLM\SOFTWARE\PlotPickle\ServiceManager\Trust\LaneA`, value
`RootKeyFingerprint` (lowercase 64-character SHA-256 of Ed25519 SPKI DER).

This fingerprint value alone is **not** a cryptographic trust anchor: the independently authorized consumer must also obtain the approved public SPKI bytes from a separately protected operator-controlled source and compare their SHA-256 with the out-of-band pin. A value inserted by the coding worker, repository script or unreviewed administrator action is insufficient.

A future separately reviewed privileged installer may propose a registration only with:

- An independently approved **public** root SPKI edition/fingerprint, and an out-of-band signed policy/owner authorization naming the exact host, allowed key and scope. Never import or read the offline private root.
- A clean exact-source release, reviewed script/executable SHA-256 and a separately approved publisher identity. Do not promote an unsigned diagnostic `.exe` to trusted production software.
- UAC under the authorized operator, a reviewed HKLM registry ACL (deny broad write for Everyone, Authenticated Users and BUILTIN\\Users), explicit ownership and verified non-inherited write paths. Independently witness any rights that permit a coding account to rewrite the trust anchor; an administrative owner can still change policy.
- Fail closed if any target value or subkey already exists unexpectedly, ACL inspection fails, the source is a junction/reparse point, the pinned fingerprint differs, required STOP provenance is uncertain, or a signed policy is missing/expired/revoked.
- An idempotent no-change result only when the already-protected root matches *both* the independently approved public bytes and policy; otherwise block and require reconciliation. No silent overwrite or repair.
- A dry-run/plan output first and an explicitly separate, opt-in, authenticated apply. Do not put generic `Set-ItemProperty`, `reg add`, `New-Item`, `sc create` or key-generation commands in the current candidate. The actual mutating installer and rollback must be separately reviewed.
- A rollback/removal protocol that never deletes an unrecognized or previously installed root, does not follow altered registry keys/ACLs, and leaves STOP asserted on uncertain partial failure. Source upgrade/restart cannot auto-reenroll or replay a signed nonce.

The owner must be able to decline the installation without affecting the existing coding dispatcher, Windows supervisor, applications or authenticated MCP tunnel.

## Evidence ladder and acceptance

A. **Observed now:** Existing offline root public SPKI fingerprint continuity; no HKLM public-root registration; inert service compiler self-test; F00 service not installed; all independent admission flags false.

B. **Proposed engineering-only fix in this PR:** Replace the trust inspector's brittle `$env:OS` check with the Windows platform API. Continue returning `ROOT_NOT_INSTALLED` or `LOCAL_TRUST_ROOT_CANDIDATE_ONLY`, never independent attestation or activation. Existing `tests/issue-3302-lane-a-native-service-host.test.mjs` provides the nearest read-only/no-mutating regression. Do not change that admitted test or its protected W8/W9 binding in this implementation PR.

C. **External bootstrap prerequisite:** A genuinely separate authorized reviewer and a different catalogue maintainer approve the exact code/test and independently pinned root/delegation; preserve signed attributable receipts, normative W8/W9 digest, actual test source SHA-256 and one-use challenge evidence. An author-generated Ed25519 fixture or owner comment alone is not independent ADMIT.

D. **Future implementation:** Only after C, separately vet a fixed privileged public-root installer with signed release/package, SCM identity, ACL and rollback acceptance. Complete independent registrar/key custody and actual token/SCM effective privilege witnesses, then run source-bound negative tests, full architecture CI and native owner-Windows Product Gate. Keep `canEnroll=false`, `canAdmit=false`, `canMerge=false` until individually proven.

## Validation and STOP

- On a separately staged candidate head, compare only the trust inspector's Windows platform guard; confirm the registry path, external pin, ACL checks, all denial codes and all privilege flags remain byte-for-byte unchanged.
- Execute the existing unchanged native service host test through approved exact-head gates. For an owner-Windows read-only probe with the independently pinned fingerprint, expected current status is `ROOT_NOT_INSTALLED`; any difference requires inspection, not registry repair.
- Admit test-input source changes independently if W8/W9 input bindings require it. No author-side catalogue update and no CI workaround.
- **Always disabled:** service registration/start, root installation, reviewer signing, nonce issuance, W8/W9 ADMIT, Worker 1 activation, automatic merging and source-head migration.

**Current state:** `BLOCKED / UNPROVEN` for independent F00 commissioning. This draft is engineering preparation, not the registrar, signing ceremony or installer itself.
