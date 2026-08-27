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

Status: **candidate; BUZZ batch remains in progress**

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
- The larger `phase1-build-buzz` batch intentionally remains incomplete until every ratified direct `build/buzz-*` source is moved and exact-head green.
