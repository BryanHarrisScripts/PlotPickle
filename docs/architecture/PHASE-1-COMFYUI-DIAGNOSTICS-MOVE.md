# Architecture Phase 1 — ComfyUI diagnostics kernel

Issue: #1462

Status: candidate; the larger AI batch remains in progress.

Move boundary:
- implementation: `build/comfyui-connection-diagnostics.ts` → `build/ai/comfyui-connection-diagnostics.ts`
- `build/ai/provider-diagnostics-gateway.ts` now imports the AI-owned implementation directly.
- `build/ai/comfyui-onboarding-gateway.ts` now imports the AI-owned implementation directly.

Temporary compatibility boundary:
- `build/ai-routing-gateway.ts` remains a ratified Phase 1 AI source but is not moved in this slice because its broader dependency set should move as its own bounded batch.
- the old diagnostics path is therefore a thin `export *` bridge only for that root composition consumer.
- the bridge contains no implementation and is explicitly owned by #1462 for removal when `build/ai-routing-gateway.ts` moves.
- source-contract tests read the canonical AI-owned implementation rather than the bridge.

Preserved behavior and security:
- ComfyUI remains restricted to HTTP loopback hosts and defaults to `http://127.0.0.1:8188`.
- management probing and launch remain shell-free and bounded by the existing time/output limits.
- Comfy MCP remains optional management only; PlotPickle retains provider choice, consent and generation-routing authority.
- missing checkpoints, image nodes and workflow nodes remain explicit setup blockers requiring Human confirmation where installation or setup is needed.
- no paid/cloud fallback is introduced and creative agents receive no arbitrary node-install, model-download, authentication or workflow-execution authority.

Structural evidence:
- the implementation adds one direct source to `build/ai`, keeping that target within the ratified maximum of 16 direct source files.
- the root bridge does not claim the larger `phase1-build-ai` batch is complete.

Acceptance before merge:
- focused #353, #374, #1083 and #1462 regressions pass.
- Developer Workbench review is clean or findings are resolved/non-blocking.
- BEN, production build, Repository Architecture Inventory and required exact-head GitHub checks are green.
- security/review findings are resolved or explicitly non-blocking.
