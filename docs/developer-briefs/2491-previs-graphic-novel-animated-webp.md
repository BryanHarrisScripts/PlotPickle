# #2491 — Previs Graphic Novel Animated WebP export

## Goal

Replace the current Human-facing Previs Graphic Novel HTML export with one local Animated WebP export.

#2488 duplicated this requirement and is closed in favour of #2491.

## Locked product behaviour

- Keep Play / Pause Graphic Novel.
- Expose one export action: `Export Animated WebP`.
- Remove the Human-facing HTML export path and do not add an export-format picker.
- Export only Keep / Locked Storyboard frames for the selected Previs Mini-Block.
- Omit unlocked, rejected and missing positions rather than creating placeholder animation frames.
- Preserve Storyboard position order.
- Use the existing `PREVIS_GRAPHIC_NOVEL_INTERVAL_MS` value (3000 ms) as the per-frame delay.
- Loop continuously.
- Use the existing derived Graphic Novel caption, narration and Shot presentation fields.
- Render those story-facing fields into the exported image itself.
- Do not generate new prose and do not call a provider.
- Do not change PPF canon, Storyboard approval, Timeline timing, Rough Cut timing or Render Plan timing.

## Local media boundary

The export is local-only and server-side.

- Use the existing Sharp runtime; do not add a second encoder.
- Accept at most 25 panels.
- Accept only PlotPickle local image asset URLs under `/api/local-ai/assets/`.
- Reject traversal, encoded/alternate path tricks, external URLs, unsupported file types, empty files, excessive source bytes and excessive source dimensions.
- Normalize each accepted source to one bounded 1280×720 canvas before animation assembly.
- Render a restrained Graphic Novel caption plate into each frame.
- Return `image/webp` bytes with an attachment filename ending in `.webp`.
- Return no-store/no-referrer/nosniff headers.

## Authentication

The POST export route must use the existing authenticated Human profile request boundary. The client must call it through `authenticatedProfileFetch`.

## Canon / authority boundary

The client sends only panels already derived from Keep / Locked Storyboard artifacts. The server accepts only entries explicitly marked authoritative and never mutates project state. Export is presentation-only output.

## Compatibility

Update #2471 coverage to reflect the superseding export requirement while preserving its playback, 25-position authority and no-canon-mutation assertions.

## Verification

Focused #2491 coverage must prove:

- UI says `Export Animated WebP`;
- no Human-facing HTML export remains;
- no format picker exists;
- the authenticated local POST route is used;
- only locked panels enter the request;
- safe local assets are enforced;
- Sharp produces valid WebP output;
- 2+ inputs produce 2+ WebP pages;
- delay is 3000 ms and loop is continuous;
- one frame is still a valid WebP;
- empty input fails cleanly;
- traversal/external/unsupported inputs fail;
- caption/narration is composited into prepared frames;
- no provider call or story/canon mutation is introduced.

Exact-head Architecture Verification remains the merge gate.
