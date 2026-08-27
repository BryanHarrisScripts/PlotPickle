# Visual pipeline reuse audit for #1423

This audit records the reuse-first boundary required before Storyboard and Previs re-adoption. It does not create a new visual canon. PPF/curriculum state remains authoritative and all existing visual surfaces are projections of that state.

| Existing surface/contract | Classification | Phase 7 rule |
| --- | --- | --- |
| `modules/build/progressive-story-map.ts` | Reuse as-is | Canonical source for current Defined / Observed / Emerging / Missing / Locked structural evidence and reviewed-placement status. |
| `core/contracts/build-progress.ts` | Reuse as-is | Accepted Foundations/World visual artifact IDs remain PPF-owned visual approval evidence. |
| `lib/projects/visual/character-visual-identity.ts` | Adapt through readiness bridge | Existing locked identity/version/reference contract remains the character visual identity implementation; Phase 7 consumes it as legacy/current visual evidence rather than copying it. |
| `app/visual-storyboard.tsx` | Adapt in Phase 8 | Reuse storyboard identity inputs, frame/version concepts and approved references, but gate authoring from canonical readiness before treating a target as writable. |
| `app/character-image-generator.tsx` | Reuse with canonical identity adapter | Writer-approved lock flow remains authoritative for visual identity approval. AI-generated drafts remain proposals. |
| `VisualFrame` / `VisualMediaVersion` project types | Compatibility bridge required in Phase 8 | Preserve stable frame/media identity while adapting ownership to the current PPF/frontier model. No view-specific asset duplication. |
| Afterglow legacy/reference visuals | Reuse as observed evidence | Display may continue, but legacy artwork is `observed-reference` until a Human-approved canonical visual identity or accepted PPF visual artifact adopts it. |
| Graphic Novel/shared asset work | Reuse audit input for later projection | Shared asset IDs/provenance must remain reusable; Graphic Novel is not a separate visual canon. |
| Production Shots | Adapt in Phase 9 | Consume the same canonical identities and accepted assets; do not generate a separate character/location identity layer. |
| Animatic/Previs | Adapt in Phase 9 | Consume Storyboard/shot projections and shared asset identity only after real frontier prerequisites are satisfied. |

Phase 7 introduces `modules/build/visual-readiness.ts` as an adapter/snapshot only. It writes no project state, database, local storage or asset files. Its job is to explain what canonical identity/evidence exists, which curriculum frontier owns it, whether Storyboard authoring is currently allowed, which prerequisite is missing, and why a previously valid visual projection became stale.

Staleness is target-scoped. An accepted upstream change may mark the affected character, location, block, reference or project projection stale by stable target ID and reason; unrelated targets remain unchanged. Regeneration is never automatic.
