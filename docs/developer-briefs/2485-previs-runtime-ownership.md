# 2485 — Previs runtime ownership and live verification

# Developer Brief — Pre-production live-surface ownership regression from #2457

## Purpose

Repair the first confirmed point where merged/green source stopped reliably matching the normal **Option 1** rendered PlotPickle experience.

The forensic boundary is **PR #2457 / issue #2456**.

This issue must fix the runtime ownership bug, close the verification hole that allowed it to merge, and revalidate every relevant merged change from #2457 forward before new Storyboard work is layered on top.

## Root cause — confirmed

### Existing behavior before #2457

PR #2405 introduced a necessary Surface Orchestrator exception for Storyboard.

When Storyboard renders inline shared children such as:
- `story-map`;
- `visual-story`;

the orchestrator keeps **Storyboard** as the active owner rather than allowing a deeper child selector to take over.

Current implementation originated from commit:

`9ad97f2168d1cc1c6936ef867f6cbcc6ccf971da`

> Keep Storyboard as owner of inline visual children

### Regression introduced by #2457

PR #2457 changed Previs to embed the same shared `ProgressiveStoryMap` used by Outline/Storyboard.

However, #2457 did **not** extend the Surface Orchestrator ownership model to Previs.

The canonical registry currently declares:

- `story-map`
  - label: `Outline`
  - runtime selector: `[data-progressive-story-map='24x96']`
  - navigation depth: 2
- `previs`
  - label: `Previs / Graphic Novel`
  - runtime selector: `main[aria-labelledby='previs-title']`
  - navigation depth: 1

The live orchestrator scans visible registered surfaces after mount and sorts candidates by:

1. navigation depth descending;
2. DOM depth descending.

Storyboard is explicitly protected:

`storyboardOwnsInlineChildren`

and filters out `story-map` / `visual-story`.

Previs has no equivalent ownership declaration.

Therefore when Previs finishes mounting:

1. the outer Previs surface matches;
2. the nested shared Story Map also matches;
3. `story-map` has higher navigation depth;
4. the orchestrator promotes `story-map`;
5. the live orchestrator header/workspace identity becomes **Outline**.

This matches the Human-observed runtime exactly:

> Previs appears correctly first, then changes to Outline after loading.

This is deterministic runtime behavior, not a stale Git checkout or browser-cache theory.

## Verification root cause — confirmed

The problem survived exact-head green CI because the relevant regressions were primarily source-contract checks.

Examples:

### #2456 / #2457 test

`tests/issue-2456-previs-flipbook-act-workspace.test.mjs`

proves source contains:
- `<StoryActRail`;
- `<SkinV1PrevisStoryMap`;
- `surfaceLabel="Previs"`;
- shared state labels.

It does not run the settled normal runtime and inspect the orchestrator-selected surface.

### #2475 / #2476 test

`tests/issue-2475-previs-surface-convergence.test.mjs`

proves source contains:
- `<h1>PREVIS</h1>`;
- `onSurfaceNameChange("PREVIS")`;
- `surfaceLabel="Previs"`;
- the four-Act CSS rule.

It does not prove those values remain active **after the Surface Orchestrator MutationObserver settles**.

### Live continuity probe gap

`lib/verification/browser-probes/continuity.mjs` already opens Outline, Storyboard, Previs and Timeline in a real browser.

But today it only proves:
- the governed route opens;
- a visible PlotPickle header exists;
- clicking the header can return to Dashboard.

It does **not** assert that:

`data-skin-v1-active-surface === requested governed surface`

after the DOM settles.

Therefore a real browser could open Previs, be reclassified as Outline, and still pass continuity.

## Repair principle

Do not add another one-off:

`previsOwnsInlineChildren`

next to:

`storyboardOwnsInlineChildren`.

That repeats the architecture mistake.

Replace the hard-coded Storyboard-only ownership exception with a generic registry-owned inline-surface ownership contract.

Suggested registry property:

`ownsInlineSurfaces`

Examples:

- Storyboard owns `story-map` and `visual-story`;
- Previs owns `story-map`.

The Surface Orchestrator must generically respect this declaration before depth sorting.

Future surfaces that embed another governed surface must declare whether the parent or child owns active identity.

## Required Phase 1 — generic runtime ownership

- extend canonical surface registry/schema/type with an explicit inline ownership field;
- migrate the current Storyboard exception into registry data;
- declare Previs ownership of its embedded `story-map`;
- remove the hard-coded `storyboardOwnsInlineChildren` branch;
- keep nested child rendering intact;
- do not remove shared ProgressiveStoryMap reuse;
- do not change story/canon authority.

### Settled Previs result

After the MutationObserver/orchestrator refresh runs:

- active surface remains `previs`;
- orchestrator global label remains Previs;
- workspace heading remains Previs;
- nested shared map remains visible;
- shared map can still use Defined / Observed / Emerging / Available / Blocked state grammar;
- the inner Story Map does not become the application-level active surface.

## Required Phase 2 — rendered browser proof

Upgrade the live browser continuity proof.

For every governed pre-production stage it opens, assert the settled orchestrator identity.

At minimum:

- Outline -> active `story-map`;
- Storyboard -> active `storyboard`;
- Previs -> active `previs`;
- Timeline -> active `scene-timeline`.

For Previs specifically:

1. open from the governed normal product flow;
2. wait for the Previs ready selector;
3. wait at least through an orchestrator refresh / stable DOM condition;
4. assert `[data-skin-v1-orchestrator='runtime']` reports `data-skin-v1-active-surface='previs'`;
5. assert the orchestrator header/workspace label is Previs, not Outline;
6. assert the embedded progressive Story Map remains visible;
7. assert shared evidence-state rendering is present.

This must be executable browser evidence, not a regex over source.

## Required Phase 3 — verification policy guard

A UI change affecting a governed/orchestrated surface must not be considered fully proven by source-contract assertions alone.

Preserve fast source tests, but route changes involving:
- surface identity;
- nested governed surfaces;
- runtime selectors;
- navigation ownership;
- orchestrator behavior;

to a rendered browser proof in the exact-head gate.

Do not make every trivial CSS change run an unnecessary giant suite. Keep the routing bounded to the relevant surface/orchestrator risk.

## Downstream audit boundary — #2457 forward

After the root fix is green, revalidate these merged changes against normal Option 1.

### #2457 — Previs Act workspace / Flip Book
Status before repair: **source present, live identity broken by orchestrator**.

Must prove live:
- Act 1–4;
- six Blocks for active Act;
- four Mini-Blocks per Block;
- shared readiness colors;
- locked Storyboard frames feed Flip Book;
- no old five-stage rail as primary Previs navigation.

### #2459 — Story-to-screen convergence
Status: **source present; Human has not yet validated Timeline/Rough Cut/Screening**.

After root repair, verify no collateral regressions in:
- Timeline;
- Foley / Narration / Music;
- Rough Cut;
- Screening.

Do not redesign them in this issue unless the live pass finds a regression attributable to the #2457-forward integration path.

### #2461 — OSS runtime/skills
Status: **not part of this visual regression**.

No replay required.

### #2463 — Dashboard/MindMap/Previs polish
Status:
- Dashboard/MindMap source present;
- Previs source fix present but masked by orchestrator.

Revalidate Previs identity after root repair.

### #2465 — launcher numbered menu
Status: **live**.

The Human's Option 1 startup proves it is present.

No replay required.

### #2467 / #2474 — Storyboard Keep/Lock recovery
Status: **source present and active review path observable**.

Revalidate only authority/recovery non-regression; do not rewrite.

### #2472 — Flip Book / Graphic Novel
Status:
- readable Flip Book playback is live;
- Graphic Novel playback is live;
- current HTML export is live.

Important: a later Human decision changed export intent to **Animated WebP only**. That later requirement was discussed but never entered GitHub implementation. It is not a lost merge.

Record a follow-up implementation issue after the root repair:
- remove HTML as the Human-facing Graphic Novel export;
- no format picker;
- export Animated WebP only;
- reuse established story-facing comic/bubble treatment where applicable;
- preserve locked-frame authority and presentation-only narration.

### #2476 — Previs convergence
Status: **child source fix present; root runtime ownership unresolved**.

After Phase 1, re-run its acceptance criteria as rendered evidence:
- PREVIS identity;
- centered four-Act rail;
- shared state colors;
- no duplicate Visual Coverage navigator;
- Flip Book / Graphic Novel intact.

### #2477 — three runtime modes
Status: **live**.

No replay required except the normal Option 1 rendered proof introduced here.

### #2478 — WebMCP surface governance
Status: **present but did not cover nested owner identity**.

Extend governance so it cannot certify a requested surface while the runtime orchestrator has selected a different one.

### #2479–#2481
Status: runtime/UAT work, not the cause of this visual regression.

No source replay required.

### PR #2484 / issue #2483
Status: **open, intentionally not on main**.

Do not merge until this root repair lands and #2484 is updated/rebased against the repaired main.

## Outline clarification

Do not incorrectly "restore" Outline to a two-column design.

The explicit two-column work belonged to MindMap.

The canonical Outline restore remains the #2427 / #2399 shared-map snapshot:
- four-Act rail;
- three Sequences for selected Act;
- six Blocks;
- Defined / Observed / Emerging / Available / Blocked state colors.

Current `MatrixStoryMapSurface` composition still matches the #2427 restore point.

After root repair, perform rendered verification of Outline, but do not invent a two-column restoration.

## Acceptance criteria

- [ ] Exact first regression boundary is documented as #2457 / #2456.
- [ ] Surface Orchestrator no longer has a Storyboard-only hard-coded ownership exception.
- [ ] Inline governed-surface ownership is explicit and registry-owned.
- [ ] Storyboard retains ownership over its declared inline children.
- [ ] Previs retains ownership over its embedded shared Story Map.
- [ ] Opening Previs in normal runtime never settles to active `story-map`.
- [ ] Settled orchestrator header/workspace identity remains Previs.
- [ ] Previs shared Act/Block/Mini readiness colors remain visible.
- [ ] Existing Flip Book / Graphic Novel playback remains functional.
- [ ] Live continuity browser probe asserts requested stage == settled orchestrator active surface.
- [ ] A mismatch is a blocker.
- [ ] Source-only tests remain supplemental, not sufficient proof for nested surface identity.
- [ ] #2457, #2463 and #2476 visible acceptance criteria are re-proven in the browser.
- [ ] #2459 downstream surfaces are revalidated after the root fix without speculative redesign.
- [ ] #2465, #2467/#2474, #2477 and #2479–#2481 are not needlessly replayed.
- [ ] Animated WebP-only Graphic Novel export is recorded separately as a never-implemented later requirement.
- [ ] PR #2484 remains unmerged until the repaired main is established.
- [ ] Exact-head Architecture Verification is green before merge.

## Human objective

From this point forward, "merged and green" for a governed UI surface must mean the change is demonstrably present in the settled normal product experience, not merely present as source text.

