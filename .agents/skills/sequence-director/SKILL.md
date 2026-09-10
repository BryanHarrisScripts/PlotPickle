---
name: sequence-director
description: Provider-neutral procedure for turning one approved 24/96 Mini-Block into PLAN intent, STORYBOARD visual beats, PREVIS timing and deterministic render-clip prompts.
license: MIT
metadata:
  author: PlotPickle
  version: "1.0.0"
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

## Provider and runtime boundary

The skill never chooses a provider, model or runtime. The PlotPickle host asks the plug-in registry for the selected capability implementation at generation time.

For the current Pascal/8 GB hardware profile, the reviewed local VIDEO registry selection is **LTX-Video 2B 0.9.8 Distilled** through the managed ComfyUI runtime. That is host policy/data, not a Sequence Director requirement. Different hardware or future plug-ins may resolve differently without changing this skill.

Image generation is optional support for Storyboard/Visualize and may use any reviewed image plug-in or manual imported references. It is not required for the Sequence Director contract.

## Authority boundary

This skill proposes and compiles; it does not persist or approve.

It cannot:

- mutate PLAN, Storyboard, Previs, PPF or story canon;
- mark a sequence, beat, shot, keyframe or render clip approved;
- choose or change providers, models, runtimes, API keys or cloud/local routing;
- download model weights, install custom nodes or execute arbitrary setup code;
- silently fall back to a cloud provider;
- generate 2,400 empty records in advance;
- convert the 25 technical render clips into fake creative shots.

## Source of truth

Canonical project state and explicitly Human-approved visual evidence are authoritative. PLAN owns story intent, Storyboard owns approved visual planning, Previs owns creative cinematic timing, and Render Plan derives the fixed technical clip addresses. Provider outputs remain candidates until accepted through the owning PlotPickle workflow.

## Host responsibilities

The PlotPickle host selects the active project and Mini-Block, retrieves approved references, validates structured skill output, presents proposals for Human review, performs accepted mutations, persists state, asks the plug-in registry for the active image/video capability, executes generation through reviewed adapters and records provenance.
