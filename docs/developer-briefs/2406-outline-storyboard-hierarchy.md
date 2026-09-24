# Developer Brief — #2406 Outline / Storyboard Story-to-Screen Hierarchy

## Problem

The current Outline and Storyboard surfaces contain the correct 24/96 structural scaffold and the newer inline Storyboard flow, but the Human-facing vocabulary still blurs story structure with visual capacity.

The most important ambiguity is the 25-position Mini-Block list. Those positions are not 25 Scenes and not 25 Beats. A Beat may require several Shots, a Shot is a directing/cinematography decision, and a Frame is the representative still for that Shot. The existing UI must stop implying row N equals Beat N.

## Canonical hierarchy

PlotPickle uses one nested story-to-screen hierarchy:

- Act
- Sequence
- Block
- Mini-Block
- Scene
- Beat
- Shot
- Frame

Ownership by stage:

- Outline: Sequence → Block → Mini-Block → Scene → Beat
- Storyboard: inherits Outline story structure and adds Shot → Frame
- Previs: adds motion, camera/timing execution intent
- Timeline: assembles shots/video, duration, dialogue, audio and edit order
- Production: executes and manages approved final-quality assets

## Mathematical scaffold

For the default 120-minute feature model:

- 4 Acts
- 12 Sequences
- 24 Blocks
- 96 Mini-Blocks
- 1 Sequence = 2 Blocks
- 1 Block ≈ 5 minutes
- 1 Mini-Block ≈ 75 seconds
- 25 Storyboard/render positions are available per Mini-Block

The scaffold is deterministic addressing and capacity. It is not a creative quota.

Scene count, Beat count and Shot count remain flexible. Scenes may span Mini-Blocks. A Mini-Block may contain part of one Scene or several short Scenes. A Beat may require one Shot or several Shots. Empty Storyboard positions remain valid.

## Human UX contract

### Outline

Outline must make the current structural location legible without requiring film-school terminology knowledge.

Show:

- selected Act;
- selected Sequence and its paired Blocks;
- selected Block;
- selected Mini-Block;
- a compact explanation that Scene = what happens and Beat = what meaningfully changes.

The surface should explicitly state that Outline owns story structure through Beat and does not prescribe fixed Scene or Beat counts.

### Storyboard

Storyboard must show the full hierarchy:

Sequence → Block → Mini-Block → Scene → Beat → Shot → Frame

It must explain:

- Scene and Beat come from story structure;
- Shot is how the director/cinematographer shows the Beat;
- Frame is the still image representing the Shot;
- the 25 positions are available Storyboard Shot/Frame positions, not 25 Beats.

The 25-position list must:

- be labeled as Storyboard positions / Shot-Frame capacity;
- use existing authored Shot evidence when available;
- use existing linked Frame evidence when available;
- remain open when no Shot exists;
- never assign Beat N to position N by index.

### Existing inline flow

Preserve the #2404 behavior:

- Storyboard remains one continuous surface;
- Scenes & Beats remain inline;
- Beat / Shot / Frame detail remains inline;
- Act / Block / Mini-Block navigation remains visible;
- no separate navigation hop is reintroduced.

## System / authority boundaries

Do not create a second Scene, Beat, Shot or Frame store.

Reuse:

- canonical PPF structure for Act / Sequence / Block / Mini-Block;
- semantic projection for Scene;
- Sequence Director Beat semantics for Beat;
- Storyboard editorial / Previs production shot projection for Shot;
- accepted/candidate visual artifact projection for Frame.

Current Shot contracts do not persist a canonical Beat ownership field. This issue must not invent Beat-to-Shot links. The UI may present Beats and Shots within the same Mini-Block hierarchy, but must not claim a specific Shot belongs to a specific Beat unless existing evidence explicitly establishes that relationship.

## Implementation

1. Add a compact hierarchy/context panel to Outline using the selected canonical Block's `sequenceNumber`.
2. Update Storyboard header/context to expose the selected Sequence and full hierarchy.
3. Rename 25-position terminology from Scene/Beat positions to Storyboard / Shot-Frame positions.
4. Replace the current `blockBeats[index]` row interpretation with selected Mini-Block Shot evidence.
5. For each position:
   - show an existing Shot when one exists at that ordinal;
   - show its linked Frame when available;
   - otherwise show an open Shot/Frame position;
   - keep the existing image selector as a working Frame selection without silently changing canonical approval state.
6. Add focused regression tests.

## Out of scope

- schema migration for explicit Beat → Shot ownership;
- changing the 24/96 scaffold;
- changing Render Plan's 25 technical slots;
- rebuilding Previs, Timeline or Production;
- introducing fixed Scene, Beat or Shot quotas;
- provider/model routing changes.

## Acceptance

- Outline visibly explains Sequence → Block → Mini-Block → Scene → Beat.
- Storyboard visibly explains Sequence → Block → Mini-Block → Scene → Beat → Shot → Frame.
- Selected Sequence is derived from canonical structure, not guessed from display order.
- No current Storyboard copy presents the 25 positions as 25 Beats or 25 Scene/Beat positions.
- No position row maps to `blockBeats[index]`.
- Existing Shot/Frame evidence occupies matching Storyboard positions when present.
- Empty positions remain empty.
- #2404 inline continuity stays intact.
- Focused tests and normal CI pass.
