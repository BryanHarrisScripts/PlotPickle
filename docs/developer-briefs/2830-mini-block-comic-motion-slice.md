# #2830 Mini-Block comic-to-motion vertical slice

## Objective

Use Afterglow Mini-Block 1.1 as the canonical end-to-end acceptance slice for the path from visual authority to Graphic Novel presentation and motion. The parent outcome remains #2821.

This first delivery fixes Phase A: the Outline visual anchor must obey the same supported-media contract already repaired for Storyboard, and Lock must be a visible, reversible Human decision rather than a status sentence beside an unchanged Lock button.

## Confirmed defect

The current Mini-Block Outline workspace still narrowed explicit Save to `/api/local-ai/assets/`. Packaged Afterglow Storyboard media therefore remained renderable and lockable but could not use the same explicit Save metadata contract. The workspace also exposed only a one-way Lock action. Once accepted, the button stayed labelled Lock and simply disabled itself.

That creates contradictory product truth: the status message can say the Mini-Block is locked while the visual control still reads Lock.

## Phase A repair

- reuse `isSupportedVisualAssetUrl()` for explicit Save so generated-local and packaged-example media follow the canonical project-media contract;
- Save changes project metadata only and never copies or mutates packaged repository bytes;
- change the Mini-Block action to a true Lock/Unlock toggle using the existing foundations accept/unaccept commands;
- Unlock preserves the saved marker and media identity;
- put an explicit `LOCKED` treatment on the image frame, add a locked frame treatment, and expose `aria-pressed` on the control;
- keep Storyboard as the downstream reader of the same foundations visual authority.

## Regression proof

`tests/issue-2830-outline-lock-visual-state.test.mjs` reads the committed Afterglow package and snapshot, selects a real packaged Storyboard image, and executes the actual Outline Save/Lock/Unlock handlers extracted from the production component.

The regression proves that:
- packaged Afterglow media can receive explicit Save metadata;
- Save does not duplicate the image;
- Lock accepts the same artifact;
- Unlock reverses acceptance without removing Save metadata or changing the media URL;
- the production UI contains image-level locked state plus a Lock/Unlock control state.

This intentionally avoids a generated-local-only fixture because that test shape previously hid the real Afterglow failure.

## Remaining #2830 phases

Phase B verifies Storyboard and approved Graphic Novel text continuity. Phase C proves real three-second Shot motion against verified configured routes. Phase D makes Previs Graphic Novel playback prefer persisted motion while retaining a truthful still fallback. Phase E is unload/reopen durability.

CI performs no paid provider inference. Actual provider delivery and final reopen remain Human acceptance under #2821.


## Phases B-D — approved text and persisted motion converge in Previs

The next delivery closes the product gap visible after Phase A: Timeline can persist successful Shot motion, and Previs can already overlay approved Graphic Novel bubbles, but Previs previously rendered the locked still unconditionally. Motion and comics therefore existed as separate features.

The repair keeps one authority chain:

- the accepted Storyboard artifact remains the Shot visual identity;
- current Graphic Novel text still requires an approval whose source key matches the locked image and current story evidence;
- successful Timeline motion is eligible in Graphic Novel playback only when its `anchorRef`, Shot position, and `sourceArtifactId` match that exact locked Storyboard artifact;
- replacing the locked Storyboard image automatically makes earlier motion ineligible for Previs Graphic Novel playback;
- when current motion exists, Graphic Novel mode renders that video while the existing approved speech bubbles and narration/caption layer remain on top;
- when current motion does not exist, Previs truthfully falls back to the locked still;
- the existing 3000ms Graphic Novel cadence remains the presentation authority, so a provider clip may retain its observed source duration while the comic presentation advances after three seconds;
- plain Flip Book remains still-image playback;
- the Human-facing control is named `Play Graphic Novel` / `Pause Graphic Novel`, matching the product intent.

Narration generation now writes through `saveFoundationProjectDurably()` with revision checking instead of reporting success after only the synchronous browser-cache write. This makes generated/approved Graphic Novel presentation data follow the same encrypted persistence acknowledgement used by repaired Storyboard decisions.

### Regression boundary

`tests/issue-2830-previs-graphic-novel-motion.test.mjs` uses a real packaged Afterglow Storyboard artifact identity, normalizes persisted motion records, and proves that Previs selects the newest successful motion only for the exact locked artifact. A motion clip tied to a replaced image is rejected. The test also protects the three-second cadence, video rendering, bubble/narration overlays, still fallback, and durable narration save.

No provider job is submitted by this engineering proof. Phase E remains the real Afterglow unload/reopen and configured-provider acceptance under #2821/#2830.
