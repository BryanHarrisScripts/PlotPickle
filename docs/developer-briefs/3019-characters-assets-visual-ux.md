# #3019 — ASSETS Characters creation, eight-view gallery, and Outline/Community presentation

Human request, 2026-10-16: Continue the approved Posters slice with **Characters**; reference **Outline or Community** as the end-user interface quality bar. This PR is a bounded Characters authoring slice, not the complete #3019 epic.

## User flow
Load Brotherly Love or Afterglow -> ASSETS -> Characters -> select story-rostered character -> select Front, Back, Left, Right, Left 45°, Right 45°, Neutral Stance, Secondary Stance -> generate one preview -> inspect -> Save view -> continue views -> Lock complete version -> available as existing PPF World Map approved reference for Storyboard and Mind Map.

## Reused authorities
- `mindMapCharacterRoster` and `mindMapCharacterVisualPrompt`: character IDs/names only from saved Character Truth. Never infer identities from uploaded private unreviewed prose or invent canon.
- `mindMapCharacterVisualGenerationPlan`: current partial version, max five versions, approved reference images. Preserve identity-lock references for the configured existing image router.
- `saveWorldMapCharacterVisualVersion`, `lockWorldMapCharacterVisualVersion`, `upsertWorldMapCharacterVisualPackage`: **existing** PPF World Map visual identities, no second storage schema. Only complete eight-view sets are lockable; Unlock returns references to draft.
- Explicit authenticated paid-route consent. Verify generated local bytes on Generate/Save/Lock; preserve provider/model/source prompt and reference provenance. Guard exact active Library ID/revision and protected profile-private flush/readback.
- No persistent character roster -> instruct user to visit Mind Map to develop Character Truth, not silently invent identity.

## Presentation
- Dedicated polished character page within ASSETS, using Outline's structured work panels and Community's left navigation/selected-state affordances.
- Top summary, searchable-feeling compact roster, selected character evidence, status chips, 8-view gallery with missing indicators, generation studio with explicit Save and Lock/Unlock and progress/status feedback; responsive width, keyboard focus, theme tokens.
- Preserve Posters and nested Sounds, Back to Dashboard, Mind Map/World Map review compatibility.

## Verification & limits
- Focused synthetic contract tests: eight view ownership, one-lock-per-character semantics, retained references, no cross-story write, active source, route consent, exact readback, responsive keyboard-friendly UI. Truth-bind revised sources under WHITE-PAPER-V3 W8/W9.
- CI: build, architecture layers and selected Windows UAT proof as applicable; revise/fix until required green. A green static test is not evidence of actual Human private Brotherly Love media generation or byte-complete portable restore; the Human confirms those in attended UAT.
- World environment image generation, Collectibles, audio refinement and byte-complete PPF portability stay under #3019. Existing working posters/Afterglow Library card must not regress.
