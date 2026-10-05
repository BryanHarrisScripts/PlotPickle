# 2763 Phase 1 — Previs playback and automatic written narration

Issue #2763 defines the four-phase path. This PR implements Phase 1 only. Timeline MP4 assembly and motion generation follow in later phases. MiniMax H3 runtime and diagnostics remain in #2764.

Previs plays the Storyboard images locked for the selected Mini-Block, in Shot order, with either a plain Flip Book or written narration. It does not show unlocked candidates during playback. The Create WebP and Review Text controls are removed. Manual speech-bubble entry is no longer required.

On narrated playback, the browser assembles the actual locked images into a bounded labelled contact sheet. The Graphic Novel Mastra agent receives that sheet, the mapped screenplay passages, each image's recorded story intention, and the Act/Block/Mini-Block title and dramatic responsibility. The screenplay governs events and speakers. The agent returns one ordered adaptation with selective dialogue and silent panels. Its output is validated before saving as presentation data; it never changes screenplay canon or Storyboard locks.

The model must support image input. A missing image, unsupported model, or incomplete sequence produces an actionable error instead of invented completed narration. Source changes invalidate saved text, and a project change while generation is in progress prevents a stale save. Product acceptance still requires a running-app pass with the user's selected provider and a representative 25-image story; code and fixtures alone cannot prove visual interpretation or narrative quality.

Verification: focused #2763 and superseded Previs contracts, architecture ownership and Layer 1, focused UAT contracts, production build, running-app playback in both modes, and exact-head GitHub gates.
