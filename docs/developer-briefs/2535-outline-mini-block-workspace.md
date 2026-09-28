# Issue #2535 — Outline Mini-Block workspace

## Implementation decisions

REUSE the canonical Storyboard Mini-Block address: `storyboard-anchor:block:block-XX:mini-N`.

REUSE the foundations visual-artifact store, accepted visual IDs, Storyboard local-save marker, Storyboard reference adoption workflow, and existing project save/recovery path. No Outline-only image store is introduced.

ADAPT Outline by adding one representative Mini-Block anchor workspace. New generated anchor versions use the existing `storyboard-frame-webp-v2` artifact family at position 1 and carry the same Storyboard anchor identity. Bundled Storyboard reference candidates remain available as fallback anchor versions.

REUSE the existing Story Card and Written Story boards. Their selected-state markers are filtered inside the Outline host so only the currently selected Block/Mini-Block slice is visible. Their underlying data ownership and editing behavior are unchanged.

## Human flow

Select Act → Block → Mini-Block. The content below the navigator becomes one vertical slice: shared visual anchor, selected Story Card material, selected Written Story material. Changing the Mini-Block changes the whole slice.

The anchor workspace exposes version chevrons, N/X, Generate/Create new version, Save, Lock, Delete, Saved locally and Locked state. The full 25-position Storyboard sequence stays in Storyboard.

## Regression boundary

The Act/Block/Mini-Block navigator, canonical status colours, Story Card authority, Written Story authority, Storyboard visual authority, local-first persistence, Story Architect evidence and turning-point behavior remain existing systems rather than being reimplemented for this issue.
