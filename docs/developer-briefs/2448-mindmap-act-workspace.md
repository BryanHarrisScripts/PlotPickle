# Developer Brief — MindMap Act-Scoped Workspace

Issue: #2448

The Human-approved MindMap workflow is one Act at a time with independently addressable narrative lanes.

## Visible identity

The top active-surface header is exactly **MINDMAP**.

## Act rail

Render one persistent Act rail:
- Act 1
- Act 2
- Act 3
- Act 4

Act 1 is the entry default. One Act is active at a time. The selected Act owns the composer, visible Inbox, agent development action and Story Shape.

## Act-scoped Inbox

Extend unpinned local MindMap cards with optional `inboxAct`.

New Written Idea cards store the selected Act immediately.

Legacy cards without `inboxAct` remain visible under Act 1. Do not delete or rewrite legacy cards simply to migrate them.

When a Human pins an Inbox card:
- its Act is fixed to `inboxAct ?? 1`
- Discovery Mapper chooses one governed lane for that Act
- a mapper result for another Act is rejected
- accepted placement keeps the fixed Act

## Eleven governed lanes

MindMap has exactly eleven current lane IDs, in this order:

1. Story
2. Plot
3. Character
4. Scene
5. Dialogue
6. World
7. Research
8. Theme
9. Motif
10. Visual
11. Image

These are real independently addressable lanes, not display-only splits.

The governed model is 4 Acts × 11 lanes = 44 MindMap areas.

Legacy paired lanes normalize without dropping cards:
- story-plot → story
- scene-dialogue → scene
- world-research → world
- theme-motif → theme
- visual-mood → visual
- character → character

Do not automatically split old combined prose across multiple new lanes.

Project-derived canonical Block pins use the Story lane.

Discovery Mapper skill and Mastra structured output must use the eleven current lanes.

## Develop selected Act

Expose one action:

`Develop Act {selectedAct} Mind Map`

Creative Director generates one non-canon proposal for every one of the eleven lanes for the selected Act and replaces only prior Creative Director proposals for that Act.

## Story Shape

Render only the active Act.

Show the eleven lanes as spacious, separate, full-width rows. Cards within each lane stack vertically.

Do not render the old four-Act matrix, the six paired lanes, or a two-column pairing layout.

## Preserve

Keep:
- four Act values
- Written Idea only
- current Library persistence
- project-derived provenance
- Creative Director proposal/non-canon boundary
- WorldMap/Outline/Storyboard behavior

## Verification

Before merge:
- focused #2448 contract tests
- update #2287 and #2442 regressions where lane vocabulary intentionally changed
- verify legacy paired-lane normalization
- verify Discovery Mapper schema and skill use eleven lane IDs
- verify deterministic project pins use Story
- verify one selected Act and one Develop action
- verify Story Shape is full-width row layout
- run exact-head Architecture Verification and fix until green
