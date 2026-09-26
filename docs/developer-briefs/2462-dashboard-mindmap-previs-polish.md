# Developer Brief — #2462 Dashboard order and MindMap/Previs polish

## Intent

Apply the approved Matrix Dashboard and Previs/MindMap cleanup as a bounded UI change. Preserve existing workspace IDs, canonical story state, provider/runtime behavior, and downstream Storyboard/Previs provenance.

## Approved UI contract

### Dashboard
- SOUND is ordered: `Foley → Narration → Music`.
- PITCH is ordered: `Deck → Package → Feedback`.
- PLAY shortcut `[3]` keeps id `story` but displays `The Unwritten`.

No shortcut or underlying destination IDs are renamed.

### MindMap
- The Dashboard review header is `MindMap`.
- The shared surface name is `MindMap`.
- The MindMap surface headings use the same one-word form.
- Existing Act-first MindMap behavior, Discovery Mapper behavior, and saved project data remain unchanged.

### Previs
- The Dashboard review header displays `Previs`.
- The shared surface name remains the PREVIS surface.
- The embedded progressive Story Map identifies itself as `Previs`; it must not present the generic Outline heading for this surface.
- Remove user-facing `Open Storyboard` links from Previs.
- Remove the user-facing `Inspect evidence` action from Previs.
- Keep the 25-position Flip Book, Act/Block navigation, Add creative shot authoring, selected evidence/provenance, and Storyboard-derived visual truth.

Removing the links does **not** sever Storyboard provenance. Previs continues to consume governed Storyboard artifacts; it simply stops presenting redundant backwards navigation actions.

## Files owned by this pass

Production:
- `app/skin-v1/dashboard-menu-registry.ts`
- `app/skin-v1/dashboard-bbs-review-host.tsx`
- `app/skin-v1/discovery-surface.tsx`
- `app/_components/previs/previs-readiness-workspace.tsx`
- `modules/build/ui/progressive-story-map.tsx`

Verification:
- existing Dashboard / MindMap / Previs regression tests updated only where the approved UI contract changed
- `tests/issue-2462-dashboard-previs-polish.test.mjs`
- `config/development-convergence/2462.json`

## Non-goals

Do not:
- rename Dashboard item IDs or keyboard shortcuts;
- change canonical story, World Map, Storyboard, or Previs storage;
- change image/video provider routing;
- redesign the entire Matrix skin;
- remove Storyboard-derived evidence from Previs;
- change Flip Book position count, Act/Block addressing, or shot-authoring authority.

## Verification

Before merge:
1. `git diff --check`
2. focused #2462 and affected historical regressions
3. BEN changed-code quality gate
4. Experience Skins architecture shadow
5. Experience Contract architecture shadow
6. production build
7. normal PR checks against `main`

Merge only when the PR is green.
