# #1971 — PlotPickle product identity and favicon

Parent: #1962  
Roadmap: #1918 — Phase 5 remains paused.

## Purpose

Bring current Human-facing PlotPickle identity into line with the approved category:

**AI-native agentic story operating system**

This is a bounded identity cleanup. It does not redefine PlotPickle architecture, project authority, curriculum, Agents, providers or story workflow.

## Current-product authority

`lib/product-direction.ts` owns the reusable current category as `PLOTPICKLE_PRODUCT_CATEGORY`. Active product surfaces consume that constant instead of maintaining independent category strings.

The aligned active surfaces are:

- root browser metadata;
- authenticated browser title;
- About;
- Welcome / Simple Start;
- marketing splash current-product copy;
- installed-app manifest description.

## Browser identity

Current browser and installed-app icon metadata use:

`/brand/favicon/plotpickle-green-square.svg`

The mark is deliberately simple: a PlotPickle green square with a dark inset border. This slice replaces the browser/favicon identity only. It does **not** globally replace existing visible PlotPickle logo artwork used inside application workspaces, marketing composition or historical brand references.

## Historical boundary

The #382/#383 AI-native visual-writing programme remains historical evidence. In particular:

- `docs/AI-NATIVE-VISUAL-WRITING.md` remains intact;
- `config/ai-native-visual-writing-programme.json` retains its historical programme category;
- historical constant/file names are not renamed merely to erase their origin.

Current positioning and historical programme evidence are therefore distinct rather than contradictory.

## Non-goals

This slice does not:

- change PPF or project authority;
- change story startup behavior from #1969;
- change LEARN or begin #1918 Phase 5;
- change Community / BUZZ;
- change Agents, providers or inference;
- redesign the visual logo system;
- implement Slice 6 menu/footer keyboard feedback;
- rewrite unrelated repository history.

## Verification

`tests/issue-1971-product-identity-favicon.test.mjs` proves:

1. the canonical current category is exact;
2. active identity surfaces no longer present the retired category as current product identity;
3. metadata and authenticated browser title use the same category authority;
4. browser/app icon metadata uses the green-square favicon and not the old ouroboros favicon paths;
5. historical #382/#383 evidence remains preserved;
6. the focused regression is selected by the seven-layer verification mesh;
7. #1971 development convergence is `CONVERGED` against the real diff.

Existing positioning tests are migrated only where they asserted the old category as the **current** PlotPickle identity. Historical programme assertions remain unchanged.

Stop for Human merge approval after exact-head Architecture Verification is fully green.
