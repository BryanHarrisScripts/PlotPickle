# Story Architect durable Outline reviews

Issue: #2711. Parent: #2707. Prerequisite: #2709 / PR #2710.

## Writer outcome

Assess Act runs the configured Mastra Story Architect against supplied evidence. After closing and reopening PlotPickle, the writer explicitly resumes remaining Blocks from the existing assessment history. Completed validated findings survive; cancelled work never resumes. Findings stay advisory and never accept story changes.

## Existing owners

The Outline board owns assessment presentation and currently loops in browser memory. `modules/plan/outline-agent-assessment.ts` owns bounded request construction and citation validation. The writing-assistant gateway owns provider/model resolution; Mastra remains the application worker. Responsibility runs own lifecycle, permissions, budgets and artifact references. Profile-private storage owns encrypted project material. Pi owns atomic admission and checkpoint scheduling, storing opaque identifiers rather than story content.

## Started implementation

Extract the existing request construction into `buildOutlineAgentAssessmentRequest`, preserving its worker role, quality route, bounded sample and instructions. Browser assessment consumes that same contract. Preserve the existing per-block fingerprint and validation.

Add `outlineAssessmentMaterialReceipt`, a SHA-256 identity over canonical project JSON excluding only top-level revision/update bookkeeping and the two Outline advisory assessment collections. Changed source, planning, character material and unsampled passages invalidate the identity. Property ordering and JSON round trips do not. This receipt checks stale material; it does not authenticate a profile or authorize execution. Persist only the digest in Pi; retain private material in encrypted storage.

Focused evidence: 11 local regressions pass, including five executable input-contract tests and the existing Outline/structured Mastra contracts. This branch does not yet connect a durable host worker, persist task artifacts, expose resume controls or prove application recovery. Production build and exact-head CI remain required before promotion.

## Remaining implementation and acceptance

1. Add the new task route to the existing authenticated profile/CSRF boundary without changing unrelated compatibility endpoints. Derive profile, project, named agent Elowen, run authority, grants and exact compute on the host.
2. Use the shared request/validator in the actual configured Mastra worker, carrying cancellation. Revalidate unlocked profile, ownership, material identity, selected compute, grants, active run and remaining budgets before each request and result admission.
3. Persist pending task mapping, validated proposals and honest usage through existing encrypted profile-private storage. Use stable task and artifact identities; skip committed findings after reopen. Uncommitted interrupted inference may require recomputation and usage.
4. Replace the browser multi-block loop with start/progress and explicit resume/cancel in the existing assessment history. Preserve single-block assessment and failure presentation. Startup performs no task inference.
5. Fail closed for cross-profile/project access, locked profiles, stale material, changed compute/grants, cancellation, corrupt state, concurrent duplicate actions and exhausted budgets. Own advisory writes must not invalidate unchanged task input.
6. Independently prove actual Mastra execution against a bounded synthetic OpenAI-compatible fixture, distinctly labelled from a real user-selected provider. Prove protected persistence, Windows launcher close/reopen, remaining-block execution and startup zero-inference through the existing Windows/WebMCP gate.
7. Run affected Outline/profile/responsibility regressions, production build, convergence and exact-head gates. No canon acceptance, media/publishing/game effects or repository mutation are granted to this application task.
