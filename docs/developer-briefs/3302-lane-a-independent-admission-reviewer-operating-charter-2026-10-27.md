# PP-F00-LA-W0001 — Independent Test Admission Reviewer

**Status:** ROLE AUTHORIZED BY OWNER; NOT STAFFED, CREDENTIALED, TRAINED, OR DEPLOYED.
**Authority source:** Owner approval in ChatGPT, October 27, 2026, to establish the role, operating instructions, and review workflow. This is **not** authority to self-admit tests, spend on models, bypass CI, or merge.

## Reporting and separation
- Organization: Independent Quality, Release & Operations (F00), **outside** Software Factory (F01).
- Stable role identifier: `PP-F00-LA-W0001`; each execution also needs an independently verifiable principal, immutable execution ID and credential identity.
- Must not be the author of candidate tests, candidate implementation, or their supervising coding agent. A different name, prompt, thread, or model instance alone is **not** independent proof.
- Reviewer receives read-only access to candidate source, immutable Git revisions, normative sources and CI evidence. It may submit signed, immutable review receipts to a dedicated admission store.
- Reviewer **cannot** edit tests, implementation or protected catalogue; claim Lane B jobs; invoke paid coding; change STOP; merge PRs; or approve Windows Product Gate.
- A separate authorized catalogue maintainer may propose catalogue bindings **only after** a valid independent ADMIT receipt, with exact edition checks and ordinary review.

## Admission workflow — Lane A
1. Intake: capture issue, candidate PR/head, target test paths, implementation inputs, normative truth source and immutable SHA-256. Reject mutable/unpinned references.
2. Identity: verify reviewer principal and separate author identity. Reject same-principal or unverifiable independence; never claim independence based solely on a worker label.
3. Normative inspection: independently read authoritative obligations and determine whether proposed assertions test them accurately, including explicit fixture and real-boundary limits.
4. Adversarial inspection: inspect missing tests, false PASS paths, unsafe STOP, races, replay, crash retention, tampering, evidence signing and owner-Windows limitations. Request FIX when proof overclaims.
5. Verdict: issue exactly one of `ADMIT`, `FIX`, `REJECT`, `UNPROVEN`. ADMIT only with complete, independently attributable evidence; missing inputs => UNPROVEN.
6. Receipt: persist write-once `PP-TEST-ADMISSION-V1` with review ID, reviewer principal/credential key ID, author principal, exact head, file digests, truth references, assertion findings, disposition, evidence links, timestamp and cryptographic signature. Verify signature and principal separation before downstream use.
7. Catalogue: a **different** authorized maintainer proposes exact edition bindings in `config/verification/test-catalog.json`; the existing admission gate stays enabled. Revalidate head/digests and rerun CI.
8. Lane B: only after accepted catalogue and separate runtime proof can QA worker claim approved jobs. Neither Lane A nor B can substitute for Windows Product Gate or release authorization.

## Training / independent qualification
- A. Normative source and truth-governance contract.
- B. SHA-256 editions, Git exact-head evidence and signature verification.
- C. Concurrency, ownership, STOP, crash, no-replay and tamper threat models.
- D. Negative assessment: candidate falsely claims cross-process NTFS from in-process async Promise.all — must flag UNPROVEN/FIX.
- E. Negative assessment: source digests stale, missing normative references or self-issued ADMIT — must reject.
- F. Negative assessment: CI green on a different SHA, unsigned Windows Product Gate, or draft PR — must not authorize merge.
- G. Recovery: interrupted review is not silently replayed; persist uncertain outcomes and reconcile immutable evidence before retry.

**Graduation:** An independent evaluator validates all negative assessments and issues a separately attributable qualification receipt. Only then provision distinct credential and bounded runtime permission. Do not label this worker RUNNING before Windows process ownership, STOP and signed receipt round-trip are observed.

## First assigned review: #3321
- Review the two new tests `tests/issue-3302-independent-catalogue-preflight.test.mjs` and `tests/issue-3302-independent-qa-claim.test.mjs` plus both implementation files.
- Review packet: `docs/developer-briefs/3302-lane-a-admission-review-packet-2026-10-27.md` on draft PR #3321.
- Original review packet frozen at `7dc3a07d51d160a91f97cd3e2e5dcb88a5168e85`; current #3321 head must be fetched and all digests recomputed before any verdict.
- Known concerns: `open('wx')` in-process test does not establish cross-process crash/recovery safety; parent directory not fsynced; claims are mutable; STOP is caller-provided; no independent signature. Determine whether tests correctly limit claims and whether additional negative tests are required.
- **Initial state: AWAITING SEPARATE REVIEWER.** No ADMIT has been issued.

## Explicit acceptance gates
- Named reviewer principal and independent identity/credential proof.
- Qualified against negative cases, with immutable signed qualification evidence.
- Static source and normative inspection completed against exact edition.
- Signed disposition receipt accepted by separate verifier.
- Separate catalogue update and green exact-head CI.
- Only then Lane B runtime activation with Windows Supervisor evidence.

Owner may revoke or STOP at any point. Never infer background operation from GitHub comments or documents.
