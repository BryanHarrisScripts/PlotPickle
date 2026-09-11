---
name: sequence-director
description: Provider-neutral procedure for turning one approved 24/96 Mini-Block into PLAN intent, STORYBOARD visual beats, PREVIS timing, deterministic render-clip prompts and post-generation Sequence Evidence.
license: MIT
metadata:
  author: PlotPickle
  version: "1.1.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/sequence-director
  progressiveDisclosure: true
---

# Sequence Director

Use this skill for a host-selected canonical Mini-Block. It adapts reference-first continuity planning, ordered visible action, timing, motion flow and hard-rule constraints into PlotPickle's existing **24 Blocks → 96 Mini-Blocks → Previs → 2,400 render clips** production architecture.

The skill does **not** require any one image or video model. Model/runtime selection belongs to the PlotPickle host and local/cloud plug-in registry.

## PLAN procedure

1. Read only the host-provided canonical Block, Scene and Mini-Block evidence plus explicitly approved references.
2. Preserve the writer's purpose, entry state, exit state, setup, payoff, characters and locations.
3. Propose a concise sequence intent: purpose, rhythm, motion flow, continuity locks and hard rules.
4. Identify reference roles such as character, location, prop, wardrobe, lighting, style and approved storyboard evidence. Do not invent unavailable references.
5. Keep the proposal provider-neutral. Do not name, select or configure an image/video model.
6. Return a structured proposal for Human review. PLAN does not author technical render clips.

## STORYBOARD procedure

1. Start from the approved PLAN sequence intent and the canonical Mini-Block anchor.
2. Break the movement into a variable number of ordered **creative visual beats**. Do not equate creative beats or shots with the 25 technical render clips.
3. For each beat describe only visible action, camera intent when useful, continuity-in, continuity-out, density/rhythm and optional sound intent.
4. Keep references role-scoped: identity references control identity, location references control location, continuity references control approved visual state.
5. Preserve causal handoff: each beat begins from the state produced by the previous beat.
6. Storyboard output remains proposal material until the Human approves it. It cannot silently rewrite PLAN or story canon.

## PREVIS procedure

1. Start from the Human-approved Storyboard sequence.
2. Author camera, movement, transition and exact timing for every creative beat.
3. For the original 120-minute preset, the complete Mini-Block timing must cover **75 seconds** without gaps before Render Plan is ready.
4. Project the approved timing onto PlotPickle's existing **25 fixed 3-second render clips**. This is a technical generation grid, not a replacement creative shot structure.
5. Compile each render clip with the same stable grammar:
   - production address;
   - approved reference map;
   - what stays fixed;
   - start boundary state;
   - what changes during this clip;
   - end boundary state;
   - motion-flow instruction;
   - hard rules.
6. Preserve first-frame/last-frame continuity between neighbouring clips so one weak clip can be regenerated without rebuilding the full Mini-Block.

## SEQUENCE EVIDENCE procedure

Use Sequence Evidence after generation to verify what the media actually contains. It is an evidence stage under the existing Sequence Director, not a new Storyboard, Previs, render grid, asset database, provider or agent framework.

1. Derive the expected technical addresses from the host's canonical `RenderClipSlot` grid. Never rediscover, renumber or replace PlotPickle addresses from generated media.
2. Resolve actual generated media and provenance through the current PlotPickle project-asset registry. Do not invent a second generated-video store.
3. Measure deterministic facts locally where reviewed capability exists: file identity/hash, duration, media metadata, bounded A/B frame evidence and measured frame change. If a capability is skipped or unavailable, report that state explicitly instead of converting it to a pass.
4. Keep machine evidence structurally separate from optional model annotation. Model annotation may use only the reviewed bounded shot/framing/camera/continuity vocabulary and cannot replace addresses, timing, hashes, revision or measured values.
5. Compare evidence against current Production Shot, Storyboard dependency, Previs timing, Cinematography Grammar and generation provenance using the reviewed Sequence Evidence gates.
6. Preserve the one-sided motion rule: expected meaningful camera movement plus near-zero measured change may block; static intent plus high image change is advisory because subject/environment motion can explain it.
7. For continuity, compare the exact previous end / next start lineage (`N-B -> N+1-A`). Never fabricate a missing boundary frame or claim continuity when the neighboring evidence is unavailable.
8. Return exact-address findings for Human review. A repair/regeneration may use an existing reviewed route only under current consent/budget policy, then independent Sequence Evidence must rerun before the finding can be considered resolved.

REFERENCE analysis of user-supplied or otherwise authorized external media may discover unknown shot boundaries and summarize measurable film grammar. Reference evidence is observational only and has no PPF canon authority; do not import dialogue, characters, story beats or shot-by-shot copyrighted expression into canon.

## Provider and runtime boundary

The skill never chooses a provider, model or runtime. The PlotPickle host asks the plug-in registry for the selected capability implementation at generation time.

For the current Pascal/8 GB hardware profile, the reviewed local VIDEO registry selection is **LTX-Video 2B 0.9.8 Distilled** through the managed ComfyUI runtime. That is host policy/data, not a Sequence Director requirement. Different hardware or future plug-ins may resolve differently without changing this skill.

Image generation is optional support for Storyboard/Visualize and may use any reviewed image plug-in or manual imported references. It is not required for the Sequence Director contract.

Sequence Evidence may use reviewed local media-inspection capability when available and optional visual-model annotation through the existing provider routes. It does not install binaries, own credentials or silently fall back from local inspection to paid/cloud analysis.

## Authority boundary

This skill proposes, compiles and reports evidence; it does not persist canon or approve generated media.

It cannot:

- mutate PLAN, Storyboard, Previs, PPF or story canon;
- mark a sequence, beat, shot, keyframe, render clip or generated-media candidate approved;
- choose or change providers, models, runtimes, API keys or cloud/local routing;
- download model weights, install custom nodes or execute arbitrary setup code;
- silently fall back to a cloud provider;
- generate 2,400 empty records in advance;
- convert the 25 technical render clips into fake creative shots;
- silently regenerate failed clips or spend on repair;
- mark its own repair successful without a fresh independent evidence run.

## Source of truth

Canonical project state and explicitly Human-approved visual evidence are authoritative. PLAN owns story intent, Storyboard owns approved visual planning, Previs owns creative cinematic timing, Render Plan derives the fixed technical clip addresses, and the project asset registry owns generated-media identity/provenance. Provider outputs remain candidates until accepted through the owning PlotPickle workflow. Sequence Evidence observes and evaluates those outputs; it is not canon authority.

## Host responsibilities

The PlotPickle host selects the active project and Mini-Block, retrieves approved references, validates structured skill output, presents proposals and findings for Human review, performs accepted mutations, persists state, asks the plug-in registry for the active image/video capability, executes generation through reviewed adapters, records provenance, supplies reviewed local measurement capability when available, and independently reruns evidence after any repair.
