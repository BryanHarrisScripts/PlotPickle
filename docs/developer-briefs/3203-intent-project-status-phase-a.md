# #3203 — Intent-centered project observation: first working truth slice

Status: candidate engineering slice, **not product release or finished GUI flow**. Baseline: main `3b403e94ba4dfa50d03d68757f142ffa58e616a5`. This note is reviewed against LOCKED `docs/PLOTPICKLE-PRODUCT-CONTRACT.md` PP-STORY-001..005, PP-UX-001..007, PP-PPF-001..006. No change to the three-column shell, Dashboard, specialist editors, provider configuration or existing PPF ownership is proposed.

## One callable capability

`observeProjectStatus(request, context)` is a pure, synchronous, read-only TypeScript API in `modules/intent/model/observe-project-status.ts`. The trusted **caller** must bind the authenticated, current Human profile and the currently selected canonical `LibraryPPFProject` from the existing Project Library; the capability **does not authenticate** a caller, select a Library project, read browser storage or fetch any model itself.

Request requires exact `profileId`, `projectId`, integer `projectRevision`, `capability:"project-status.observe"`, `providerPolicy:"LOCAL_READ_ONLY"`, and optional Block 1–24 coordinate. A mismatch returns an explicit stable BLOCKED code without auto-select, auto-repair, save, paid provider or mutation. Lack of source-linked screenplay passage evidence returns `SOURCE_EVIDENCE_MISSING`. An invalid 24/96 structure or projection identity returns BLOCKED. In particular, a requested local-only observation never changes the global selected provider.

Accepted observations call **existing** `projectCanonicalProjectForOutline(project)` and `deriveOutlineReadiness(project)`. They expose only selected IDs/revision, aggregate Block/Mini-Block/accepted-field/passage counts, non-sensitive Block coordinates and readiness categories. No raw screenplay, unbounded agent explanations, private title, prompt, credential, user path or provider connection is returned. The next decision is a Human-authored review recommendation, not an execution/approval. Even successful derived observation is **OBSERVED**, not VERIFIED or PASS, because neither filesystem persistence nor independent Windows browser verification has occurred.

## Implementation evidence and limits

- Runtime tests bundle and invoke the **actual TypeScript module** and canonical normalization/projection/readiness dependencies against an isolated synthetic project. They verify read-only operation, 24/96 projection, source references, explicit identity/revision/policy/coordinate refusals, missing source, structure drift and privacy non-leakage.
- W8/W9 digest-bound tests run in the story-canon verification layer. A passing CI lane proves this capability contract only. It does **not** prove the GUI integration, persisted encrypted Library readback, independent human profile authentication, full Brotherly Love sequence, or paired owner-device Windows/browser STOP proof.
- Next bounded slice: add one real GUI entry point consuming this exact capability with authenticated Library selection and review-only presentation, keeping the LOCKED 3-column shell. No fabricated readiness; independent Windows acceptance required before claiming a live interface.
- Other #3203 phases (proposal approval/reject/fork, human canon authority, AG-UI adapter and independent end-to-end product parity) remain open. #3118 and #3142 are not unblocked by these synthetic fixtures.
