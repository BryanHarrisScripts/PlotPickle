# Developer Brief — #2428 Storyboard per-position frame review controls

## Problem

#2420 added canonical frame review, but its controls only rendered when the selected image was a newly generated Storyboard artifact. This made the actions disappear from many visible positions and obscured where review happens.

## Decision

Every one of the 25 Storyboard position cards owns a permanent review strip directly below its image.

The strip uses the writer-facing vocabulary:
- Keep / Lock
- Redo
- Reject

State is always visible as Empty, Reference image, Ready for review, or Locked.

Keep / Lock and Reject operate only on canonical generated Storyboard artifacts. Redo may prepare a replacement for any populated position. Empty positions keep the strip visible but disabled.

No new authority is introduced. Keep / Lock maps to the existing foundations visual accept command, Reject maps to discard, and Redo uses the existing single-frame prompt/generation flow.

Reload selects the latest non-rejected generated artifact at each position so a newly generated candidate is immediately reviewable.

## Acceptance

- all 25 cards contain the review strip;
- actions sit directly under the image;
- Keep / Lock, Redo and Reject are visible;
- locked state is explicit;
- reference and empty states are honest about unavailable actions;
- canonical review commands remain unchanged;
- 1/5/25 generation remains unchanged;
- exact-head CI is green.
