# #1889 — Sequence Evidence for 24 / 96 / 2,400

## Status

Planning / architecture brief only. No production implementation is authorized by this document alone.

Canonical GitHub issue: #1889 — **Sequence Evidence: deterministic shot analysis, continuity and generated-film verification for 24/96/2,400**.

External methodology reference: `eternityspring/reelbench-skills` (`video-shots`), Apache-2.0.

## Decision

PlotPickle will adapt the useful **evidence discipline** from ReelBench into the existing Sequence Director rather than importing ReelBench as a second production system.

The rule is:

```text
code measures objective facts
model judges only bounded visual / film-language facts
code checks those judgments against measurements and approved PlotPickle intent
```

The resulting capability is named **Sequence Evidence** in this brief.

It extends the existing flow:

```text
PLAN
  -> STORYBOARD
  -> PREVIS
  -> RENDER PLAN
  -> GENERATE
  -> SEQUENCE EVIDENCE
       -> ANALYZE
       -> COMPARE
       -> FINDINGS
       -> HUMAN REPAIR / APPROVE
```

It does not create a second story model, timeline, render grid, provider, asset database or agent framework.

---

## Why this is a follow-on rather than a reopen of #1425

#1425 is already closed as completed. It established the re-adopted Previs/Animatic and Production Shot boundary around the same PPF/Storyboard identities and the 24 Block × 4 Mini-Block = 96 visual-production shell.

Sequence Evidence depends on that completed ownership model. It does not reopen it.

The gap this issue fills is different:

> PlotPickle can describe what it intends to film and can generate media, but it needs a bounded machine-backed way to prove what the generated media actually did and whether adjacent outputs remain continuous.

This is therefore a verification/evidence layer after generation.

---

## Existing owners that must be reused

### Creative Production Shot identity

Current owner:

`core/contracts/previs/index.ts`

`ProductionShotIntent` already represents the variable creative shot inside one canonical Storyboard Mini-Block anchor. It contains:

- stable `id`;
- `anchorRef`;
- Human-kept `storyboardArtifactId`;
- `storyboardDependencyKey`;
- variable creative `order`;
- shot size;
- angle;
- movement;
- lens;
- visual intent;
- Human-authored `durationSeconds`;
- transitions;
- review state.

The contract explicitly says zero/one/many creative shots may share an anchor.

**Decision:** Sequence Evidence must reference this identity. It must not invent a second creative-shot identity.

### Technical 3-second render addresses

Current owner:

`core/contracts/previs/index.ts`

The canonical constants are already:

```text
RENDER_CLIP_SECONDS = 3
RENDER_CLIPS_PER_MINI_BLOCK = 25
RENDER_MINI_BLOCK_SECONDS = 75
RENDER_MINI_BLOCKS_PER_BLOCK = 4
RENDER_BLOCKS_PER_FEATURE = 24
RENDER_CLIPS_PER_FEATURE = 2400
```

`RenderClipSlot` and `renderClipSlotsForAnchor()` already derive stable technical addresses with:

- block number;
- Mini-Block number;
- clip number;
- global clip number;
- start/end seconds;
- start/end keyframe numbers.

**Decision:** Sequence Evidence must consume these addresses. It must never create another 2,400-address registry.

### Sequence Director

Current owners:

- `docs/architecture/sequence-director-24-96-2400.md`
- `core/contracts/sequence-director/index.ts`
- `lib/sequence-director.ts`
- `lib/sequence-director-cinematography.ts`
- `.agents/skills/sequence-director/SKILL.md`
- `tests/sequence-director-24-96-2400.test.mjs`

Sequence Evidence is subordinate to this architecture.

### Cinematic intent

Current owner:

Cinematography Grammar / Sequence Director integration from #1868.

Expected framing/camera/movement intent should come from the current approved Production Shot/Previs/Sequence Director facts rather than an Evidence-specific vocabulary that drifts from the directing system.

### Generation runtime

Current owner:

Visual Compute Harness from #1881 and the existing Local/Cloud capability routes.

Sequence Evidence analyzes outputs. It is not another generator/provider.

### QA integration

Existing visual-production autonomous route coverage from #1553/#1571 may later consume Sequence Evidence findings, but autonomous QA is not Sequence Evidence authority.

---

## Canonical 24 / 96 / 2,400 distinction

The existing production hierarchy remains unchanged:

```text
4 Acts
  -> 12 Sequences
  -> 24 Blocks
  -> 96 Mini-Blocks
  -> variable creative Storyboard / Previs shots
  -> Human creative timing
  -> 25 technical 3-second render clips per Mini-Block
  -> 2,400 technical render addresses in the two-hour preset
```

Never equate:

```text
25 render clips == 25 creative shots
```

That would be an architectural regression.

A creative shot may span multiple technical clips; a Mini-Block may contain fewer or more creative shots according to Human-authored cinematic timing.

---

## Capability modes

### REFERENCE

Analyze authorized external/user-supplied film material whose internal shot structure is not known.

Allowed purpose:

- shot timing statistics;
- pacing/cut-rate evidence;
- shot-size/category/camera distributions;
- measured motion;
- A/B keyframes and contact sheets;
- abstract cinematic/style evidence usable as reference guidance.

Reference mode does not import the film's story, dialogue, characters or shot-by-shot creative expression into PPF canon.

### VERIFY

Compare generated PlotPickle media with approved/current intent.

Expected facts may include:

- canonical Mini-Block/Production Shot;
- Storyboard artifact;
- Previs timing;
- cinematography selection;
- camera movement;
- continuity locks;
- approved references;
- Render Plan addresses;
- generation revision/provenance.

Observed facts come from actual media measurements plus bounded annotations.

### CONTINUITY

Compare the end state of one unit with the start state of the next.

For a technical Mini-Block:

```text
C01-B -> C02-A
C02-B -> C03-A
...
C24-B -> C25-A
```

Continuity evidence attaches to the exact address pair, not a vague sequence-level note.

---

## Boundary discovery rule

### Unknown reference media

Boundary detection is legitimate because PlotPickle does not know the source film's cuts.

```text
reference media
 -> detect likely boundaries
 -> measure shots
 -> model annotation
 -> deterministic validation
```

### PlotPickle-generated render media

The canonical technical boundaries already exist.

```text
RenderClipSlot addresses
 -> generated files
 -> measure output
 -> annotate
 -> compare against intent
```

Do not use scene detection to replace or renumber the existing technical grid.

A detector may only identify an unexpected internal cut as a diagnostic finding.

---

## Evidence contract — required separation

The first implementation should make a hard structural distinction between machine-derived evidence and model annotation.

### Machine-owned / immutable after measurement

Candidate fields:

```text
sourceMediaRef
sourceMediaHash
analyzerVersion
container/codec metadata
durationSeconds
width / height
fps
canonicalRenderAddress
boundary evidence for unknown/reference media
measuredMotion
AFrameRef
BFrameRef
contactSheetRef
generation/source revision refs
measurement timestamp
```

Model code must not be able to silently replace these values.

### Model-owned bounded annotations

Start small:

```text
shotSize
shotCategory
cameraMovement
visibleDescription
continuityObservation
```

The annotation layer cannot invent:

- duration;
- technical address;
- file identity;
- canonical character/location/story fact;
- measured motion;
- project revision.

---

## Findings contract

Every finding should preserve enough evidence to reproduce it:

```text
id
mode: reference | verify | continuity
projectId? / revision?
Block / Mini-Block ref?
ProductionShot ref?
render address or address pair?
expected refs
observed media refs
measurement refs
annotation refs
gate id + version
severity
blocking | advisory
concise explanation
analyzer version
optional model/provider/runtime provenance
stale | skipped | unavailable state
createdAt
later disposition / repair evidence
```

No hidden chain-of-thought, credentials or unnecessary story text.

---

## Initial deterministic gates

### G1 — Render address coverage

For a Mini-Block with a ready technical render plan, verify which canonical addresses have actual media outputs.

Missing media is a failure/finding, not an empty placeholder treated as evidence.

### G2 — Duration

Measured duration must agree with the applicable expected timing/tolerance.

For the standard technical preset, each render clip is expected to be 3 seconds.

### G3 — Mini-Block technical coverage

For the two-hour preset, 25 technical clips represent 75 seconds of technical coverage.

This validates technical coverage only; it does not imply 25 creative shots.

### G4 — Machine evidence integrity

Model/annotation operations cannot rewrite machine evidence.

### G5 — A/B evidence integrity

Required extracted frames must exist or be reported `missing/unavailable`. Never fabricate evidence thumbnails.

### G6 — Camera claim vs measured motion

One-sided deterministic rule:

- claimed meaningful camera movement + near-zero measured image change => strong contradiction / blocker candidate;
- claimed static + high measured image change => advisory only because subject motion may explain it.

### G7 — Continuity handoff

The exact `N-B -> N+1-A` lineage must be available for every continuity comparison being claimed.

### G8 — Revision/provenance compatibility

Do not compare generated output silently against an incompatible current Storyboard/Previs revision.

Return `stale` or fail closed according to the owning revision contract.

### G9 — Annotation vocabulary/schema

Annotation fields are bounded and validated.

### G10 — Skipped is not passed

Unavailable measurement/model capability must be shown as `skipped/unavailable`, never converted into green evidence.

Every blocking gate needs a breaking test fixture proving it actually catches its intended defect.

---

## A/B frame policy

Adapt the ReelBench pattern without coupling to its exact implementation:

- extract one frame safely inside the beginning portion of the unit;
- extract one frame safely inside the ending portion;
- avoid transition-edge frames when practical;
- use A/B within-unit comparison for framing/motion evidence;
- use prior-B / next-A comparison for continuity;
- generate a compact contact sheet or equivalent PlotPickle-native review artifact for one bounded Mini-Block.

The first UI/report should be evidence-first and lazy. Do not load 25 full-resolution videos just to inspect continuity.

---

## Runtime/tooling audit before implementation

GitHub code search shows PlotPickle has a `build/lazy-frames-gateway.ts` path whose doctor flow already checks local `ffmpeg` readiness through Lazy Frames.

Current repository search does **not** show a canonical PlotPickle-owned `ffprobe` integration.

Therefore the first implementation must audit rather than assume:

1. whether the existing Lazy Frames path can supply needed duration/frame extraction safely;
2. whether ffmpeg and ffprobe are bundled, system-provided, optional, or missing on packaged Windows;
3. whether calling the binary directly would duplicate an existing media-runtime owner;
4. whether a tiny PlotPickle media-probe adapter should sit in front of any external binary;
5. how unavailable local media inspection is reported without installing anything silently.

No silent dependency install is permitted.

---

## Generated video asset/provenance owner — explicit pre-start audit

The current Previs contract clearly owns Production Shot intent and technical render addresses. The current workspace can display Storyboard media and has visual-generation/provenance infrastructure, but before Sequence Evidence persists generated-video analysis we must identify the single current owner for:

- generated video file/asset reference;
- provider/job provenance;
- generation base revision;
- candidate/approved state;
- parent/continuation lineage.

**Do not create a new media asset store merely because that owner is not obvious.**

Slice A must document the existing owner or document the minimal compatibility adaptation needed.

This is the main remaining ownership question before implementation.

---

## Revision/stale rule

`ProductionShotIntent` already stores `storyboardDependencyKey` and is tied to a Human-kept Storyboard artifact.

Sequence Evidence should compare against the same dependency/revision lineage.

At minimum:

```text
generated output provenance
 + Production Shot dependency
 + current Storyboard/PPF revision
 -> compatible | stale | invalid
```

Only compatible evidence should be used for an authoritative current VERIFY result.

Stale evidence remains inspectable/history evidence but cannot silently certify current intent.

---

## Repair rule

A finding may recommend or initiate an existing bounded repair/regeneration route only under current authority/consent policy.

The repair worker does not mark the finding fixed.

Required loop:

```text
finding
 -> bounded repair/regeneration
 -> new output/provenance
 -> rerun the same independent measurements + gates
 -> resolved or still failing
```

This mirrors PlotPickle's broader principle that an AI repair does not grade itself.

---

## Provider/model authority

Sequence Evidence does not select models/providers.

- deterministic measurements use reviewed local capability where available;
- optional visual annotation uses current PlotPickle inference/provider routing;
- Visual Compute Harness remains generation authority;
- no silent Local -> paid Cloud fallback;
- no Sequence Evidence-specific credentials;
- unavailable capability is explicit.

---

## Storage/scale

Do not instantiate or persist 2,400 empty evidence objects.

Render addresses remain derived.

Persist/cache only evidence that actually exists or is needed:

- analyzed reference media;
- generated output evidence;
- current/candidate/approved Production Shot evidence;
- findings and disposition;
- bounded review reports.

No full-feature scan at core startup.

Typical unit of work should be one:

- creative shot;
- Mini-Block;
- Sequence;
- explicit user/autonomous batch.

---

## Reference copyright/provenance guard

REFERENCE mode extracts facts and abstract film grammar. It must not silently turn an analyzed film into a PlotPickle story template.

Do not auto-import:

- dialogue;
- named characters;
- story beats;
- screenplay text;
- shot descriptions as new PlotPickle scenes;
- extracted frames as accepted project visual identity.

If the user deliberately imports a frame as a project reference, use the existing reference/asset acceptance path and preserve source status.

---

## ReelBench licensing decision

Upstream is Apache-2.0.

Preferred implementation strategy:

**adapt methodology, write PlotPickle-native contracts and tests.**

If any upstream code or asset is copied/materially adapted:

- preserve Apache license requirements;
- preserve NOTICE/attribution as applicable;
- record the source in PlotPickle provenance/source documentation;
- identify adapted files clearly;
- do not copy demo media or report assets unnecessarily.

---

## First implementation plan

### Slice A — reuse audit and contract

No broad feature work yet.

Audit and record:

1. Production Shot identity owner — expected: `core/contracts/previs/index.ts`.
2. Render address owner — expected: `RenderClipSlot` / `renderClipSlotsForAnchor()`.
3. Generated-video asset/provenance owner — must be resolved.
4. Local media measurement owner / ffmpeg availability — must be resolved.
5. Exact Cinematography Grammar fields to reuse for expected intent.
6. Current revision/stale comparison path.
7. Existing autonomous QA evidence format that can consume findings later.
8. Apache attribution requirements based on actual copied/adapted source.

### Slice B — deterministic Mini-Block proof

Use bounded fixtures / existing media refs to prove:

- addresses;
- output existence;
- durations;
- 25 × 3 s technical coverage;
- machine-readable evidence;
- missing/stale/skipped truthfulness;
- no model required yet.

### Slice C — minimal annotation + motion gate

Add only enough model-assisted analysis to prove:

- framing/camera annotation;
- measured-motion contradiction;
- blocker vs one-sided advisory distinction;
- model provenance.

### Slice D — continuity/contact-sheet proof

Produce A/B evidence for one Mini-Block and exact adjacent handoff findings.

### Slice E — REFERENCE mode

Only after PlotPickle-generated media verification is sound:

- unknown-media shot boundary detection;
- shot statistics;
- aggregate style evidence;
- no canon-copying path.

---

## Required tests

The implementation cannot merge without deterministic proof that:

- existing 24/96/2,400 owners are reused;
- variable creative shots remain separate from technical clips;
- generated mode cannot replace canonical render addresses with detected cuts;
- reference mode cannot create PPF authority;
- machine fields are immutable to annotation code;
- missing output is reported;
- duration mismatch is detected;
- A/B evidence cannot be fabricated;
- camera move + near-zero motion triggers the intended blocker;
- static + high motion remains advisory;
- skipped/unavailable is not pass;
- stale revision cannot silently certify current intent;
- findings preserve exact target/address/provenance;
- no direct PPF mutation exists;
- no provider/cost authority is added;
- no empty 2,400-record database appears;
- no core-startup media scan appears;
- repair requires independent re-measurement/revalidation;
- attribution tests/documentation cover any Apache-2.0 code actually adapted.

Normal BEN, production build and exact-head PR/Product gates remain authoritative.

---

## Pre-start answers

These are the ten questions from #1889's exit gate, with current status before coding.

### 1. Who owns creative shot identity?

**Known:** `ProductionShotIntent` in `core/contracts/previs/index.ts`.

### 2. Who owns 25 technical render addresses?

**Known:** `RenderClipSlot` / `renderClipSlotsForAnchor()` in `core/contracts/previs/index.ts`.

### 3. Who owns generated video refs/provenance?

**Open audit item:** resolve from current visual asset/generation architecture before persistence design.

### 4. Which local tooling measures duration/frames/motion on Windows?

**Partially known:** Lazy Frames doctor checks ffmpeg readiness; no canonical ffprobe owner found in initial repo search. Audit packaged runtime and existing adapter before adding anything.

### 5. Which fields are machine-immutable?

**Decision locked:** file/source identity, measured media metadata, canonical render address, boundary/timing measurements, motion measurements, extracted-frame refs, analyzer identity/version and source revision/provenance refs.

### 6. Which fields are model-owned?

**Decision locked for first version:** bounded shot size/framing, category, camera movement, concise visible description and bounded continuity observation. Prefer reuse of current cinematography vocabulary.

### 7. Which findings block vs advise?

**Decision locked:** deterministic contradictions may block; ambiguous reverse inference remains advisory. Missing/skipped capability is neither pass nor fabricated blocker unless the owning workflow requires that evidence to proceed.

### 8. How is stale comparison prevented?

**Direction locked:** compare output generation provenance with Production Shot/Storyboard dependency and current PPF revision; incompatible evidence is stale/fail-closed for current certification.

### 9. How is repair independently verified?

**Decision locked:** rerun the same measurement and deterministic gate against the new output. Repair authority cannot self-certify.

### 10. What ReelBench source is copied?

**Current intent:** none. Adapt methodology first. If code is later copied/materially adapted, document exact files and Apache attribution before merge.

---

## Stop conditions / non-goals

Do not use this work to:

- reopen #1425;
- redesign Previs;
- replace Production Shots;
- replace Cinematography Grammar;
- replace Visual Compute Harness;
- build an NLE;
- force 25 creative shots;
- render an entire feature as an acceptance test;
- add face recognition or ASR as required dependencies;
- install ffmpeg/models/nodes silently;
- auto-spend on cloud regeneration;
- write canon from reference analysis;
- auto-approve generated visual media;
- couple this work to Skin V1 baseline issue #1876.

## Ready-to-start threshold

Implementation may begin with **Slice A only** when the issue/brief is accepted.

Do not proceed into Slice B until Slice A records the two remaining ownership answers:

1. canonical generated-video asset/provenance owner;
2. canonical local media-measurement/runtime path on packaged Windows.

Once those are explicit, the rest of the first deterministic Mini-Block proof is sufficiently specified to build/test/fix without reopening architecture design.