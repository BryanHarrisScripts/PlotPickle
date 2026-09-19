# Issue #2226 — Skin V1 Surface Orchestrator

The Skin V1 JSON stack is now wired into the real application runtime.

## Runtime authority

The orchestrator consumes:

1. `app/skin-v1-definition.css` — tokens;
2. `config/skin-v1-surface-composition-reference.json` — component/composition rules;
3. `config/skin-v1-surface-anatomy-contract.json` — region meaning and placement;
4. `config/skin-v1-surface-declarations/standard-surfaces.json` plus explicit surface overrides — per-surface declarations;
5. `config/skin-v1-surface-registry.json` — canonical identity, parentage and layout/shell/frame profiles.

All 30 standard WebMCP surfaces now carry canonical runtime selectors and are marked `orchestrated: true`.

## Visible runtime wrapper

The live application renders one common environment around the active surface:

- PLOTPICKLE | CURRENT SURFACE | SKIN V1 global header;
- upper-right Return action beneath the header;
- 1180px governed active shell;
- 2px strong outer frame + 1px inset frame;
- square matte Skin V1 controls and selected states;
- title hierarchy normalized to the Skin V1 type scale;
- footer/status/context strip.

Existing feature owners still own their content and behavior. The orchestrator does not copy Library, Storyboard, Previs, Write, Scene Workspace or Settings into a second store.

## Representative evidence

WebMCP prepares the deterministic local Afterglow v9 working copy before catalogue capture. This lets Story Map / Storyboard / Visual Story / Scene Workspace / Previs render against one real project rather than whichever empty project happened to be active.

Scene Workspace retains its explicit anatomy override: Script Preview + Playback + Inspector, with a nested Dialogue / Action / Shot / Audio timeline.

## WebMCP fence

WebMCP now requires the live captured surface root to expose:

- `data-skin-v1-orchestrated="true"`;
- `data-skin-v1-orchestrator-active="true"`;
- the expected `data-skin-v1-surface-id`.

Candidate PNGs are captured from the complete orchestrator frame rather than the legacy surface root, so Human review sees the same environment the application renders.
