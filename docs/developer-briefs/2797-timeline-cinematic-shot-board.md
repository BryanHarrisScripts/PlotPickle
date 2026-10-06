# #2797 Timeline cinematic 25-Shot production board

## Intent

Timeline is restructured as a dense cinematic production board while preserving its existing canonical authority, playback, motion-generation, export and source-revision behavior.

The Human-approved reference establishes the information hierarchy and production-board density. It is not copied literally. PlotPickle remains authoritative for its own story math and production semantics.

## Canonical model

- 1 Mini-Block = 25 Shots.
- 1 Shot = approximately 3 seconds.
- 1 Mini-Block = approximately 75 seconds.
- Timeline consumes approved Storyboard / Previs sources.
- Generated motion remains optional and separate from the locked still.
- Upstream source replacement never happens silently.

## Implemented surface structure

1. Compact production context header.
2. Collapsible approved-Previs source drawer.
3. Left authoritative visual-reference rail.
4. Central 25-Shot storyboard / shotlist board.
5. Shot-level selection, story evidence and motion state/actions.
6. Compact playback monitor and selected Mini-Block inspector.
7. Authority-only continuity bible with explicit unknown states.
8. Compact opening assembly and MP4 export controls.
9. Chronological Mini-Block rail.

## Deterministic safeguards

- Existing source keys and revision semantics remain unchanged.
- Existing motion confirmation and routing remain unchanged.
- Existing FFrames export paths remain unchanged.
- Existing screenplay evidence remains read-only.
- Unknown continuity values remain explicit instead of being generated.
- The governed Timeline selector remains unchanged for OpenPencil and WebMCP.

## Proof

The implementation adds a targeted #2797 source regression test and must pass the normal exact-head architecture / product verification gates before merge.
