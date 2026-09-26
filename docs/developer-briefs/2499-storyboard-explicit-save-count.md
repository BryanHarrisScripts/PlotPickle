# Developer Brief — #2499 Storyboard Explicit Local Save + Per-Position Image Count

## Human request

Storyboard should use the same visible Save / Lock language as the World Map movie poster. For every one of the 25 Shot / Frame positions, the Human must be able to see that the displayed generated image has been explicitly saved locally, independently of whether that image is locked as the authoritative Storyboard choice.

The image browser must also display a clear `N/X` count for each position.

## Current behaviour

Storyboard image generation already writes image bytes to PlotPickle local assets and stores the generated draft artifact into the active Library project for recovery. That means generated images normally survive restart even before Keep / Lock.

The missing contract is Human-visible confirmation. There is no durable flag that says “I explicitly saved this version,” and the current controls combine authority into **Keep / Lock**. The image chevrons also give no indication of how many alternatives exist at a position.

## Required behaviour

### Explicit Save

- Add **Save this Version** for the displayed generated Storyboard artifact.
- Save reuses the existing `foundations.visual.store` command and `saveFoundationProject`; no parallel store.
- Add stable source-decision marker `storyboard-local-save:v1` to the same artifact.
- Re-store the same artifact ID; do not create a duplicate version.
- After save, button reads **Saved locally** and is disabled.
- The marker survives project reload and therefore restores the visible saved state.
- Existing Storyboard artifacts without the marker remain valid and simply show Save this Version until explicitly confirmed.
- Only saved PlotPickle local assets can receive the explicit save marker.

### Lock remains separate

- Rename **Keep / Lock** to **Lock this Version**.
- Keep current single-lock authority: locking one version unaccepts the previously locked version at that same position.
- Save does not lock.
- Lock does not automatically add the save marker.
- A previously locked legacy image without the marker can still be explicitly saved afterward.
- Redo, Reject, prompt provenance, provider routing and Previs authority remain unchanged.

### Image count

- Every one of the 25 position cards displays `N/X`.
- `X` is the count of non-rejected images currently browsable at that position after de-duplication.
- `N` is the current displayed image's 1-based index.
- Empty positions display `0/0`.
- The count updates with the same selection state used by the existing left/right chevrons.
- Chevrons remain bounded and do not wrap.

## Verification

Focused regression must prove:
- stable local-save marker;
- Save re-stores the same artifact through canonical project persistence;
- saved state derives from durable artifact metadata;
- Lock remains independent and single-select;
- visible Save this Version / Saved locally / Lock this Version labels;
- 25 position loop renders N/X and 0/0;
- existing chevrons and prompt provenance remain intact;
- exact-head Architecture Verification green before merge.

## Delivery

Build → test → fix → PR → exact-head CI → merge when green.
