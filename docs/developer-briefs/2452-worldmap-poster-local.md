# Developer Brief — WorldMap Poster, Local Durability and Green Dashboard State

Issue: #2452

## Goal

Finish the current Human-facing WorldMap pass so the surface is visibly complete, can create its own movie-poster visual, persists that poster with the active Library story, and graduates WorldMap from the Dashboard review/yellow state to the connected/green state.

## Human-approved UX

1. Use the one-word product name **WorldMap** everywhere this Dashboard surface identifies itself.
2. Replace the passive **NO POSTER YET** state with an obvious **Generate Poster Visual** action.
3. Build the poster from the active story:
   - exact project title;
   - the current established logline as the primary premise;
   - current WorldMap/Foundations evidence only as supporting context;
   - current character names only as character placeholders when no cast metadata exists;
   - a conventional theatrical billing/footer zone including Director, Producer and Musical Score roles.
4. Unknown credit identities stay **TBD**. Never invent director, producer, composer or actor names.
5. The poster remains a **PPF Marketing Reference**, not story canon.
6. Use the configured image route. Paid/cloud requests retain the existing acknowledgement boundary.
7. Make **Generate Character Visual** visibly actionable using the normal Matrix/PlotPickle action treatment.
8. After implementation and verification, WorldMap leaves the Dashboard review/yellow set and uses the connected/green state.

## Local durability and Library Load

Generated poster bytes remain under PlotPickle's durable local asset authority, `persistentHome()/assets`, surfaced through `/api/local-ai/assets/...`.

The WorldMap poster request must use an asset stem containing the active project ID. The resulting Marketing Reference is saved in the full `LibraryPPFProject`, so reopening a saved working story restores the same poster reference after restart.

Library -> Load recovery also recognizes WorldMap poster filenames. Recovery remains:
- Human-controlled;
- additive;
- draft/reference only;
- duplicate-safe;
- non-destructive;
- unable to promote story canon.

A fresh Afterglow working copy may see older Afterglow local resources as an unmatched origin group and therefore requires explicit Human selection, consistent with the existing recovery boundary. Resuming the saved Afterglow working story restores the persisted Marketing Reference directly.

## Poster prompt contract

The WorldMap poster prompt requests:
- one professional theatrical poster;
- the exact active project title;
- the established logline;
- only established supporting story evidence;
- a conventional lower billing/footer zone;
- truthful TBD credit placeholders when personnel/cast identities are absent.

Generated typography can be imperfect, so PlotPickle preserves the exact intended prompt and source/provenance in the saved Marketing Reference. The image itself never becomes story canon.

## Verification

Focused tests must prove:
- WorldMap one-word naming across Dashboard, open-surface header and surface registry;
- Generate Poster Visual is visible and uses the primary action treatment;
- the poster request uses title + established logline + truthful billing placeholders;
- success requires a durable `/api/local-ai/assets/` URL before the Marketing Reference is saved;
- the poster is stored in the active Library project;
- poster filenames are recoverable by project identity;
- Library restore can reattach selected WorldMap poster resources additively;
- Generate Character Visual uses the explicit action treatment;
- WorldMap is connected but absent from `DASHBOARD_REVIEW_ITEM_IDS`;
- existing Story Bible projection and character visual package behavior remains intact.

## Merge bar

Run focused checks first. Open the PR after the branch is coherent. Then run required exact-head PR gates, repair only failures, and merge when all required checks are green.
