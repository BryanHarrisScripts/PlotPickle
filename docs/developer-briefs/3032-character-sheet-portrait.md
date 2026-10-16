# #3032 — Character Sheet and square Portrait, independent deliverables

Human intent: Brotherly Love and Afterglow should be able to generate a character sheet (a **single composite** board with angles, expressions, poses, wardrobe, props) and a true **1:1 portrait** for a selected canonical character. Continue existing source-grounded eight independent World Map views without inflating their completeness from a sheet.

## Authority and ownership
- ASSETS → Characters → new separate deliverable studio. Canonical names and allowed description come from actual saved Character Truth, not generated guesswork.
- Configured image provider only; cloud needs explicit paid consent; saved approved references accompany generation.
- Shared `lib/projects/persistence/project-assets.ts` variation/approval registry is bridged into normalized profile-owned Library PPF as additive `assetRegistry` field, defaulting to empty for all legacy PPFs. No worldMap lock conversion or automatic import as one of eight view slots. Generated file bytes remain in authenticated local media storage; backup portability remains a separate #3019 gate.
- Every candidate's accessible media bytes and SHA-256 hash verified before Save, and checked again before approval; the portrait additionally requires actual square dimensions. Media variation provenance records provider, model, prompt and explicit human approval/Unlock.
- Local/cloud gateway supports literal `square` -> `1024x1024` and MiniMax `1:1`, not a CSS-cropped rectangular image.

## Tests & limits
- Check dual output modes, actual aspect gateway, readback/PPF registry normalization, approval boundaries, no automatic World Map 8-view lock, preserved legacy Posters and existing Character.
- WHITE-PAPER-V3 W8/W9 truth-bound static regressions; CI green and independent review required. No synthetic run proves user's real Brotherly Love art quality or portable media bytes.
- Follow-ups #3033 (provider picker) and #3035 (unified UI polish) after this PR.

## Merge path
build → test → fix → PR → current-head CI green → squash merge; parent #3019 remains open.