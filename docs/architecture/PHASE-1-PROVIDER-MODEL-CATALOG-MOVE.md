# #1462 — Provider model catalog AI move

Status: candidate; `phase1-build-ai` remains in progress.

Move boundary:
- `build/provider-model-catalog-gateway.ts` → `build/ai/provider-model-catalog-gateway.ts`

Runtime consumer updated:
- `build/local-ai-gateway.ts` now imports the canonical AI-owned gateway.

Source-contract consumers updated:
- `tests/issue-1344-settings-model-catalog.test.mjs`
- `tests/issue-1377-unified-ai-compute-settings.test.mjs`
- `tests/issue-1462-provider-model-catalog-move.test.mjs`

Behavior boundary:
- `/api/ai-model-catalog` and `/api/ai-model-catalog/select` remain unchanged.
- Requests remain loopback/same-origin restricted.
- Model selection bodies retain the 32 KB bound and provider discovery retains the 15-second timeout.
- Only OpenAI and MiniMax remain accepted cloud providers; Writing, Images and Video remain the accepted capabilities.
- Model selection changes configuration only; it does not change the active route or trigger paid generation.
- Existing credential, writing-assistant and media-routing stores remain the source of truth.
- No compatibility shim remains at the retired root path.
