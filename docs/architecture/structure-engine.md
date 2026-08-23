# Structure Engine

## Purpose

The Structure Engine restores the complete timed hierarchy beneath PlotPickle's 24 Blocks method:

**4 Acts → 12 Sequences → 24 Blocks → 48 Scenes → 96 Mini-Blocks → Beats → Shots**

It bridges the gap between five-minute block planning and page-level screenplay writing. The engine is a structural planning tool, not a rigid production formula. Writers may change timing, beat targets, shot targets, titles, functions, and scene content while preserving the hierarchy.

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

## 48 Scenes

Every block begins with two scenes:

- Scene 1 establishes the block objective and develops the first meaningful pressure.
- Scene 2 deepens the conflict, forces action or choice, and creates the consequence that exits the block.

Each scene stores objective, conflict, turn, resolution, outcome, active characters, locations, and estimated duration.

The default two-scene design may be interpreted flexibly. A writer can treat the scene records as scene movements, sequences of continuous action, or containers for multiple short screenplay scenes when the project requires it.

## 96 Mini-Blocks

Every block contains four mini-blocks, divided two per scene:

1. Promise
2. Progress
3. Pressure
4. Payoff

Each mini-block can record:

- purpose;
- active character;
- objective;
- resistance;
- action;
- revelation;
- turn;
- visual beat;
- dialogue intention;
- entry and exit states;
- setup and payoff connections;
- notes;
- estimated seconds;
- beat target;
- shot target.

The mini-block layer gives PageFlow and Visual Board a smaller dramatic unit to work from without replacing the canonical block screenplay text or visual frames.

## Original two-hour preset

The default 120-minute model distributes time evenly:

- 30 minutes per act;
- 10 minutes per sequence;
- 5 minutes per block;
- 2.5 minutes per scene;
- 75 seconds per mini-block.

The default planning estimates are:

- 4 beats per mini-block;
- 16 shots per mini-block;
- 16 beats and 64 shots per block;
- 384 beats and 1,536 shots across the feature;
- calculated average shot length of approximately 4.69 seconds.

These are reference targets, not requirements. The writer can change them at any mini-block.

## Story Clock

The Story Clock calculates start time, end time, duration, beat total, and shot total for every sequence, block, scene, and mini-block.

Changing the project target runtime can rebalance all timing allocations. Rebalancing changes duration fields only and does not overwrite story content.

Pacing profiles provide reference average-shot-length values:

- Original 24/96 feature: 4.6875 seconds;
- Contemplative: 8.5 seconds;
- Moderate: 6 seconds;
- Propulsive: 3.5 seconds;
- Custom: writer-defined.

The calculated story clock always uses the current mini-block durations and shot targets, so manual choices remain visible.

## Canonical field mapping

The hierarchy is stored in schema 1.4:

- `project.structure.sequences` stores the twelve sequence records;
- `block.sequenceNumber` connects each block to one sequence;
- `block.targetMinutes` stores the block allocation;
- `block.scenes` stores two scene records;
- `scene.miniBlocks` stores two mini-blocks per scene;
- mini-block timing, beats, and shots power the Story Clock.

Existing block fields remain canonical for block-level cause, screenplay text, storyboard direction, and visuals.

## Migration

PlotPickle projects using schema 1.0 through 1.3 are upgraded automatically:

- twelve default sequences are created;
- blocks are assigned to sequences in pairs;
- two scenes are created for every block;
- four mini-blocks are created for every block;
- original project content remains attached to its existing block, character, world, story, dialogue, and note fields.

No old block text or visual data is replaced.

## Relationship to other engines

- **Story Planner** defines the story foundation and 24 block spine.
- **Structure Engine** expands that spine into sequences, scenes, mini-blocks, beats, shots, and time.
- **Resonance Engine** tests how the structure accumulates meaning.
- **Voiceprint Engine** develops character-specific language.
- **PageFlow Engine** converts planned movement into visible screenplay writing.
- **DraftLens Engine** diagnoses the completed draft.
- **CraftLoop Engine** coordinates deliberate practice.
- **Visual Board** preserves the image plan and continuity.

The connected production hierarchy becomes:

**Plan the story → organize the sequence → build the scene → turn the mini-block → write the page → see the film.**
