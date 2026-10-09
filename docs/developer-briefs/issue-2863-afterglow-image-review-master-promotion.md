# Developer brief — Afterglow recovery to a single verified current story

Parent issue: #2863. Governing authority: `docs/white-papers/AI_Programming_Evolution_White_Paper.md` and `docs/behavioral-contracts/PP-AFTERGLOW-CONSOLIDATE-001.md`. The system implements truth, not screen-specific shortcuts.

## Human objective

A signed-in Human sees **every eligible Afterglow working copy and historical recovery snapshot** together, inspects real creative text and visual assets, chooses **Keep / Exclude / Use this saved version** and reviews **CONSOLIDATED creative work**. A verified explicit Save Consolidated Afterglow produces one durable personal working story, archive-protects the superseded Library working versions, survives restart, and reopens normally as **Afterglow**. The word "Consolidated" is an operation, not a second public Library example.

The designated publisher may later **promote** the approved personal master as the single **Afterglow** packaged example for future installations, using separate privileged GitHub publication authority and CI. An ordinary user can consolidate their own work, never publish other users' examples.

## Delivery slices

### A. Visually inspect and select recoverable images (this PR)
- Each World Map character image displays a thumbnail, an **Open image** link to its exact same-origin PlotPickle asset URL, and **View on GitHub** only if the exact filename is in the committed promoted Afterglow asset manifest.
- A same-name GitHub image is a *packaged reference*, never proof that the user's unpinned historical local bytes match it.
- **Keep** and **Exclude** are explicit per character + exact reference ID + immutable asset URL, not per loose basename. Keep an image present in an eligible recovered snapshot; Exclude removes it from the *proposed* master only. Retain references and history in original snapshots. Show the draft effect immediately, with counts and any lock consequence. Unaccepted Agent suggestions must not become approved images.
- Invalid URL, invalid source provenance, key collision, missing snapshot or stale inventory => no silent Keep. No unsanitized URLs, raw HTML injection, arbitrary websites or automatic "approval".
- All choices invalidate prior media and master-readiness checks. Image confirmation cannot manufacture original saved byte hashes or claim publishing authority.
- Independent pure tests: Ren exact packaged match; unlisted local images get local-only link; keep/exclude are reversible and isolated to the specified character/view/reference; locked-version consequences are explicit; malicious paths/collisions fail; originals untouched; no master-save button enabled.

### B. Authenticated personal master commit (separate green-gated PR)
- Reuse the internal encrypted `commitAfterglowMaster` transaction, installing a *real independent server-side authorizer*, not a browser `approved:true` flag.
- Validate all active profile-owned Library source digests at the write boundary, plus individually identified encrypted historical recovery snapshots, Human choices and media bytes. A historical point sharing a project ID must retain its own snapshot ID and digest.
- Detect missing/unknown project fields, unverified original images, conflicting approvals, unresolved creative decisions and stale readbacks; retain them as explicit blockers without deleting work.
- When all gates prove true, create one newly identified master, encrypted readback, atomic active Library index update, originals archived and recoverable, reopen after Windows restart. Idempotent retry and failed-write recovery proof required. No silent fresh-login auto-open.

### C. Official packaged example promotion (separate publisher-controlled PR)
- Confirm designated publisher authority *server side*. Normalize the verified master, import and pin all approved WebP bytes in versioned repository assets, hash-check promotion manifest and snapshot, run canonical/build/Windows checks and require explicit publisher approval. `Library → Examples` still shows exactly **Afterglow**, not another user-facing "Consolidated" template.
- Never let general Data Recovery restoration, personal consolidation, or a guessed GitHub link grant publisher privileges.

## Acceptance equations

`Candidate = DeterministicMerge(AllEligibleSnapshots, SavedHumanChoices, VerifiedArtifacts)`

`Exclude(reference) => ReferenceNotInCandidate AND ReferenceStillInOriginalSource`

`Keep(reference) => ReferenceInCandidateOnlyWhenExactSourceReferenceExists`

`ReadableImage != HistoricallyVerifiedImage != PublishableImage`

`SaveSuccess => Authorized AND AllProofsValid AND EncryptedReadbackEqual AND ActiveAfterglowCount=1 AND OriginalsRecoverable`

`PublishSuccess => PublisherAuthorized AND ExplicitlyApproved AND RepoAssetsVerified AND RequiredCI=Green`

## Current truth

Afterglow Recovery already compares live and historical sources and can preview a candidate. `commitAfterglowMaster` exists only as an internal fail-closed storage foundation; it currently has no production authorizer or HTTP route. The current preflight intentionally reports `readyForHumanCommit:false`. Never claim the final personal save/publisher promotion complete merely because the visual review PR is green.
