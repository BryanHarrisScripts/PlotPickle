# Developer Brief — #2497 Previs Static WebP, Speech Bubbles, Single-Load Entry

## Human UAT

- Remove Animated WebP.
- Keep WebP as the only Graphic Novel export; do not restore HTML.
- Graphic Novel speech bubbles must visibly work.
- Opening Previs must not show two loading screens or perform duplicate project hydration.

## Root cause

The current Previs path has three independent shortcomings:

1. #2491 encodes every locked Storyboard frame as a separate WebP animation page.
2. Previs Graphic Novel mode renders only a caption/narration plate; it never derives or renders speech bubbles.
3. Dashboard mounts `SkinV1PrevisStoryMap` and `SkinV1PrevisReviewSurface`, each with its own deferred `loadFoundationProject()` call and loading status.

## Static export contract

- Visible action: **Export WebP**.
- No HTML action.
- No format selector.
- Export one static WebP containing all locked panels for the selected Mini-Block.
- Preserve Storyboard position order.
- Omit unlocked, rejected and missing positions.
- Use one readable Graphic Novel sheet rather than animation pages.
- Keep local-only authenticated Sharp route.
- The result must report one WebP page even when multiple locked panels are present.
- Export remains presentation-only and cannot mutate PPF canon or Storyboard approval.

## Dialogue / bubble contract

Observed screenplay evidence is the only dialogue source.

- Use the same proportional 25-position passage mapping already used by Storyboard generation.
- A `character` passage establishes the speaker for subsequent `dialogue` / `dual-dialogue` evidence in the same position window.
- Never infer or invent a speaker.
- Never invent dialogue.
- Limit to two speech bubbles per position for legibility.
- Clamp bubble text to a bounded readable length.
- Live **Play Graphic Novel** displays white comic speech balloons with tails over the image.
- Static WebP composites the same speech content and recognizable balloon treatment.
- Existing derived scene/beat/shot/narration stays in a separate caption treatment.

## Single-load Previs contract

Create one Previs composition owner that:

- loads the Foundation project once;
- subscribes once to `FOUNDATION_PROJECT_SAVED_EVENT`;
- renders both Previs Story Map navigation and Previs readiness from the same project instance;
- merges Previs project changes without dropping Library-only structure/source evidence;
- shows at most one `Opening Previs…` status;
- removes the two independent `setTimeout(...loadFoundationProject())` paths for Previs only.

Do not change Storyboard, Timeline or Rough Cut load ownership in this issue.

## Verification

Prove:

- no visible `Export Animated WebP`;
- visible `Export WebP`;
- no HTML export;
- encoder no longer uses Sharp animated join / loop / delay;
- multi-panel export metadata has one page;
- static sheet preserves position order;
- dialogue derivation uses observed character+dialogue passages only;
- live Previs has speech-bubble markup and styling;
- SVG/WebP export contains speech-balloon treatment;
- Dashboard uses one Previs composition instead of two separately loading children;
- Previs composition has one `loadFoundationProject()` hydration path and one loading message;
- exact-head Architecture Verification green before merge.

## Delivery

Build, test, open PR, repair exact-head failures, and merge when green.
