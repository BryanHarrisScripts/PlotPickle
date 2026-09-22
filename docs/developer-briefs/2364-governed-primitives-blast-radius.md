# #2364 Governed primitive inheritance and deterministic blast radius

## Purpose

This is the first bounded implementation slice of parent #2346.

PlotPickle already owns one canonical Skin V1 Surface Registry, one Surface Grammar, anatomy/composition contracts, the Surface Contract Matrix, WebMCP, Visual Director and UI Continuity. This slice extends those authorities instead of creating a second UI system.

## What changes

The existing Surface Grammar gains:

- a governed primitive catalogue grounded in existing Skin V1 contracts;
- representative surface-family profiles;
- a DSDD LIVE UAT overlay profile.

The canonical Surface Registry marks Dashboard, Learn, Discover, Storyboard and Settings as representative primitive-inheritance consumers. Storyboard also declares its explicit nested blast-radius dependents.

The existing surface-contract resolver now exposes effective primitive composition and deterministic blast-radius resolution.

## DSDD boundary

DSDD LIVE UAT is not added as a fake page route or duplicate Surface Registry entry.

It is modeled as a global contextual overlay composed from:

- overlay-shell;
- input-console;
- status-bar;
- action-control.

This preserves the distinction between a governed page surface and a developer/UAT overlay attached to the running product.

## Blast-radius rules

Primitive change:
- resolve only surfaces whose effective primitive composition includes that primitive;
- include governed overlays that use the primitive.

Family change:
- resolve the surfaces currently opted into that family profile.

Surface change:
- resolve that surface plus explicit `blastRadiusDependents` only.

This first slice intentionally opts in only representative surfaces. Later #2346 work can expand coverage without changing the resolver contract.

## Non-goals

- no visual redesign;
- no new Surface Registry;
- no second design system;
- no new screenshot authority;
- no automatic migration of all 80 registry entries;
- no change to WebMCP, Visual Director or UI Continuity verdict ownership;
- no invented DSDD route.

## Verification

The existing Layer 1 canonical Skin/Surface suite proves:

- representative primitive inheritance;
- Dashboard reference exemption from Return;
- Learn/Settings horizontal-menu inheritance;
- DSDD remains an overlay rather than a page surface;
- primitive/family/surface blast-radius resolution;
- explicit Storyboard nested dependents.
