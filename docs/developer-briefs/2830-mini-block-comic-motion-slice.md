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
