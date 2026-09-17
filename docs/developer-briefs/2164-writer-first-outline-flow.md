# #2164 — Writer-first Outline → Storyboard → Previs clarity pass

## Purpose

The September 17 Human UAT showed that PlotPickle now has the required story and pre-production surfaces, but a writer still has to reverse-engineer internal pipeline terms before they can answer a simpler question: **what have I written here, what does this story address mean, and what should I do next?**

This pass keeps every existing authority and changes presentation, projection precision and writer-facing progression.

## Human walkthrough preserved

The tested path was:

`Logon → Library → Load → Examples → Afterglow → Dashboard → Outline → Block 01 → Promise / Progress / Pressure / Payoff → Storyboard → Visual Story / Scene Timeline → Previs`.

The Human explicitly preferred one horizontal row per Act, expected the selected Mini-Block to reveal its actual written screenplay material, could not infer the relationship between Block/Mini-Block and Scene/Beat/Shot/Frame, and interpreted PLAN / BUILD / STORYBOARD as three unexplained versions of the same workflow.

The Human also expected Previs to first answer a visual-coverage/preview question before exposing deep camera/timing controls.

## Source review findings

### Library

The packaged catalog already names the reference correctly: `Afterglow: Reflections of Sentience`. `Pacific road · AI family` is only `visualLabel` metadata, but it is visually foregrounded on the card. Load contains only durable user-owned projects and therefore provides no obvious path to the packaged Afterglow reference.

### PlotPickle Score

Score V1 is deterministic and uses the geometric mean of five factors. Alignment, Progression and Coverage are positive factors; Verbosity and Erosion are inverted. Therefore Alignment 100 / Verbosity 0 / Erosion 6 / Progression 100 / Coverage 100 legitimately rounds to 99. The formula is not changing; the panel needs to explain this.

### Story Map text projection

Imported screenplay passages already carry `blockNumber`, `miniBlockNumber` and `sceneNumber`. The current UI renders a Block-level `Background story text` projection, so changing Promise / Progress / Pressure / Payoff does not necessarily change the visible text. This is a projection/UI defect, not a missing-data problem.

### Current navigation vocabulary

The selected Block exposes PLAN / BUILD / STORYBOARD links even though the Human is already in Outline. This leaks implementation/frontier terminology into a writer-facing local workflow.

### Scene / Beat / Shot / Frame

The existing architecture is correct but insufficiently explained in-product:

- Block / Mini-Block = stable structural addresses;
- Scene / Beat = variable-density story content related to those addresses;
- Shot / Frame = variable-density visual/production content related to that story content;
- the relationship is not forced 1:1;
- the 96 Mini-Blocks and 2,400 technical render slots are address spaces, not creative Scene/Shot quotas.

## Implementation contract

### 1. Library discovery

- Preserve Load as user-owned saved stories.
- Add a visible handoff from Load to Examples for packaged references such as Afterglow.
- Make the actual catalog story title visually primary in the example visual treatment; demote `visualLabel` to descriptor metadata.

### 2. Score explanation

- Do not change Score V1 math.
- Add concise visible/expandable language explaining the geometric combination and that lower Verbosity/Erosion are inverted.
- Keep the score explicitly structural, not a creative-quality verdict.

### 3. Act-row Story Map

Render:

- Act 1: Sequences 01–03 left-to-right;
- Act 2: Sequences 04–06 left-to-right;
- Act 3: Sequences 07–09 left-to-right;
- Act 4: Sequences 10–12 left-to-right.

Turning points/finale remain attached to the end sequence of each Act and visually close the row.

No structural identity changes.

### 4. Written Story follows Mini-Block selection

- Add a Mini-Block-specific source-text projection derived only from real imported passages with the selected `miniBlockNumber`.
- Rename writer-facing `Background story text` to `Written Story`.
- Keep the whole-Block source projection available as secondary context.
- If no source passage exists for that Mini-Block, say so; never generate filler.

### 5. Writer-facing local progression

Primary local actions become:

`WRITTEN STORY → STORYBOARD → PREVIS`

Outline is already the current stage. Build remains an existing evidence/advanced authority available from downstream review surfaces but no longer competes as a primary story-shaping step in the selected Block inspector.

### 6. Explain the bridge to Scene/Beat/Shot/Frame

Add an in-context explanation before the Storyboard detailed projection:

`Block / Mini-Block = where you are in story structure. Scene / Beat = the authored story material at that address. Shot / Frame = how that material is visualized.`

State explicitly that these are relationships, not a forced one-to-one hierarchy.

### 7. Storyboard view naming

Preserve internal Visual Story / Scene Timeline identifiers and data contracts, but present the two writer-facing tabs as:

- `SCENE & SHOTS`
- `TIMELINE`

Explain that both are views over the same real Scene/Shot identities.

### 8. Previs visual-coverage summary

Before existing Previs timing/camera controls, show the selected Block's four Mini-Blocks with one of three evidence states:

- accepted visual;
- candidate visual(s), none accepted;
- no visual yet.

Use only existing visual artifacts and accepted IDs. Do not create shots or RenderClip substitutions.

## Runtime retest boundary

The Human also reproduced the old drop-out behavior for PLAN / BUILD / Storyboard / Previs. Those exact navigation defects were repaired in #2161 / PR #2163 and are on current main at `8d0a42d1948c9bb1236ff34d4cfcc2c9ccdbd1cc`.

Do not duplicate those systems in #2164. After this PR merges, the next Human UAT must restart/update against the merged head. Any continued drop-out is then a regression against #2161.

## Non-goals

- no change to PlotPickle Score V1 formula;
- no change to 4 Acts / 12 Sequences / 24 Blocks / 96 Mini-Blocks;
- no forced Scene/Beat/Shot count;
- no new story store;
- no new Build, Storyboard or Previs authority;
- no provider-policy change;
- no generated source screenplay text;
- no new baseline lock without Human review.

## Exit criteria

1. Afterglow is discoverable from Load via a clear Examples handoff and its title is visually dominant.
2. Score 99 with Erosion 6 is understandable without changing the formula.
3. Story Map reads one Act per horizontal row.
4. Promise / Progress / Pressure / Payoff selection changes the visible Written Story passages to the selected Mini-Block.
5. Selected Block primary actions are Written Story / Storyboard / Previs, not Plan / Build / Storyboard.
6. Block/Mini-Block versus Scene/Beat/Shot/Frame is explained in writer language.
7. Storyboard presents Scene & Shots / Timeline as sibling views.
8. Previs opens with visual coverage for all four Mini-Blocks in the selected Block.
9. No canon is manufactured.
10. Focused tests and exact-head Architecture Verification are green before merge.
