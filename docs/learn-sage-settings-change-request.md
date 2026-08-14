# LEARN logo, Settings rune, and Sage readiness

## Objective

Make the LEARN header visually correct and turn Sage's missing-local-model state into a recoverable user flow without weakening PlotPickle's local-first or reviewed-model safety boundaries.

## Required changes

### 1. PlotPickle header mark

- Do not redraw or regenerate the approved PlotPickle artwork.
- Stop presenting the square-background favicon derivative in the LEARN header.
- Render `public/brand/plotpickle-icon-master-transparent.png` in the top-left header slot.
- Keep the image background transparent.
- Apply glow with CSS `drop-shadow` so the glow follows the visible logo pixels rather than a square box.
- Keep the original image element available to assistive technology while visually replacing its presentation with the approved transparent asset.

### 2. Settings navigation rune

- Use the open top-right header slot.
- Render an original fantasy/lore settings rune using the same gold/teal visual language as the LEARN navigation relics and lesson wayfinder glyphs.
- Exact normal visible label: `Settings`
- Exact blocked-Sage visible label: `Setup Sage`
- Exact destination: `/?workspace=settings`
- Keep keyboard focus styling and an accessible Agent & Settings label.

### 3. Real Settings destination

`/?workspace=settings` must render a first-class Sage local-AI settings workspace rather than falling back to LEARN.

Exact heading: `Make Sage ready to answer.`

Exact intro copy:

`Sage uses PlotPickle's Fast local model. Choose a local runtime below, make the Fast model available, then return to LEARN and ask your question again.`

The workspace must expose:

- Return to LEARN.
- Advanced AI routing.
- Hardware-aware runtime status.
- Preferred local runtime selection.
- Fast-role readiness.
- Fast model-name override for LM Studio, Ollama, or another OpenAI-compatible server.
- Managed llama.cpp enable/disable.
- llama.cpp server executable path/name.
- Fast GGUF model path.
- Fast GPU-layer setting.
- Save and refresh controls.
- Existing reviewed missing-runtime/model installation plan.

PlotPickle must not silently download an arbitrary or unreviewed model.

### 4. Sage blocked-state behavior

If Sage reports that a local runtime/model is unavailable, the persistent Settings rune must remain visible and change its visible label to `Setup Sage`.

The user flow is:

1. Ask Sage a question.
2. If the Fast local role is unavailable, the current Sage error remains visible and the top-right rune changes to `Setup Sage`.
3. Open Settings.
4. Choose/configure the local runtime and Fast model.
5. Save Sage setup.
6. Confirm the active runtime is ready and the Fast role is installed.
7. Return to LEARN.
8. Ask Sage again; the existing Curriculum Guide request continues through the Fast local role.

## Acceptance criteria

- No visible solid 1:1 background remains behind the PlotPickle header logo.
- The visible header logo uses the approved transparent icon-only asset.
- Glow follows the logo using `drop-shadow` rather than a rectangular background/glow.
- A lore-style Settings rune is visible in the top-right of standalone LEARN/PLAN workspaces.
- The Settings rune is keyboard accessible and opens `/?workspace=settings`.
- `/?workspace=settings` renders Sage local-AI setup rather than LEARN.
- Settings exposes both compatible-server Fast model override and managed llama.cpp Fast GGUF configuration.
- Enabling managed llama.cpp preserves existing Quality/Deep model paths and GPU-layer settings.
- When a Sage local-model/runtime error is present, the Settings rune changes to `Setup Sage`.
- Sage continues to use `provider: "local"` and `modelRole: "fast"`; this change does not add a cloud fallback.
- The user can return directly from Settings to LEARN.
- Existing LEARN curriculum, lesson content, completion state, PLAN handoff, and Creative Room retrieval are unchanged.
- Source contract tests pass.
- LEARN validation passes.
- Hardware-aware local-AI tests pass.
- Production build passes.
