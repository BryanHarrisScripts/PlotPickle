# Architecture Phase 1 move log

## #1462 — Projects batch

Status: **completed and merged**

Move boundary:
- `build/afterglow-project-gateway.ts` → `build/projects/afterglow-project-gateway.ts`
- `build/portable-ppf-reader.ts` → `build/projects/portable-ppf-reader.ts`

Runtime/import consumers updated:
- `vite.config.ts`
- `build/foundations-ppf-gateway.ts`
- `build/library-ppf-import-gateway.ts`
- `build/story-decisions/gateway.ts`

Source-contract / CI path consumers updated:
- `tests/issue-190-afterglow-persistence.test.mjs`
- `tests/issue-688-plan-ai-autofill-guidance.test.mjs`
- `.github/workflows/build-story-model.yml`

Behavior boundary:
- `/api/local-afterglow` remains unchanged and loopback/read-only.
- Local `.ppf` request validation, 48 MB bound, parsing and integrity behavior remain unchanged.
- No re-export/compatibility shim remains at the old paths.
- The Phase 0 inventory records the batch as completed and verifies both retired sources and new destinations.

## #1462 — BUZZ support slice

Status: **completed and merged**

Move boundary:
- `build/buzz-agent-identity-binding-loader.ts` → `build/buzz/buzz-agent-identity-binding-loader.ts`
- `build/buzz-bundle-normalizer.ts` → `build/buzz/buzz-bundle-normalizer.ts`
- `build/buzz-profile-migration-gateway.ts` → `build/buzz/buzz-profile-migration-gateway.ts`

Runtime/import consumers updated:
- `vite.config.ts`
- `app/api/buzz-agent-public-identities/route.ts`

Source-contract / CI path consumers updated:
- `.github/workflows/story-bridge.yml`
- `tests/issue-1422-buzz-agent-identity-binding.test.mjs`
- `tests/issue-216-buzz-integration-fix.test.mjs`
- `tests/issue-1144-buzz-profile-migration-contract.test.mjs`
- `tests/issue-1462-build-domain-consolidation.test.mjs`

Behavior boundary:
- BUZZ public Agent identity validation and machine-local binding behavior are unchanged.
- BUZZ trust-bundle canonicalization remains in-memory and read-only.
- Legacy Human-profile BUZZ migration remains AuthContext-scoped and profile-private.
- No compatibility shim remains at the retired root paths.

## #1462 — BUZZ advisory slice

Status: **completed and merged**

Move boundary:
- `build/buzz-agent-activity-mirror.ts` → `build/buzz/buzz-agent-activity-mirror.ts`
- `build/buzz-specialist-gateway.ts` → `build/buzz/buzz-specialist-gateway.ts`

Runtime/import consumers updated:
- `build/local-ai-gateway.ts`
- `vite.config.ts`

Source-contract / CI path consumers updated:
- `.github/workflows/buzz-guildhall.yml`
- `tests/live-buzz-guildhall-activity.test.mjs`
- `tests/issue-1283-community-real-machine-cleanup.test.mjs`
- `tests/issue-971-buzz-specialist-agents.test.mjs`
- `tests/issue-1462-build-domain-consolidation.test.mjs`

Behavior boundary:
- Agent activity remains local unless an Agent-owned signer exists; the connected Human signer is never used as a fallback.
- Specialist BUZZ messages remain advisory, project-context sharing remains explicit, and the bridge reports `ppfChanged: false`.
- No compatibility shim remains at the retired root paths.
- The larger `phase1-build-buzz` batch intentionally remains incomplete until every ratified direct `build/buzz-*` source is moved and exact-head green.

## #1462 — DeepSeek AI slice

Status: **completed and merged**

Move boundary:
- `build/deepseek-harness-runtime.ts` → `build/ai/deepseek-harness-runtime.ts`
- `build/deepseek-harness-gateway.ts` → `build/ai/deepseek-harness-gateway.ts`

Runtime/import consumers updated:
- `build/local-ai-gateway.ts`

Source-contract / CI path consumers updated:
- `tests/issue-624-deepseek-harness-runtime.test.mjs`
- `tests/issue-1462-build-domain-consolidation.test.mjs`

Behavior boundary:
- DeepSeek Harness remains an optional local adapter and is never auto-installed or auto-launched during normal startup.
- Status remains a local GET and launch remains an explicit local POST through the existing gateway boundary.
- No compatibility shim remains at either retired root path.
- The larger `phase1-build-ai` batch intentionally remains incomplete until every ratified direct AI source is moved and exact-head green.

## #1462 — LTX local-video pair

Status: **completed and merged**

Move boundary:
- `build/comfyui-ltx-local-gateway.ts` → `build/ai/comfyui-ltx-local-gateway.ts`
- `build/comfyui-ltx-local-provider.ts` → `build/ai/comfyui-ltx-local-provider.ts`

Runtime/import consumers updated:
- `build/local-ai-gateway.ts`
- the AI-owned gateway now imports the AI-owned provider directly.
- the moved provider reaches root-owned credential and media helpers through explicit parent imports.

Source-contract / CI path consumers updated:
- `tests/hardware-aware-local-ai-runtime.test.mjs`
- `tests/issue-1462-build-domain-consolidation.test.mjs`

Behavior boundary:
- The LTX route remains local-only and same-origin guarded.
- LTX remains the default local video path only while `videoRoute === "none"`.
- GPU media leasing, the 30-minute local render window, body bounds and validated `ltx-*` job IDs remain unchanged.
- Provider validation still rejects unsafe network/installer/code-execution nodes, restricts ComfyUI to `http://127.0.0.1:8188`, and keeps private directory/file modes.
- No compatibility shim remains at either retired LTX root path.
- The larger `phase1-build-ai` batch intentionally remains incomplete until every remaining ratified direct AI source is moved and exact-head green.

## #1462 — Ollama starter bootstrap slice

Status: **completed and merged**

Move boundary:
- `build/ollama-bootstrap-gateway.ts` → `build/ai/ollama-bootstrap-gateway.ts`

Runtime/import consumers updated:
- `build/local-ai-gateway.ts`
- the moved gateway reaches the reviewed starter-model configuration through `../../config/ollama-starter-model.json`.

Source-contract / CI path consumers updated:
- `tests/issue-358-companion-inventory-ollama-bootstrap.test.mjs`
- `tests/issue-1462-ollama-bootstrap-move.test.mjs`

Behavior boundary:
- The starter-model action remains available only through `/api/ollama-bootstrap/starter-model` and requires a local same-origin POST.
- Ollama remains fixed to loopback `http://127.0.0.1:11434`; callers cannot supply an arbitrary model or endpoint.
- The reviewed starter model remains configuration-owned, pulls remain non-streaming with the existing 15-minute timeout, and failure does not remove No AI mode.
- No compatibility shim remains at the retired root gateway path.
- The larger `phase1-build-ai` batch intentionally remains incomplete until every remaining ratified direct AI source is moved and exact-head green.

## #1462 — SDXL local-image pair

Status: **completed and merged**

Move boundary:
- `build/comfyui-sdxl-local-gateway.ts` → `build/ai/comfyui-sdxl-local-gateway.ts`
- `build/comfyui-sdxl-local-provider.ts` → `build/ai/comfyui-sdxl-local-provider.ts`

Runtime/import consumers updated:
- `build/local-ai-gateway.ts`
- the AI-owned gateway imports the AI-owned provider directly and reaches shared ComfyUI/media helpers through explicit parent imports.
- the moved provider reaches the shared media/continuity helper through an explicit parent import.

Source-contract / CI path consumers updated:
- `tests/hardware-aware-local-ai-runtime.test.mjs`
- `tests/issue-1462-sdxl-local-move.test.mjs`

Behavior boundary:
- Local image generation remains restricted to loopback/same-origin POST requests and the existing 256 KB request bound.
- SDXL remains active only when `imageRoute === "comfyui"`; checkpoint discovery and the SD3.5 advanced-override boundary are unchanged.
- The test image remains a single low-quality request, and the local profile remains `SDXL 1.0`.
- Provider access remains restricted to local ComfyUI on `http://127.0.0.1:8188` with the existing four-minute render timeout.
- Provider-independent visual continuity, approved reference upload, VAE reference conditioning and saved PNG output remain unchanged.
- No compatibility shim remains at either retired SDXL root path.
- The larger `phase1-build-ai` batch intentionally remains incomplete until every remaining ratified direct AI source is moved and exact-head green.

## #1462 — Local AI readiness and installation slice

Status: **completed and merged**

Move boundary:
- `build/local-ai-installation-status.ts` → `build/ai/local-ai-installation-status.ts`
- `build/local-ai-installation-gateway.ts` → `build/ai/local-ai-installation-gateway.ts`
- `build/local-ai-readiness.ts` → `build/ai/local-ai-readiness.ts`

Runtime/import consumers updated:
- `build/local-ai-gateway.ts` imports the canonical installation gateway from the AI domain.
- `build/local-runtime-gateway.ts` imports the canonical readiness service from the AI domain.
- the AI-owned readiness service imports the AI-owned installation detector directly and reaches shared root-owned runtime/credential helpers through explicit parent imports.

Source-contract / registry consumers updated:
- `config/ai-source-registry.json`
- `tests/issue-376-ai-source-console.test.mjs`
- `tests/hardware-aware-local-ai-runtime.test.mjs`
- `tests/issue-1462-local-ai-readiness-installation-move.test.mjs`

Behavior boundary:
- Installation detection remains local-only, cached for 30 seconds, and limited to reviewed executable paths, command lookup and Windows uninstall registration.
- Installation status remains a loopback/same-origin GET at `/api/local-ai/installations`; llama.cpp, LM Studio, Ollama and ComfyUI probes remain fixed to reviewed loopback endpoints with the existing 1.5-second timeout.
- Ollama installation status continues using its current OpenAI-compatible `/v1/models` loopback probe; the source-contract test no longer asserts the older `/api/tags` probe.
- Readiness inference remains restricted to HTTP(S) loopback endpoints, uses the existing bounded `/chat/completions` POST probe with a 12-second timeout, and never accepts a caller-supplied remote endpoint.
- Managed llama.cpp startup/fallback semantics remain unchanged, and readiness evidence remains private under the persistent runtime directory with file mode `0o600`.
- No compatibility shim remains at any retired root path.
- The larger `phase1-build-ai` batch intentionally remains incomplete until every remaining ratified direct AI source is moved and exact-head green.

## #1462 — ComfyUI setup gateways

Status: **candidate; AI batch remains in progress**

Move boundary:
- `build/comfyui-onboarding-gateway.ts` → `build/ai/comfyui-onboarding-gateway.ts`
- `build/comfyui-sdxl-starter-gateway.ts` → `build/ai/comfyui-sdxl-starter-gateway.ts`

Runtime/import consumers updated:
- `build/local-ai-gateway.ts` imports both canonical AI-owned setup gateways.
- the moved onboarding gateway reaches the shared root-owned ComfyUI diagnostics helper through an explicit parent import.

Source-contract consumers updated:
- `tests/issue-946-comfyui-settings-onboarding.test.mjs`
- `tests/issue-1022-sdxl-starter-checkpoint.test.mjs`
- `tests/issue-1026-comfyui-runtime-settings.test.mjs`
- `tests/issue-1083-comfy-mcp-management-adapter.test.mjs`
- `tests/issue-1226-release-security-cleanup.test.mjs`
- `tests/issue-1255-comfyui-real-machine.test.mjs`
- `tests/issue-1462-comfyui-setup-move.test.mjs`

Behavior boundary:
- ComfyUI onboarding remains local/same-origin and does not activate or start anything without the existing explicit approval POST.
- Passive installation inspection remains GET-only; managed Comfy MCP/comfy-cli lifecycle remains preferred before the existing Windows Desktop fallback.
- Setup continues to use fixed loopback `http://127.0.0.1:8188`, bounded process output/timeouts and shell-free command execution.
- The reviewed SDXL starter remains Windows-only, loopback/same-origin, explicit-approval gated and pinned to the same 6.94 GB SDXL 1.0 file, SHA-256 and OpenRAIL++ license.
- The starter still downloads through the reviewed PowerShell installer with `shell: false`, accepts no caller-supplied URL/path/command, and preserves partial-file size/hash verification before activation.
- No compatibility shim remains at either retired root path.
- The larger `phase1-build-ai` batch intentionally remains incomplete until every remaining ratified direct AI source is moved and exact-head green.
