# #2159 Phase 1 — One Surface Registry consumed by verification

## Purpose

Phase 0 established the Skin V1 Surface Grammar and canonical census. Phase 1 changes runtime inventory ownership so UI Continuity and WebMCP/Visual Director can no longer silently maintain different authoritative screen lists.

This phase deliberately changes governance plumbing, not product navigation or visual presentation.

## Human decisions preserved

The September 17 Human review and earlier PlotPickle UI-governance decisions establish these boundaries:

- Dashboard is the sole canonical Skin V1 visual authority.
- Skin V1 Matrix is the current visual vocabulary; older `matte-black-teal-orange` and Experience V2 registry data are compatibility/history, not current visual authority.
- UI Continuity remains the existing agent. Do not create a second continuity agent or verifier.
- UI Continuity stays read-only in this phase. Deterministic repair mode belongs to a later #2159 phase.
- Existing routes, deep links, WebMCP capture paths and baseline workflow must continue to work.
- Nested Community, Library, Settings and later production states remain in the canonical census even when they are census-only and not yet standard captures.
- Screenshot baselines are secondary regression evidence; structural contracts will become the primary consistency mechanism in later phases.
- Build/test/fix work stays bounded locally; exact-head GitHub Architecture Verification owns the full merge gate.

## Current duplication

Before Phase 1:

- `config/skin-v1-surface-registry.json` is canonical but runtime consumers still read compatibility inventories directly.
- `config/ui-continuity-agent-registry.json` contains route/audit metadata and its own screen list.
- `lib/verification/webmcp-surface-capture-registry.mjs` contains detailed selectors/navigation plus its own standard target list.

The detailed metadata remains useful. The duplicate authority does not.

## Phase 1 design

### Canonical runtime projection

`lib/verification/skin-v1-surface-registry.mjs` loads and validates the canonical registry and owns deterministic projections.

For UI Continuity it:

1. reads canonical `continuityIds` in canonical surface order;
2. joins those ids to the older UI Continuity metadata;
3. fails closed if metadata is missing or contains an undeclared screen;
4. enriches each projected screen with canonical surface id, family, class and `skin-v1-matrix` authority.

`config/ui-continuity-agent-registry.json` therefore remains compatibility metadata only. It can preserve historical routing fields required by the existing audit without controlling which screens are in scope.

### WebMCP compatibility guard

`lib/verification/webmcp-canonical-surface-registry.mjs` projects the standard WebMCP set from canonical `webmcpId` mappings and verifies the detailed capture definitions have exactly the same ids and order.

The existing capture-registry module remains the source of detailed selectors, navigation steps, baseline paths and timeouts. It is no longer allowed to diverge from the canonical inventory.

Core WebMCP verification loads the canonical guard before runtime capture. The bounded WebMCP UAT skill policy also takes its allowed target set from the canonical projection.

This preserves the current 26-surface behavior while making divergence fail closed.

## Non-goals

- no product UI or CSS rewrite;
- no navigation behavior change;
- no new Surface class;
- no new baseline locks;
- no Visual Director severity changes yet;
- no geometry/token measurement expansion yet;
- no automatic UI repair;
- no story/canon/provider changes.

## Regression requirements

Focused tests must prove:

1. canonical Surface Registry remains `skin-v1-matrix` with Dashboard as reference;
2. every UI Continuity compatibility screen is declared through a canonical `continuityIds` mapping;
3. projected UI Continuity order/inclusion comes from the canonical registry;
4. missing or extra UI Continuity compatibility metadata fails closed;
5. canonical WebMCP ids exactly match the existing 26 detailed capture definitions and order;
6. WebMCP UAT allowed targets come from the canonical projection;
7. UI Continuity Agent iterates projected canonical screens rather than `registry.screens` directly;
8. existing read-only / Human-approval boundaries stay intact.

## Exit criteria

Phase 1 is complete when the focused registry tests pass and exact-head Architecture Verification is green. No PR is merged while any layer is red.
