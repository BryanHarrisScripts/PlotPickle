# Storyboard panel mockup implementation — #2928

This developer brief is governed by GitHub issue #2928 and the Human-provided screenshot in the October 11, 2026 PlotPickle conversation. Builds on merged #2926 / #2927 without changing canonical approvals. The screenshot's intent is the reference: image/actions left, image prompt + Story and Scene / Beat right, large editable reviewed brief below.

## Implementation
- All 25 Storyboard positions render the right context regardless of image/locked status. Map Mini-Block Scenes/Beats honestly; distinguish general Mini-Block beat context from exact Shot mapping. Show original prompt only when saved; never fabricate recovered prompt.
- Keep image version browsing, Save/Lock/Unlock/Redo/Delete, image prompt preparation, generation consent, and selected provider unchanged.
- When locked and saved, render Analyze Shot and Create Narration actions beneath the image in the original component's UI through a React portal. The handoff retains provider calls, draft and approval state; the portal changes physical placement only. Planned shots show disabled actions with prerequisite title.
- Review proposals remain editable in a full-width below-shot panel. Hide only the repeated embedded facts, not the source facts or the durable narration approval. Replace misleading Graphic Novel Bubble heading with Narration review/approval; Previs retains graphic-novel presentation.
- On narrow windows stack image and context vertically with no sideways scrolling.

## Verification and safety
- Source and layout contract: tests/issue-2928-storyboard-shot-layout.test.mjs.
- Existing Storyboard/Previs text contract: tests/issue-2807-storyboard-previs-handoff.test.mjs, tests/issue-2839-storyboard-text-narration.test.mjs.
- Rendered Windows product proof: scripts/developer-diagnostics/product-proof/2821-save-session.mjs must activate buttons in their new parent Shot region.
- Exact-head required Architecture and Windows gates green before merge. Synthetic checks do not prove actual user machine or provider generation.
- Do not mutate user images, screenplay, approvals, profile security, provider route, or billing. Preserve #2855 attended quality acceptance.
