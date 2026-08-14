# PR-ready change request: current logo, lore Settings, Sage + PLAN local AI

## Problem

The LEARN/PLAN header is visually presenting the previous PlotPickle icon instead of the current V2 ouroboros/nib identity. The standalone Settings control does not read like the other fantasy relic navigation, and same-page query navigation can leave `/?workspace=settings` visible in the URL without switching the LEARN-first composition root. The existing local-AI Settings form configures Sage's Fast role but not PLAN's Quality role, so PLAN can remain blocked even after Sage is configured.

## Required implementation

1. Use `/brand/plotpickle-ouroboros-v2.png` as the visible LEARN and PLAN header identity. Do not use `plotpickle-icon-master-transparent.png` as the header replacement. The header remains matte black/transparent and the glow follows the logo rather than drawing a square tile.
2. Add `/public/assets/workflow-relics/settings.svg` as a transparent gold/teal fantasy relic consistent with the navigation family. The Settings control uses this SVG in the open top-right slot.
3. The standalone Settings control must perform a reliable navigation to `/?workspace=settings`. Use a hard anchor boundary rather than depending on a same-page Next Link/query-state update.
4. `/?workspace=settings` must expose the minimum local-AI configuration required by both story workflows:
   - runtime selection/status via the existing hardware-aware runtime panel;
   - Sage Fast model-name override;
   - PLAN Quality model-name override;
   - managed llama.cpp executable;
   - Fast GGUF path and GPU-layer split;
   - Quality GGUF path and GPU-layer split;
   - Save local AI setup;
   - Load/test Sage Fast;
   - Load/test PLAN Quality;
   - Refresh readiness.
5. Managed llama.cpp must support role preparation before preflight. `POST /api/local-ai/runtime/model/fast/load` prepares Sage's Fast role and `POST /api/local-ai/runtime/model/quality/load` prepares PLAN's Quality role. External compatible runtimes remain unchanged and are simply re-probed.
6. Sage must prepare Fast before checking writing-assistant readiness. PLAN must prepare Quality before checking writing-assistant readiness. No cloud fallback is introduced.
7. Settings must provide explicit Return to LEARN and Return to PLAN controls.

## Exact writer-facing copy

Settings heading: `Make Sage and PLAN ready.`

Role heading: `Sage + PLAN model setup`

Fast control: `Sage Fast model name override`

Quality control: `PLAN Quality model name override`

Managed runtime control: `Let PlotPickle manage llama.cpp role switching`

Readiness actions: `Load/test Sage Fast` and `Load/test PLAN Quality`

Standalone navigation label: `Settings`, changing to `Setup AI` when a visible local Fast/Quality/runtime error is present.

## Acceptance criteria

- No LEARN/PLAN header CSS references `plotpickle-icon-master-transparent.png`.
- Header presentation references `plotpickle-ouroboros-v2.png` and retains drop-shadow glow.
- Settings relic is a transparent local SVG with no solid black background rectangle.
- Settings control is in the top-right and is a real anchor to `/?workspace=settings`.
- The Settings workspace can configure both Fast and Quality roles without deleting Deep-role settings.
- Managed llama.cpp can be prepared for Fast or Quality through role-load endpoints.
- Sage calls the Fast-role preparation endpoint before writing-assistant status.
- PLAN calls the Quality-role preparation endpoint before writing-assistant status.
- Sage continues to route `provider: "local"`, `modelRole: "fast"`.
- PLAN continues to route `provider: "local"`, `modelRole: "quality"`.
- No automatic OpenAI/MiniMax/cloud fallback is added.
- Focused source-contract tests, LEARN Validation, Hardware-Aware Local AI checks, and production builds pass on the same PR head before merge.
