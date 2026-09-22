# #2360 Block 01 real-media first slice

## Purpose

Deliver the smallest real product outcome from the #2360 continuous visual-workflow brief without creating another media authority.

This slice keeps one selected Block / Mini-Block / screenplay passage attached to the same visual work while the Human moves through Outline, Storyboard, Previs, Timeline and Production.

## Existing authorities reused

- Screenplay source: existing project source evidence and Storyboard anchor evidence.
- Visual generation: existing `/api/local-ai/generate/image` route and current Local / Cloud / Hybrid routing policy.
- Media persistence: existing `build.foundations.visualArtifacts` plus `foundations.visual.store`.
- Working visual acceptance: existing `foundations.visual.accept` / `unaccept` authority.
- Private navigation context: existing profile-private Story Map context.
- Stage navigation: existing five-stage rail from #2285.
- Timing authority: existing Previs ProductionShotIntent remains authoritative; this slice does not manufacture approved timing.

No new media database, prompt database, production timing store, or separate visual application is introduced.

## Human path

1. Open Block 01 and choose a real screenplay passage.
2. Review/edit the first-image prompt.
3. Choose Create first image.
4. PlotPickle sends one real image request through the already-selected image route.
5. The returned asset is stored in the canonical project together with the exact submitted prompt, source passage identity, source revision, provider/model, and relevant generation settings.
6. The Human reviews the image and explicitly chooses Use image.
7. Only after that acceptance may Build 3-image sequence generate the missing second and third images.
8. Each completed sequence image is saved immediately. If a later image fails, completed assets remain and Retry creates only the missing frame.
9. Play preview cycles the same real generated assets in place as a still-image animatic.
10. Proposed preview holds are visibly review data, not approved production timing.

Three images satisfy the requested three-to-five starting sequence for this first vertical slice. Later work may add/remove/reorder coverage without imposing a fixed final shot quota.

## Continuity and recovery

The existing private Story Map context now retains the selected passage in addition to Block, Mini-Block and active five-stage location. The shared Block visual workspace reconstructs its sequence from canonical project artifacts after stage changes or reload.

Image jobs snapshot project, story address and passage at submission. If that selection changes before a result returns, PlotPickle refuses to attach the late result to the new context.

## Privacy and spend

The full screenplay passage and prompts stay in the existing private project/browser flow; they are not added to public developer telemetry by this implementation.

Manual image mode remains non-generating. Cloud image routes retain the existing explicit billing acknowledgement. The implementation never silently switches privacy/provider mode or downloads a model.

## Proof boundary

Focused automated tests prove the contract wiring, persistence, acceptance boundary, partial-retry behavior and in-place playback construction.

They do not prove that a configured Windows image provider actually produced aesthetically correct media. A real Windows configured-provider run is still required before #2360 can claim the corresponding runtime evidence as PASS under #2331.

This PR is only the first #2360 product slice. It does not close the later five-script-page / five-visual-companion-page, Timeline refinement, MP4/package export, or full DSDD evidence-return milestones.
