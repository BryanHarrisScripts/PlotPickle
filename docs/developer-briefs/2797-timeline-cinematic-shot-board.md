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


## Phase 2 — authoritative continuity and production evidence

Phase 2 replaces the first-pass continuity placeholders where PlotPickle already has authoritative data.

- Timeline now reads the full Library PPF at the presentation boundary while keeping Timeline mutations on the existing base PPF production authority.
- Character identities are resolved from Storyboard artifact provenance first, with scene-backed Character Truth arc evidence as a bounded fallback.
- Locked character images come only from approved World Map visual packages.
- Camera details are shown only when a Production Shot is tied to the exact locked Storyboard artifact for that Timeline slot.
- Sound intentions are shown only from non-rejected production sound cues on the same anchor or exact linked Production Shot.
- Blocking, pacing, performance and transitions remain Human-authored Previs evidence and are surfaced without synthesis.
- Wardrobe, props, location, time/weather, lighting and palette remain explicitly unresolved where no structured canonical source exists.

This phase deliberately does not parse image prompts into fake structured continuity facts and does not infer camera settings from the cinematic reference screenshot.


## Phase 3 — compact production actions

The opening-range assembly is no longer a separate dominant full-width panel.

- Opening assembly now lives in the right production rail beside playback, inspection and provider state.
- Range selection still supports one through four consecutive complete Mini-Blocks.
- The compact range summary preserves coverage, source revision and stale/current state.
- Opening-range MP4 export, narration mode, saved export link and provenance summary remain intact.
- Selected Mini-Block export remains in the selected Mini-Block inspector.
- The obsolete full-width export panel and its duplicate layout CSS are removed.

This phase changes information hierarchy only; it does not change FFrames rendering, source freshness checks, narration validation, Timeline assembly storage or export persistence.
