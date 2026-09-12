# Developer Brief — #1923 Profile Control-Height Conformance

## Purpose
Repair the live WebMCP Layer 1 / Experience Skins finding on the direct User Profile surface without weakening UI-conformance verification.

## Evidence
The rendered Profile actions `Configure BUZZ Identity`, `Configure Community BBS`, `Configure Local Model`, `Configure ComfyUI`, and `Configure Cloud Compute` measure 25.25px high while the canonical Skin V1 token `--pp-skin-control-height` is 34px.

## Root cause
`app/skin-v1-bbs-surfaces.css` adapts the existing Profile Identity v2 controls to Skin V1, but the shared interactive-control selector did not consume the canonical minimum-height token. Other Skin V1 surfaces already do.

## Repair
- apply `min-height: var(--pp-skin-control-height) !important` to Profile v2 interactive controls;
- preserve the 34px token and live WebMCP threshold;
- add a focused regression and run it beside #1915/#1920 Profile navigation/readiness tests;
- do not change Profile auth/session behavior or the underlying configuration actions.

## Architecture evidence for #1922
Primary owner: `Layer 1 Experience Skins`.

Trigger vocabulary: `skin`, `surface`, `visual`, `design-token`, `webmcp`, `profile`.

Correct evidence type: live rendered WebMCP conformance. Static contract coverage is useful but is not a substitute for the rendered observer for this failure class.

## Exit
Focused tests, existing Profile regressions, PR Gate and Product Gate are green on the exact head, and a local live WebMCP rerun reports no Profile control-height findings.
