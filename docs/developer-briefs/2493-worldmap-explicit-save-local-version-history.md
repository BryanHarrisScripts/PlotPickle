# Developer Brief — WorldMap Explicit Save, Five-Version Local History and Single Lock

Issue: #2493

## Goal

Make local media persistence explicit and visible in WorldMap. Generation creates a review candidate. Save this Version preserves that candidate with the active story. Lock this Version selects one already-saved version as downstream authority.

This applies to the WorldMap movie poster and to each character visual package.

## Save is not Lock

- Generate creates local image bytes and a temporary review candidate.
- Save this Version adds that candidate to the active LibraryPPFProject.
- Lock this Version selects one saved version as authoritative for the relevant subject.
- A lock never deletes the other saved versions.
- Generation alone never changes downstream authority.

## Poster

1. Generate Poster Visual remains the generation entry point.
2. Generation must no longer immediately store a Marketing Reference in project metadata.
3. Show the generated candidate with Save this Version.
4. Saved poster versions remain PPF Marketing Reference artifacts and non-story-canon.
5. Keep at most five saved poster versions for the active story.
6. Once five saved versions exist, block additional poster generation.
7. Show bounded previous/next chevrons for saved poster versions.
8. A saved poster shows SAVED; the selected authority shows LOCKED.
9. Exactly one saved poster may be locked at a time.
10. Locking a new poster unaccepts only other Marketing Reference versions and must not disturb unrelated accepted Foundations visuals.
11. Reopen/resume restores the same version list and lock.

## Characters

1. Keep the governed eight-view character generation package.
2. Generation must no longer immediately append references to worldMap.characterVisuals.
3. Treat one generated eight-view package as one candidate generation/version.
4. Show Save this Version after generation.
5. Keep at most five saved generations per character.
6. Show bounded previous/next chevrons to browse saved generations.
7. A saved generation shows SAVED; the downstream authority shows LOCKED.
8. Replace Approve / Lock Character Visuals with Lock this Version.
9. Exactly one saved generation per character may be locked.
10. Locking a new generation changes the previous generation back to saved/draft state without removing it.
11. Character locking requires all eight governed views.
12. approvedWorldMapCharacterReferences must return only the locked generation.

## Compatibility

Existing approved character packages must normalize into one synthetic legacy saved generation that remains locked. Previously approved Wren imagery must not disappear on reopen.

Introduce explicit version identity for new references and an explicit locked-version id at package level while retaining safe normalization of legacy data.

## Persistence

Continue using generated media bytes under persistentHome()/assets exposed as /api/local-ai/assets/..., saveActiveLibraryProject for active project persistence, existing Project Library change events/profile-private disk persistence, and complete LibraryPPFProject hydration.

Do not create a second media database, browser-only authority, cloud media store, or new provider path.

## Character storage contract

- WORLD_MAP_CHARACTER_MAX_VERSIONS = 5.
- Each reference carries a versionId.
- Each package carries lockedVersionId.
- Normalization retains at most five version groups times eight governed views.
- Helpers expose saved versions newest-first.
- A lock preserves all groups while making one group approved and all other groups draft.

## Accessibility

- Chevron buttons have useful aria-label text.
- Previous/next are disabled when no adjacent saved version exists; no wrapping.
- SAVED and LOCKED are textual states, not colour-only.
- Generated candidate status remains distinct from saved state.

## Verification

Focused tests must prove explicit Save for poster and characters; generation does not auto-save; histories cap at five; chevrons are bounded; exactly one lock per subject; replacement locks preserve saved versions; downstream character refs come from the locked version only; legacy approved packages migrate safely; Library browser hydration and profile-private reopen preserve versions and locks; persisted generated URLs remain local; story/canon and provider routing are unchanged.

## Delivery

Run focused tests before opening the PR. Then use exact-head Architecture Verification as the merge-readiness gate. Repair failures until all required checks are green. Stop at green; merge only when the Human separately requests it.
