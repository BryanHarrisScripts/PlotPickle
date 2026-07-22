# Phase 1: Core schema upgrade

Phase 1 establishes schema `1.7.0` as the data foundation for six connected capabilities. The implementation is intentionally kept in pure project operations so the Story Planner, Structure Engine, Screenplay Writer, Settings and Reports can all use the same rules.

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

The project operations provide:

- add scene;
- remove scene;
- move scene up or down;
- apply an explicit drag-and-drop order;
- move a mini-block from one scene to another; and
- automatically reindex scene number and order.

When a scene is removed, its mini-blocks and thread links move to a neighbouring scene. A locked scene cannot be removed or reordered. Adding or removing scenes redistributes the block's scene-duration estimate without changing the block runtime.

The four mini-blocks remain the story-function layer for each block. A writer may create more than four screenplay scenes inside a block; scenes beyond the available mini-blocks can remain unassigned until the writer deliberately redistributes the mini-block evidence.

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

A snapshot captures the story fields, block spine, dynamic scene order, screenplay elements, character arcs and Story Threads at a named moment.

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
- expanded metadata on existing screenplay elements;
- a blank rights and provenance ledger; and
- an empty revision history.

The original `schema/plotpickle-project.schema.json` remains available for current 1.6 exports during the UI transition. The Phase 1 schema is `schema/plotpickle-project-v1.7.schema.json`. Once the six UI surfaces use the migration adapter, schema 1.7 can become the default export without breaking existing saved projects.

## Implementation source

- `lib/project-phase-one.ts`
- `schema/plotpickle-project-v1.7.schema.json`
- `tests/phase-one-core-schema.test.mjs`
