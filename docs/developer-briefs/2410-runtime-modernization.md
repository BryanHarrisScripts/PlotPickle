# Developer Brief — #2410 Runtime Modernization

Review date: 2026-09-24

## Goal

Modernize PlotPickle's managed runtimes and companion integrations while preserving its explicit authority and reproducibility boundaries. A newer upstream release is not enough by itself: PlotPickle promotes a version only when it can retain deterministic installation, current compatibility contracts and existing qualified evidence.

## Inventory decision

### Promote

| Component | Current | Reviewed upstream | Decision |
| --- | --- | --- | --- |
| Mastra | 1.67.0 | 1.69.0 | Promote. Current PlotPickle usage does not consume the 1.68 Agent Controller stream APIs or @mastra/mcp 2.0 boundary that changed upstream. |
| Pi coding agent | 0.87.0 | 0.87.1 | Promote patch release across the managed runtime, DSDD session boundary, OSS inventory and project extension lock. |
| BUZZ Desktop fallback | 0.5.22 | 0.5.24 | Promote the reviewed Windows fallback. The existing updater still checks live stable releases first. |

### Verify and keep user-managed

| Component | Reviewed upstream | PlotPickle boundary |
| --- | --- | --- |
| ComfyUI | v0.37.0 | Connect-only. PlotPickle's Windows maintenance path uses the official package source; no ComfyUI app bundle is added. |
| Ollama | v0.34.4 | Connect-only. The existing official Windows maintenance path remains authoritative. |
| Cline | v4.1.21 | Developer tool. Setup remains user-managed/latest-resolving; it is not a PlotPickle runtime dependency. |

### Reviewed holds

| Component | Current | Reason to hold |
| --- | --- | --- |
| Node.js | 24.19.0 | Windows performance budgets and installer evidence are ratified against this exact runtime. Promotion requires a separate measured re-baseline. |
| whisper.cpp | b5130 | The reviewed Windows archive resolves source commit 927cfce34f31707e17f2bff35c349632fb9e2c3a, the same source commit as upstream v1.9.4. v1.9.4 publishes no equivalent Windows binary asset, so replacing the reviewed binary would reduce provenance/reproducibility without changing source. |
| BUZZ relay | v0.4.26 | BUZZ Desktop and relay release lanes are independent. PlotPickle's local Compose derivative remains on the last qualified relay image/config until a newer relay pin is explicitly qualified. |
| Portless | 0.15.5 | Current pin has explicit Windows acceptance evidence. A newer release requires a fresh Windows-native acceptance run. |
| Lazy Frames | 0.6.3 | No newer managed stable release was identified in this audit. |

## Promotion details

### Mastra 1.69.0

Update the direct runtime dependency and regenerate the root npm lock. Preserve existing PlotPickle-owned agent authority, provider routing, scheduling storage and trace semantics. This issue does not opt PlotPickle into new upstream features merely because they exist.

### Pi 0.87.1

Update:
- authoritative managed Pi constant;
- developer-agent stack version/install command;
- DSDD persistent-session version guard;
- current OSS registry record;
- .pi npm package/lock;
- current regression assertions.

Keep the #2338 evaluation artifact and developer brief as historical evidence that 0.87.0 was the version evaluated and promoted at that time.

### BUZZ Desktop 0.5.24

Update the reviewed fallback to:
- release: desktop-v0.5.24
- version: 0.5.24
- source commit: 3befaf16002d802a97aa79007be29b23623ceb3f
- Windows asset: Buzz_0.5.24_x64-setup_alpha-unsigned.exe
- SHA-256: 38a9be91d547c177f9d69d801b09e73b27aa600dad43f1e9abaaa8dc3ceb70c6

The installer remains visible, the asset remains explicitly unsigned, and PlotPickle does not bypass Windows trust prompts.

## Boundaries

- Do not bundle ComfyUI, Ollama or Cline.
- Do not change image/video models, checkpoints or workflows as a side effect of a host-runtime update.
- Do not rewrite historical performance, candidate-evaluation or release evidence to make old tests appear current.
- Do not infer a BUZZ relay upgrade from a BUZZ Desktop release.
- Regenerate lockfiles from package managers rather than fabricating integrity metadata.

## Verification

Focused regression must prove the inventory decisions and live pins. Normal Architecture Verification is the merge gate. A PR may merge only from the exact green head.
