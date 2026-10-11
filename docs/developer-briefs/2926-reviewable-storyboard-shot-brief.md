# Reviewable Storyboard shot brief and narration layout

Issue #2926; parent PP-NARR-001 acceptance remains #2855.

## Problem and user outcome

The selected Local Writing model passes a basic Writing check, but the structured shot-analysis request repeatedly fails before the user receives a reviewable draft. A short narration request is not enough context by itself: the user wants the shot’s supported action and storytelling role established first, with camera, blocking, lighting, timing, information boundary, continuity, and image prompt considered as one reviewable shot brief. The current multi-column cards also separate image controls, shot facts, and narration, making the handoff hard to inspect.

Deliver a two-stage, single-shot workflow:

1. Analyze the selected shot from available authored evidence and propose missing facts.
2. Let the Human review and edit the proposal, then draft short narration from that reviewed brief.

Show one vertical sequence of unified panels. Each panel places the image carousel and image controls plus its prompt on the left, shot facts in the middle, and narration controls and status on the right. Locked-shot Previs handoff stays within the corresponding shot panel.

## Acceptance criteria

- The brief uses selected-shot screenplay evidence, the actual Mini-Block Scene/Beat mapping, authored shot facts, and any saved Storyboard image prompt that exists.
- A text-only writer does not claim to have inspected image pixels. A recovered image prompt can guide intended composition, but it is not proof of image contents.
- Missing facts and prompt text are clearly marked as proposals. A Human can review and edit them before narration. Discarding a proposal does not change canonical shot data.
- Narration is drafted only from the reviewed brief and retains existing short-output, exact-dialogue, selected-shot, and human-approval rules.
- The existing durable approval path records the reviewed brief as source evidence without changing image lock, screenplay, or shot canon.
- Only storyboard-shot-brief gets the longer bounded local response window; standard requests and final narration keep their current budget. Provider selection does not silently change and no Cloud fallback is added.
- A timeout reports the actual configured response limit, and failed analysis leaves all existing saved state unchanged.
- Focused regressions verify two-stage flow, source grounding, editing/proposal boundary, durable reopen/source identity, unified panel layout, and request-specific response limits.

## Impact map

- Owning domains: Storyboard/Previs UI, shared narration evidence and Mastra provider runtime.
- Main owners: app/_components/preproduction/storyboard-locked-shot-handoff.tsx, app/_components/storyboard/storyboard-readiness-workspace.tsx, app/_components/storyboard/storyboard-readiness-workspace.module.css, app/api/previs/narration/route.ts, core/media/previs-narration.mjs, core/contracts/previs/index.ts, and build/mastra-agent-runtime.ts.
- Consumers: Previs and Timeline read the shared narration source identity and durable approval.
- User-state boundary: proposal state stays reviewable and non-canonical; Save & Lock is the only path that makes narration current.
- Provider boundary: use the configured Local writer through the existing provider abstraction; no provider-specific routing or fallback.
- UI proof: inspect the vertical per-shot layout and exercise the review/edit path in the local app.
- Regression owners: issue 2839 narration and durable-approval suites, issue 2855 source identity and Previs handoff suites, issue 2909 writer schema, and issue 580 runtime timeout contract.

## Do not change

- Do not save, lock, unlock, rewrite, or delete the user’s story images or narration approvals during automated or live testing.
- Do not promote proposals to story canon, represent prompts as recovered originals, or claim pixel understanding from a text-only model.
- Do not add paid/cloud fallback, a new approval store, or an alternate provider authority.
- Keep issue 2855 open for real local-model quality and user-device acceptance.

## Verification

Run focused narration/runtime tests, focused UAT contracts, production build, BEN code-quality evidence, and the convergence evaluator. Then create a PR and require exact-head GitHub Architecture and Windows Product gates to pass before merging. A synthetic provider test proves route/contract behavior only; it does not prove the user’s local model can produce a good shot brief or narration.