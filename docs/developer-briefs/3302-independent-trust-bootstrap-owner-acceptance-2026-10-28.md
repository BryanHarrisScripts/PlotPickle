# Lane A independent trust bootstrap and owner-Windows acceptance
## 28 October 2026 — #3302, #3268, #3142

**Scope:** one Always-on installer, one PlotPickle Service Manager, a **distinct restricted F00 reviewer service** and the existing single authenticated tunnel. This is a candidate engineering protocol, **not production admission** or permission to install unsigned source on the owner machine.

### The trust root cannot originate with the coding worker

An installer can automate local service identity provision, but **independent review authority is not a program installation side-effect**. The first registrar's Ed25519 public-key fingerprint and signing privilege must be obtained/approved through a trusted channel *outside* the author-controlled GitHub PR, coding worker, and Service Manager. A separate trusted registrar must retain the corresponding private key. Do not mint a registrar key in the coding worker, copy a private key into GitHub/ChatGPT, or treat a fresh self-signed "independent" service as qualification.

An initial real **human or organizationally independent security reviewer** is required to bootstrap F00:
- Must not be the author/coder, a renamed process sharing the coding token, or the same private signing key with another label.
- Receives the exact source/obligation packet from [#3322](https://github.com/BryanHarrisScripts/PlotPickle/pull/3322), checks the approved WHITE-PAPER-V3 W8/W9 normative digest and all edited tests/inputs, and independently records a specific ADMIT/FIX/REJECT/UNPROVEN verdict.
- A separate catalogue maintainer, **not the candidate test author and not the signed reviewer itself**, applies approved digest bindings in the protected truth catalogue. The owner controls authorization and can refuse any attempted trust bootstrap. An owner's general "continue" does not substitute for a source-specific independent verdict.

### What is implemented today

1. \`PlotPickleLaneAService.cs\`: **inert** .NET Framework Windows SCM host under \`NT SERVICE\PlotPickleLaneA\`. It cannot sign or review; STOP is implemented.
2. The internal \`Install-PlotPickleLaneAService.ps1\` is PLAN_ONLY by default. The future one-installer's internal apply path requires UAC, a separately reviewed and trusted Authenticode-signed binary, exact SHA-256 and restricted image-path permissions. It registers as **manual/demand-start**, no secret creation and no automatic reviewer admission.
3. \`Inspect-PlotPickleLaneAOwnerAcceptance.ps1\`: owner-Windows **read-only** candidate collector. It insists on an exact externally pinned source commit, a clean checkout, expected exact binary digest and externally approved Authenticode publisher thumbprint, the local Supervisor STOP marker, fixed SCM image/config, restricted service SID and real process owner SID. Its output always states independent registrar, reviewer key, W8/W9 and Product Gate **UNPROVEN**, and all operational grants false. A local observation is never an independent attestation.
4. \`lane-a-external-trust-bootstrap.mjs\`: verifies an **externally pinned** Ed25519 registrar public key against the signed enrollment and reviewer key-possession proof, distinct reviewer/coder Windows SIDs, independently expected token and ACL evidence digests, a protected nonce ledger *snapshot*, and STOP. It **always** returns BLOCKED or CRYPTOGRAPHIC_CANDIDATE_ONLY with every production permission false. A claimed protected nonce snapshot is not atomic one-use consumption.
5. The diagnostic-only Windows workflow exercises native ServiceBase compile/self-test, a disposable SCM virtual-account SID/start/STOP canary, default-denied owner-machine collector and in-memory cryptographic fixtures. **That author-side runner is not a distinct F00 reviewer and not owner Windows acceptance.**

### Four mutually independent proof boundaries

| Required proof | Appropriate authority | Current result |
|---|---|---|
| Signed executable, SCM process owner token, protected image/ACL, physical Windows STOP and safe recovery | Clean Windows release + owner-machine acceptance + independent Windows token observer | Ephemeral Windows CI SCM canary passed; owner Windows **UNPROVEN** |
| Ed25519 reviewer private-key isolation, out-of-band registrar pin, one-time challenge and durable consumption | Reviewer restricted service identity + independently controlled registrar/private key and protected nonce ledger | **NOT PROVISIONED**, cryptographic verification code only |
| Exact test/implementation digests, approved obligations W8/W9, separate ADMIT/FIX/REJECT | Qualified independent reviewer with protected credential | **NOT ADMITTED** |
| Protected truth binding, exact-head Architecture Verification, owner Windows Product Gate and green-only merge | Distinct catalogue maintainer and release controller | **BLOCKED**, no merge |

### Safe order of actual owner-machine acceptance

**Stage A — independently admit the new source/tests.** A distinct authorized reviewer must review the exact test editions, including this bootstrap verifier; a different maintainer updates protected truth. Do not bypass the gate by calling a CI fixture "independent".

**Stage B — vetted release packaging.** Build the native service with a reviewed Windows compiler, obtain Authenticode signing from an independently approved publisher/release process, and anchor expected binary SHA-256 and publisher identity outside the PR. The independent evidence packet references the approved source head and signing policy. Do not use an unsigned CI canary executable as a production installer image.

**Stage C — one owner-approved Always-on installer.** The installer internally provisions the restricted \`PlotPickleLaneA\` service while retaining the existing Supervisor and tunnel until replacement acceptance. No independent review work starts; installer must respect persistent STOP, isolate service data/key ACL, and support uninstall/reboot rollback. Never attach this operation to an unapproved ChatGPT plugin command.

**Stage D — read-only Windows observation.** On an independently staged, clean, exact-source checkout, a privileged source-bound owner Windows acceptance harness may call \`Inspect-PlotPickleLaneAOwnerAcceptance.ps1\` with **all three externally approved pins** and \`-RepositoryRoot\`. It must collect a separate process-token/privilege/SCM DACL witness; this local script only gathers some preliminary facts. The STOP path it observes is the *calling user's local profile* and **cannot on its own prove absence of every owner/supervisor STOP marker**. A reviewer must independently confirm actual STOP provenance and privilege isolation.

**Stage E — reviewer signing key and registrar.** Only the approved reviewer service identity (not author/manager) may generate/hold a protected Ed25519 key using a Windows-compatible, independently tested mechanism. Ensure the coder/manager cannot read/export/sign with it. Registrar independently witnesses real Windows token privileges/ACL, issues its own fresh nonce, signs enrollment and durably consumes the nonce under separately protected storage. Export **public** key/fingerprint only. There is no implemented production key-generation service yet; the native host remains intentionally inert.

**Stage F — real signed admission and release.** After separate reviewer qualification, accept source-bound signed W8/W9 verdict through the independently pinned trust anchor, permit a different catalogue maintainer to bind exact tests, then rerun unchanged-head seven-layer CI and owner Windows acceptance. Merge only after ALL required checks succeed.

### Operational notes and explicit STOP rules

- The connected Factory tunnel supports read-only status and specific allowlisted Windows tests, **not** arbitrary C# compilation, SCM provisioning or protected credential operations. Do not simulate proof by emitting an unsigned JSON receipt from the coding identity.
- As last observed, the original owner host's checkout is older than GitHub MAIN and its independent Supervisor has no fresh owned heartbeat. The candidate read-only PR check returned \`CANDIDATE_BASE_MISMATCH\`; nothing was staged or installed. Never force-sync the live runtime, clear STOP, replay reserved jobs, or overwrite existing Windows services.
- An observed SCM RUNNING state is merely a diagnostic identity host. It is **not** reviewer qualification; it confers no approval, source edit, catalogue update, coding, model expense or merge authority.
- Never publish a private Ed25519 key, service password, bearer token, user SID + private path, trust-store secrets or private Windows ACL details in GitHub comments or ChatGPT. Use redacted SHA-256 evidence and independently protected storage.
- An inability to verify an input is **UNPROVEN/BLOCKED**, not automatic retry or permission to weaken W8/W9.

**Next real external step:** designate and authorize a genuinely separate F00 registrar/reviewer and its out-of-band public-key fingerprint; only then can its key custody and one-use enrollment be truthfully proven. This is an internal trust-bootstrap control, not a second end-user installation choice.
