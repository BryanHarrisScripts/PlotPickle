# Architecture Phase 1 — ComfyUI diagnostics kernel

Issue: #1462

Status: implementation moved and root compatibility bridge retired; the larger AI batch remains in progress.

Move boundary:
- implementation: `build/comfyui-connection-diagnostics.ts` → `build/ai/comfyui-connection-diagnostics.ts`
- `build/ai/provider-diagnostics-gateway.ts` imports the AI-owned implementation directly.
- `build/ai/comfyui-onboarding-gateway.ts` imports the AI-owned implementation directly.
- `build/ai-routing-gateway.ts` now imports the AI-owned implementation directly even though that broader routing gateway remains a separate Phase 1 move.

Compatibility retirement:
- the temporary root `export *` bridge has been removed.
- no consumer requires `build/comfyui-connection-diagnostics.ts`.
- source-contract tests read the canonical AI-owned implementation and assert the retired root path stays absent.
- this retirement does not claim the larger `phase1-build-ai` batch is complete.

Preserved behavior and security:
- ComfyUI remains restricted to HTTP loopback hosts and defaults to `http://127.0.0.1:8188`.
- management probing and launch remain shell-free and bounded by the existing time/output limits.
- Comfy MCP remains optional management only; PlotPickle retains provider choice, consent and generation-routing authority.
- missing checkpoints, image nodes and workflow nodes remain explicit setup blockers requiring Human confirmation where installation or setup is needed.
- no paid/cloud fallback is introduced and creative agents receive no arbitrary node-install, model-download, authentication or workflow-execution authority.

Structural evidence:
- the canonical implementation remains in `build/ai/`; this slice removes one root compatibility file rather than adding another source.
- `build/ai-routing-gateway.ts` remains at the root until its own bounded Phase 1 move because it has materially broader fan-out.

Acceptance before merge:
- focused #353, #374, #1083 and #1462 regressions pass.
- BEN, production build, Repository Architecture Inventory and required exact-head GitHub checks are green.
- security/review findings are resolved or explicitly non-blocking.
