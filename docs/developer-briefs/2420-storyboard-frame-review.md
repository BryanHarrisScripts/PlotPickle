# Developer Brief — #2420 Storyboard frame review and Previs handoff

## Goal

Give each generated black-and-white WebP in Storyboard its own Accept, Regenerate and Reject decisions at the correct one of 25 positions. Stop sending Previs users into the legacy Build screen to find these controls.

## Existing capability

Storyboard already generates 1, 5 or 25 position-specific draft WebP artifacts through the configured provider and stores their position and Mini-Block address. The foundations visual commands already accept, unaccept and reject an artifact while preserving rejected provenance. Previs already has a selected-address evidence panel and a route back to Storyboard.

## Implementation

- Show the latest non-rejected generated image for its own position after reload. A candidate from another position cannot be selected there.
- Accept only after Human review; when replacing an accepted image at the same address and position, unaccept the previous image. Keep other positions untouched.
- Reject with the canonical discard command and retain provenance. Regenerate prepares this position's existing editable prompt and single-image provider consent flow.
- Remove the Previs Build shortcut and duplicate Storyboard visual editor. Send visual review back to Storyboard, and make Inspect evidence scroll to the selected panel.
- Hide destructive shot removal and omission controls in Previs. Preserve its camera, movement and timing authoring.

## Verification

Run the nearest Storyboard review and Foundations command regressions, focused UAT contracts and production build. GitHub checks own final exact-head verification. Confirm the Previs handoff and decisions in live product UAT before treating visual observation as proven.
