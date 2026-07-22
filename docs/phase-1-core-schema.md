# Phase 1: Core schema upgrade

Phase 1 establishes schema `1.7.0` as the data foundation for six connected capabilities. The implementation uses shared project operations so the Story Planner, Structure Engine, Screenplay Writer, Settings and Reports can all use the same rules.

## 1. Story Threads and subplot tracking

A Story Thread can represent the main plot, a subplot, a relationship, a mystery, a thematic argument or a world-system pressure.

Each thread stores:

- its current status;
- the dramatic question it keeps alive;
- participating characters;
- every linked scene;
- its introduction and resolution blocks; and
- milestone records for setup, development, turns, reveals, payoffs and resolution.

Thread links are reciprocal. Linking a thread to a scene updates both the thread and the scene, preventing separate screens from drifting out of sync.

## 2. Dynamic scene creation and reordering

The original schema assumed exactly two scenes per block. Schema 1.7 allows one or more scenes in every block while preserving the fixed 24 Blocks and 96 mini-block framework.

Forty-eight scenes remain the default feature-screenplay template. They are no longer a restriction. The Structure Engine reports the live scene count and supports a common forty-to-sixty-scene range without imposing either boundary.

The project operations and Structure Engine provide:

- add a scene after the selected scene;
- duplicate scene content without duplicating a structural mini-block;
- delete a scene while preserving its mini-block assignments;
- move a scene up or down inside a block;
- apply an explicit scene order;
- move a scene between blocks;
- assign any of the block's four mini-blocks to a different scene; and
- automatically reindex scene numbers and timing estimates.

Each full scene records:

- scene type: action, dialogue, suspense, revelation, montage, transition or other;
- entry and exit conditions;
- objective and opposition;
- visible action;
- reversal or turn;
- resolution and outcome;
- all participating characters;
- characters entering and leaving;
- duration in seconds; and
- screenplay page estimate.

The four mini-blocks remain the story-function layer for each block. A full scene may hold one to four mini-blocks. When a block needs more rapid scenes than its four structural anchors, a mini-block can contain multiple short scenes for montage, intercutting, transitions or brief location changes. Each short scene has its own type, entry condition, objective, opposition, action, reversal, outcome, character movement, duration and page estimate.

When a full scene is removed, its mini-blocks move to a neighbouring scene. Moving a scene to a different block leaves the source block's mini-blocks in place and assigns a spare target mini-block when one is available. This protects the 96-mini-block framework while allowing scene order and scene count to change freely.

## 3. Expanded screenplay element types

Screenplay drafts now recognize:

- scene heading;
- action;
- character;
- parenthetical;
- dialogue;
- transition;
- section;
- synopsis;
- shot;
- lyrics;
- dual dialogue;
- centred text;
- page break;
- title-page content;
- note; and
- boneyard or omitted material.

Each screenplay element can also carry a stable scene ID, Story Thread links, locked and omitted states, a revision colour, source-attribution references and AI-provenance references.

## 4. Character Arc Matrix

Every character gains an Arc Matrix alongside the existing character profile and Voiceprint fields.

The matrix tracks:

- starting state;
- conscious want;
- underlying need;
- protective lie;
- emerging truth;
- midpoint shift;
- crisis choice;
- climax choice;
- ending state;
- relationship impact; and
- scene-level checkpoints.

A checkpoint records the character's belief, strategy, pressure, choice, consequence and visible evidence at a selected scene or block. This makes the arc testable against the screenplay rather than leaving it as a summary paragraph.

## 5. Rights, attribution and AI provenance

The rights ledger separates ownership from attribution and tool use.

It records:

- project owner and copyright notice;
- rights statement and default creative licence;
- original, adapted, commissioned or collaborative status;
- collaborator contributions and ownership references;
- research, quotation, public-domain and licensed-source attributions; and
- AI provenance records.

An AI provenance record identifies the provider, model, operation, prompt and output summaries, the writer's human contribution, the human editorial decision, whether the result was retained and the project objects affected. API keys and provider secrets remain outside project files.

## 6. Revision snapshots and comparison

A snapshot captures the story fields, block spine, dynamic scene order, scene type and timing, mini-block assignments, short scenes, screenplay elements, character arcs and Story Threads at a named moment.

Snapshots include a deterministic content hash. The comparison operation reports:

- changed story fields;
- changed blocks;
- added, removed and changed scenes;
- added, removed and changed screenplay elements;
- changed character arcs; and
- changed Story Threads.

Snapshots are project data, not automatic cloud backups. They travel with the exported `.plotpickle.json` file and remain under the writer's control.

## Migration strategy

`upgradeProjectToPhaseOne()` accepts a normalized schema 1.6 project and returns a schema 1.7 project without discarding existing story, world, development, screenplay, character, block, scene, mini-block or visual data.

Migration adds:

- blank Story Threads;
- an Arc Matrix seeded from each existing character profile;
- stable scene order and revision metadata;
- dynamic scene fields with safe defaults;
- an empty short-scene list on every mini-block;
- expanded metadata on existing screenplay elements;
- a blank rights and provenance ledger; and
- an empty revision history.

The original `schema/plotpickle-project.schema.json` remains available for current 1.6 exports during the UI transition. The Phase 1 schema is `schema/plotpickle-project-v1.7.schema.json`. Once the six UI surfaces use the migration adapter, schema 1.7 can become the default export without breaking existing saved projects.

## Implementation source

- `lib/structure.ts`
- `app/structure/page.tsx`
- `lib/project-phase-one.ts`
- `schema/plotpickle-project-v1.7.schema.json`
- `tests/phase-one-core-schema.test.mjs`
- `tests/dynamic-scenes.test.mjs`
