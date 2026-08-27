# #1462 — Provider diagnostics AI move

Status: candidate; `phase1-build-ai` remains in progress.

Move boundary:
- `build/provider-diagnostics-gateway.ts` → `build/ai/provider-diagnostics-gateway.ts`

Runtime consumer updated:
- `build/local-ai-gateway.ts` now imports the canonical AI-owned diagnostics gateway.

Source-contract consumers updated:
- `tests/issue-353-ai-routing-diagnostics.test.mjs`
- `tests/issue-374-comfyui-connection-recovery.test.mjs`
- `tests/issue-1083-comfy-mcp-management-adapter.test.mjs`
- `tests/issue-1462-provider-diagnostics-move.test.mjs`

Behavior boundary:
- `/api/provider-diagnostics/comfyui` remains unchanged.
- Requests remain loopback/same-origin restricted.
- Diagnostic request bodies retain the 64 KB bound.
- The configured local ComfyUI endpoint remains normalized through the reviewed loopback-only helper.
- Endpoint changes continue to clear stale checkpoint and image-verification state before probing.
- Missing checkpoints continue to clear stale selection and verification state.
- Diagnostic results continue to persist through the canonical media-routing store.
- No compatibility shim remains at the retired root path.
