# Previs / Production Shot reuse audit for #1425

This audit records the required reuse-first decision before Phase 9 changes production behavior. It follows the completed #1424 Storyboard boundary: PPF owns story canon, Storyboard owns later visual planning identity, Production Shots own variable execution/render intent, and Previs/Animatic owns timing projection only.

Product flow:

`PPF story identity -> approved Storyboard visual anchor/intent -> variable Production Shot coverage -> Previs/Animatic timing projection`

Not:

`Previs timeline -> separate story copy`

## 24/96 flexibility rule

The 24 Blocks / 96 Mini-Blocks remain canonical story-address and provenance anchors. They are not a final shot, clip or duration quota.

- one Mini-Block may have no production shot yet, one shot, or many shots/variations;
- one Block may become visually dense while another remains sparse;
- a Sequence or Act may redistribute shot density as pacing/editing becomes visible;
- every Production Shot and Previs segment must still retain stable refs to the canonical story/Storyboard evidence it serves;
- continuation, interpolation, alternate takes and timing variants are production variations, not new story canon;
- Previs may group/review coverage at Mini-Block, Block, Sequence and Act resolution without changing the underlying 24/96 addresses.

## Reuse classification

| Existing surface / contract | Classification | Phase 9 rule |
| --- | --- | --- |
| `app/preproduction-workspace.tsx` Shot Designer | Adapt | Preserve shot coverage/editor controls, but replace legacy `PlotPickleProject` ownership and `block.visuals` assumptions with canonical PPF + #1424 Storyboard anchor/approved-visual refs. |
| `app/preproduction-workspace.tsx` Animatic view/player | Adapt | Preserve play/pause, per-segment duration and readable timeline UX. Timeline items must come from canonical Storyboard/Production Shot projections rather than legacy frame arrays. |
| `lib/preproduction.ts` `ProductionShot` operations | Adapt / merge | Preserve useful variable shot-level fields (size, angle, movement, lens, composition, duration, status, notes) and stable shot IDs. Replace copied story-purpose/continuity authority with canonical refs or derived display evidence where possible. |
| `lib/preproduction.ts` `buildAnimaticTimeline` | Replace ownership, reuse temporal idea | Current function flattens exactly one legacy visual frame per Mini-Block. Phase 9 must instead sequence zero/one/many Production Shots under canonical anchors and allow uneven density. |
| `lib/projects/project.ts` `ProductionShot` | Compatibility bridge | Useful shot fields remain migration input, but the legacy project type cannot become a second PPF. Canonical target refs, provenance/current/stale state and shared asset identity must be added through the current architecture before legacy ownership can retire. |
| `lib/projects/project.ts` `VisualFrame` / `VisualMediaVersion` | Existing #1424 compatibility input | Do not re-promote these as Previs canon. Phase 9 consumes the Storyboard adaptation completed in #1424 and reuses shared asset/version identity only where still needed. |
| `lib/lazy-frames-core.mjs` | Adapt | Preserve deterministic derived-only render semantics, explicit `PPF` authority, provenance output and no-PPF-mutation rule. Replace legacy `extensions.buildSequenceApprovals`, `project.blocks` and approved legacy visual lookup with canonical PPF/Storyboard/Production Shot inputs. |
| `app/build-animatic-studio.tsx` | Adapt / later consolidate | Preserve Prepare -> Validate -> Preview -> Render and explicit Human render approval. Replace `plotpickle.project.v1` local-storage loading and legacy project normalization with the current profile-owned PPF boundary. |
| `/api/render/lazy-frames/*` local render boundary | Reuse subject to focused verification | Local derived rendering remains optional and should stay separate from logical Previs acceptance. No paid/cloud generation is required for Phase 9. |
| shared project asset registry / variation refs | Reuse / merge | Production Shots and Previs should point to the same approved/reference assets used by Storyboard rather than copying media into a Previs library. |
| Sonic cues / dialogue timing references | Reuse as optional temporal evidence | Keep cue/dialogue references where useful, but do not duplicate screenplay/audio canon. Missing audio must remain an honest placeholder. |
| Production breakdown/schedule/distribution views | Out of Phase 9 core | They remain useful production-planning surfaces but are not required to prove Storyboard -> Production Shot -> Previs timing identity. Do not broaden #1425 into a production-management rewrite. |
| legacy Afterglow media | Reuse as Observed/reference | Existing media may demonstrate the pipeline but remains reference unless explicitly accepted by the current Human-owned workflow. |

## Ownership corrections required

The current reusable implementation still contains several legacy authority assumptions that Phase 9 must not preserve:

1. `app/build-animatic-studio.tsx` loads `plotpickle.project.v1` and normalizes the legacy `PlotPickleProject` directly.
2. `lib/preproduction.ts` derives Production Shots and animatic rows from `project.blocks[].visuals` and copied legacy scene/frame fields.
3. `lib/lazy-frames-core.mjs` reads `extensions.buildSequenceApprovals`, `project.blocks`, legacy screenplay arrays and legacy approved frame versions.
4. `buildAnimaticTimeline` currently treats each legacy visual frame as the timeline unit. That encodes the old one-frame-per-Mini-Block shape and conflicts with variable Production Shot coverage.

Phase 9 therefore adapts these surfaces rather than deleting them.

## Canonical Phase 9 target model

The next implementation slice should establish the smallest public Previs/Production Shot projection capable of expressing:

- stable Production Shot ID;
- canonical project / Act / Sequence / Block / Mini-Block / scene refs where earned;
- Storyboard anchor/frame/approved visual refs;
- shot order within its owning anchor/group;
- optional shot size, angle, movement and lens intent;
- duration and transition/timing intent;
- approved still/video asset refs or explicit missing-media placeholder;
- provenance/source refs;
- current / stale / needs-review state;
- return link to the owning Storyboard/story target when an edit is actually upstream.

Story text, character facts and location facts remain canonical upstream references rather than copied independent truth inside the shot/timeline record.

## Readiness rule

- Locked Storyboard target -> Locked Previs target.
- A canonical Storyboard anchor may exist with zero Production Shots.
- A kept/approved Storyboard visual can seed Production Shot planning without requiring generated video.
- A Production Shot may be timing-ready with a still or honest placeholder.
- Legacy/reference media is Observed until accepted in the current workflow.
- Logical Previs acceptance must not depend on installing Lazy Frames or calling a cloud/video provider.

## Staleness rule

Staleness must be dependency-scoped just as #1424 is target-scoped. A change to one Storyboard anchor/accepted upstream identity should mark only Production Shots and Previs segments that depend on that target as needs-review. Unrelated shots, timing and assets remain current.

No automatic regeneration is allowed.

## First implementation seam

The safest first production slice after this audit is a canonical, read-only Previs projection adapter built from current PPF + #1424 Storyboard state. It should prove variable zero/one/many shot coverage and target identity before mutating or migrating the legacy Production Shot editor.

Only after that contract is green should the existing Shot Designer and Animatic UI be wired to write through the canonical owner.
