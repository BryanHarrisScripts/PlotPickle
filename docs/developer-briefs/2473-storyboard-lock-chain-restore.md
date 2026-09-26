# Developer Brief — #2473 Storyboard recovered-working-copy Keep/Lock persistence

## Problem

#2466 restores a Storyboard Keep/Lock only when the saved project whose id exactly matches a local resource's \`originProjectId\` proves approval.

That misses a later Human approval made after restoring the legacy image into a newer Library working copy.

## Required behavior

When the same legacy Storyboard resource is restored into another fresh working copy, PlotPickle may restore its prior Human Keep/Lock from saved Library history if and only if a saved accepted artifact proves the exact same resource.

### Direct-origin proof
Keep #2466 unchanged in spirit:
- project id = resource origin project;
- exact asset URL;
- Storyboard workflow;
- exact frame position;
- exact Block/Mini-Block anchor;
- non-rejected;
- accepted review state / accepted id.

### Recovered-working-copy proof
If the saved approval comes from a different project id, require all direct exact-match checks plus:
- \`recovery-origin-project:<origin id>\`;
- \`recovery-content-hash:<content hash>\`.

Both provenance keys are mandatory.

## Library evidence scope

Search readable saved projects in the current profile:
- active Library projects;
- archived Library projects;
- direct origin ids from the selected local resources.

Snapshot reads must not switch the active project.

## Restored provenance

A newly recovered artifact keeps its deterministic recovery id and records:
- recovery origin project;
- recovery content hash;
- approved artifact id;
- approved project id;
- approval source = saved Library.

## Previs

No bypass. Previs continues to accept only canonical Storyboard accepted/locked artifacts.

## Verification

Layer 5 is primary. Keep #2432 and #2466 green and add #2473 to the existing Library local-resource-recovery test owner. Layer 1 remains a non-regression check for Library → Storyboard → Previs experience.

See GitHub issue #2473 for full acceptance criteria.
