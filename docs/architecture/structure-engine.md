# Structure Engine

## Purpose

The Structure Engine restores the complete timed hierarchy beneath PlotPickle's 24 Blocks method:

**4 Acts → 12 Sequences → 24 Blocks → Flexible Scenes → 96 Mini-Blocks → Beats → Storyboard → Visualize → Previs → Render Plan → Generate**

The 24/96 scaffold is the story and timing architecture. The fixed production grid begins only after Human-authored Previs timing is complete.

## 12-Sequence Navigator

Each act contains three sequences. Each sequence contains two blocks and records:

- question;
- promise;
- escalation;
- climax;
- turning point;
- result carried into the next sequence;
- target runtime.

The default sequence progression is:

1. Awakening
2. Discovery
3. Alliance
4. Conflict
5. Struggle
6. Pivot
7. Apex
8. Turn
9. Reveal
10. Fallout
11. Mending
12. Legacy

These names are editable starting points rather than mandatory genre beats.

## Flexible Scenes

Every block begins with two scene containers as a practical starting point:

- Scene 1 establishes the block objective and develops the first meaningful pressure.
- Scene 2 deepens the conflict, forces action or choice, and creates the consequence that exits the block.

The scene count is flexible. Scene records can represent one screenplay scene, a continuous movement, or a container for several short scenes.

## 96 Mini-Blocks

Every block contains four Mini-Blocks:

1. Promise
2. Progress
3. Pressure
4. Payoff

Each Mini-Block can record story purpose, active character, objective, resistance, action, revelation, turn, visual beat, dialogue intention, entry/exit state, setup/payoff, notes and beat planning.

For the original two-hour preset, each Mini-Block is a **75-second production container**.

## Original two-hour preset

The default 120-minute model distributes time evenly:

- 30 minutes per act;
- 10 minutes per sequence;
- 5 minutes per block;
- 75 seconds per Mini-Block.

The canonical production math is now:

- **25 technical render clips per Mini-Block**;
- **3 seconds per render clip**;
- **100 render clips per 5-minute Block**;
- **2,400 render clips across the 2-hour feature**;
- **26 local boundary keyframes per Mini-Block** when viewed in isolation;
- **2,401 shared boundary keyframes across the continuous feature** because the end frame of one clip is the start frame of the next.

The previous default of roughly 16 editorial shots per Mini-Block / approximately 4.69 seconds per shot is retired as a canonical 24/96 production target.

## Creative shots versus render clips

A **creative Previs shot** is Human-authored cinematic intent: framing, camera movement, lens, transition and duration.

A **render clip** is a technical generation unit with a fixed 3-second duration in the default production grid.

These are intentionally different concepts. A nine-second creative dolly shot may span three render clips. A fast editorial sequence may place multiple creative decisions across neighbouring clip slots. PlotPickle does not inflate render clips into fake story shots.

The production address stays deterministic:

`Block 07 → Mini-Block 03 → Clip 18`

That stable address allows one failed or weak generation to be replaced without regenerating the rest of the Mini-Block or movie.

## Storyboard → Visualize → Previs → Render Plan

### Storyboard

Defines what the story needs the audience to see at each canonical Mini-Block anchor.

### Visualize

Establishes approved visual references for characters, locations, wardrobe, lighting, style and continuity.

### Previs

Authors the cinematic plan: creative shots, camera movement, framing, transitions and timing. The creative timing for a default Mini-Block must total 75 seconds before its Render Plan is considered ready.

### Render Plan

Projects the approved 75-second Previs timeline onto **25 fixed 3-second generation slots**. This grid is deterministic and derived; PlotPickle does not need to persist thousands of empty clip records before the Human actually plans or generates them.

### Generate

Runs the selected provider/runtime against individual render slots, preserves start/end anchor continuity, allows surgical re-generation and assembles approved clips back into the Previs timeline.

## Keyframe continuity

For one 75-second Mini-Block:

```text
Keyframe 0 → Clip 01 (3s) → Keyframe 1
                         Keyframe 1 → Clip 02 (3s) → Keyframe 2
                                                     ...
                         Keyframe 24 → Clip 25 (3s) → Keyframe 25
```

The boundary frame is shared between neighbouring clips. Across the complete two-hour feature this produces 2,400 render clips and 2,401 unique boundary keyframes.

Storyboard/Visualize anchors and render-boundary keyframes are not the same layer. The 96 canonical visual anchors provide creative continuity and evidence; the Render Plan derives the finer production interpolation grid after Previs.

## Cost is provider data, not architecture

The render grid makes cost estimable because the number and duration of default render slots are known in advance. PlotPickle must not hard-code a universal dollar amount into the architecture. Provider pricing can change and may be billed per generation, per second, by resolution, by compute tier or by another unit.

Settings/provider metadata can therefore calculate an estimate from the deterministic grid while keeping the production model provider-independent.

## Story Clock

The Story Clock calculates start time, end time and duration for sequence, block, scene and Mini-Block planning.

Changing the project target runtime can rebalance story timing in flexible projects. The **original 120-minute / 24–96 render preset** remains the deterministic production preset described above: 75 seconds per Mini-Block and 25 × 3-second render clips per Mini-Block.

Creative shot rhythm remains a Previs decision rather than a Structure Engine quota.

## Canonical field mapping

The story hierarchy remains attached to the canonical project and PPF evidence:

- sequences organize the twelve major movements;
- Blocks preserve the 24-part causal spine;
- flexible scenes organize screenplay movement;
- Mini-Blocks provide the 96 canonical story/visual timing addresses;
- Storyboard/Visualize assets remain evidence attached to those addresses;
- Previs stores Human-authored creative shot intent;
- Render Plan clip addresses are derived deterministically from Block + Mini-Block + clip number.

Legacy 1.x project structures may still contain historical `shotTarget` or `averageShotSeconds` fields for backward compatibility. They are not the canonical production quota for the current PPF/Previs render-plan path.

## Relationship to other engines

- **Story Planner** defines the story foundation and 24-block spine.
- **Structure Engine** expands that spine into sequences, flexible scenes, 96 Mini-Blocks, beats and time.
- **Resonance Engine** tests how the structure accumulates meaning.
- **Voiceprint Engine** develops character-specific language.
- **PageFlow Engine** converts planned movement into visible screenplay writing.
- **DraftLens Engine** diagnoses the completed draft.
- **CraftLoop Engine** coordinates deliberate practice.
- **Storyboard / Visualize** establishes visual story evidence and continuity.
- **Previs** authors cinematic execution and timing.
- **Render Plan** converts the approved 75-second Mini-Block into 25 deterministic 3-second generation slots.

The connected production hierarchy becomes:

**Plan the story → organize the sequence → build the scene → turn the Mini-Block → storyboard it → visualize it → previs it → render-plan it → generate only what is needed.**
