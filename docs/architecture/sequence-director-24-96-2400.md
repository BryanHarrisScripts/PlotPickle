# Sequence Director — PLAN / STORYBOARD / PREVIS within 24 / 96 / 2,400

## Product decision

PlotPickle needs a reusable **Sequence Director** process, not a model-specific feature and not a GIF/sprite workflow.

The process turns one canonical story unit into a reference-aware, continuity-aware, ordered visual sequence that can be developed across:

**PLAN → STORYBOARD → PREVIS → RENDER PLAN → GENERATE**

It sits inside the existing structure:

**4 Acts → 12 Sequences → 24 Blocks → 96 Mini-Blocks → Human-authored creative timing → 25 × 3-second render clips per Mini-Block → 2,400 render clips**

No second story database is introduced.

## What is being adapted

The useful technique is the **process grammar**, not any particular example, provider, model or finished sequence:

1. explicit reference map;
2. global continuity locks;
3. ordered visible action;
4. rhythm/density progression;
5. camera and motion intent;
6. start-state → action → end-state causality;
7. sound intent where useful;
8. hard rules that say what must not change;
9. deterministic handoff from one time segment to the next.

PlotPickle adapts that grammar to its own 24/96/2,400 architecture rather than reproducing a long multi-shot prompt verbatim.

## Provider-neutral architecture

Sequence Director never requires GPT-Image, MiniMax, LTX, Wan, or any other specific model.

```text
PLAN / STORYBOARD / PREVIS
        ↓
Sequence Director
        ↓
Capability request: image or video
        ↓
PlotPickle plug-in registry
        ↓
Reviewed adapter
        ↓
Runtime such as ComfyUI / Ollama / cloud provider
```

A provider can be replaced without rewriting Sequence Director.

### Current local VIDEO default

For PlotPickle's current **NVIDIA Pascal / 8 GB / 32 GB RAM** hardware profile, the local plug-in registry ranks:

**LTX-Video 2B 0.9.8 Distilled**

as the automatic local VIDEO plug-in through managed ComfyUI.

MiniMax H3 remains an advanced plug-in for hardware profiles where the registry marks it compatible. This hardware selection is registry data, not Sequence Director logic.

Image generation can assist Storyboard/Visualize through any reviewed image plug-in or manual import. No image provider is mandatory.

## Canonical ownership

### PLAN owns intent

PLAN provides the canonical dramatic evidence:

- Block / Mini-Block address;
- purpose;
- objective and resistance;
- action / revelation / turn;
- entry and exit states;
- setup / payoff;
- active characters and locations.

Sequence Director may propose rhythm, continuity locks and a visual movement plan, but it cannot mutate PLAN automatically.

### STORYBOARD owns visible planning

Storyboard translates approved intent into a **variable number of creative visual beats or shots**.

Each visual beat can define:

- visible action;
- purpose;
- composition/camera intent;
- continuity-in;
- continuity-out;
- density/rhythm;
- sound intent as planning evidence.

Creative shot count is deliberately variable.

**A creative Storyboard/Previs shot is not a technical render clip.**

### PREVIS owns cinematic timing

Previs adds:

- exact duration;
- camera movement;
- framing;
- transitions;
- motion continuity;
- editorial rhythm;
- sound/silence intent.

For the original two-hour preset, the creative timing covering a Mini-Block must total **75 seconds** before its Render Plan is ready.

### RENDER PLAN owns technical generation addresses

Render Plan projects approved Previs timing onto the existing deterministic grid:

- 25 clips per Mini-Block;
- 3 seconds per clip;
- 100 clips per Block;
- 2,400 clips per feature;
- shared first/last boundary continuity.

Sequence Director does not persist 2,400 empty records. It derives prompts for a render address only when the host needs them.

## Adapted render-clip prompt grammar

Instead of attempting to reproduce a long multi-shot sequence in one generation, PlotPickle compiles the approved sequence into stable 3-second technical units.

Each generated clip receives:

```text
=== PLOTPICKLE RENDER CLIP ===
ADDRESS

=== REFERENCE MAP ===
Role-scoped approved references

=== WHAT STAYS ===
Character / location / wardrobe / lighting / style / continuity locks

=== START STATE ===
Exact boundary inherited from the previous clip

=== WHAT CHANGES IN THIS CLIP ===
Only the approved action and camera progression for this interval

=== END STATE ===
Stable handoff into the next boundary

=== MOTION FLOW ===
Physical and camera continuity instruction

=== HARD RULES ===
Explicit exclusions and invariants
```

This preserves the strongest part of reference-heavy generation prompting while fitting PlotPickle's deterministic production model.

## Why this is better for local generation

A local video plug-in such as LTX-Video can work on one bounded technical clip at a time rather than being asked to generate a long sequence with many editorial changes in one inference.

Benefits:

- lower local memory/compute pressure;
- deterministic addresses;
- easier retries;
- better first-frame/last-frame continuity;
- one weak clip can be regenerated surgically;
- references and hard rules remain stable;
- creative planning stays separate from provider limitations.

The production grid is therefore a generation strategy, not a storytelling formula.

## Reference map

References are role-scoped so a model is not expected to infer what every image controls.

Supported roles include:

- character identity;
- location;
- prop;
- wardrobe;
- lighting;
- style;
- approved Storyboard visual;
- continuity reference;
- other approved evidence.

The host retrieves and supplies only approved project evidence. Sequence Director does not invent missing source assets.

## PLAN workflow

For a selected Mini-Block:

1. read canonical evidence;
2. gather approved reference candidates;
3. propose purpose/rhythm/motion flow;
4. propose continuity locks;
5. propose hard rules;
6. return a draft for Human approval.

No provider selection and no technical render clips occur in PLAN.

## STORYBOARD workflow

1. start from approved PLAN intent;
2. create ordered visual beats;
3. define causal visible progression;
4. identify reference use per role;
5. maintain state handoff from beat to beat;
6. allow Human review/reorder/rewrite;
7. keep accepted Storyboard evidence attached to the canonical Mini-Block anchor.

## PREVIS workflow

1. inherit approved Storyboard beats;
2. add camera/movement/transitions;
3. author exact timing;
4. require full Mini-Block coverage before Render Plan readiness;
5. derive the 25 technical clip addresses;
6. compile a render prompt for each needed clip;
7. request the active VIDEO plug-in from the registry;
8. generate candidates through the reviewed adapter;
9. preserve candidate/approved distinction and provenance.

## Plug-in rule

Sequence Director requests a **capability**, never a model name.

```text
Sequence Director → VIDEO capability
                    ↓
             local plug-in registry
                    ↓
       hardware-compatible recommendation
```

Today that may resolve to LTX-Video on an 8 GB Pascal system. A future plug-in can replace it through registry metadata and a reviewed adapter without changing PLAN, Storyboard, Previs or Sequence Director.

## Non-goals

This first boundary does not:

- create a standalone new story model;
- force 16 shots or any fixed creative shot count;
- equate 25 render clips with 25 creative shots;
- hard-code an image provider;
- hard-code a video provider into Sequence Director;
- silently download model weights or nodes;
- silently use paid/cloud generation;
- mutate story canon from generated output;
- build a GIF pipeline.

## Phase 0 implementation

The first implementation provides:

- `core/contracts/sequence-director/index.ts` — normalized provider-neutral draft and render-address contract;
- `lib/sequence-director.ts` — canonical project seeding, PLAN/STORYBOARD/PREVIS brief compilation, Previs timing readiness and deterministic render-prompt compilation;
- `.agents/skills/sequence-director/SKILL.md` — host/skill authority procedure;
- focused regression tests.

This establishes a headless reusable boundary. UI controls in PLAN, Storyboard and Previs should consume this boundary rather than rebuilding model-specific sequence logic in each screen.

## Acceptance rules

The architecture is correct when:

1. one canonical Mini-Block can seed a Sequence Director proposal without mutating the project;
2. PLAN, Storyboard and Previs receive different views of the same sequence draft;
3. creative beat count remains variable;
4. Previs timing is separate from the 25-slot production grid;
5. exactly 25 × 3-second render addresses are derived for a complete Mini-Block;
6. each technical clip prompt carries reference locks, start state, local change, end state and hard rules;
7. Sequence Director source contains no required image/video model name;
8. the host's video plug-in registry remains responsible for choosing the current local default;
9. current Pascal/8 GB registry data continues to select LTX-Video 2B 0.9.8 Distilled;
10. no project-specific sample content is embedded in the feature.
