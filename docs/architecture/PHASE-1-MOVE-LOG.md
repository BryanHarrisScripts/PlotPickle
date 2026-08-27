# Architecture Phase 1 move log

## #1462 — Projects batch

Status: **completed in the current #1462 Projects PR candidate**

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
