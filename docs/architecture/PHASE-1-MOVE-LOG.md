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

## #1462 — LTX local-video gateway slice

Status: **completed by this slice; AI batch remains in progress**

Move boundary:
- `build/comfyui-ltx-local-gateway.ts` → `build/ai/comfyui-ltx-local-gateway.ts`

Runtime/import consumers updated:
- `build/local-ai-gateway.ts`
- the moved gateway now reaches the still-root provider and shared media/GPU helpers through explicit parent imports.

Source-contract / CI path consumers updated:
- `tests/hardware-aware-local-ai-runtime.test.mjs`
- `tests/issue-1462-build-domain-consolidation.test.mjs`

Behavior boundary:
- The LTX route remains local-only and same-origin guarded.
- LTX remains the default local video path only while `videoRoute === "none"`.
- GPU media leasing, the 30-minute local render window, body bounds and validated `ltx-*` job IDs remain unchanged.
- No compatibility shim remains at the retired root gateway path.
- `build/comfyui-ltx-local-provider.ts` intentionally remains at root for the next isolated AI move slice; the larger `phase1-build-ai` batch remains incomplete.
