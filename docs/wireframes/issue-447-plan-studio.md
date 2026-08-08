# Issue #447 — Plan Studio wireframe

Approved direction: Plan is the story-architecture workspace inside the same full-screen PlotPickle Studio shell established by Dashboard and Learn.

## Desktop wireframe

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Afterglow ▾        PLAN        Act II · Block 09 · Mini-block 34        Settings      │
├──────────────┬──────────────────────────────────────────────────────────────────────────────┬──────────────┤
│ PLAN         │ STORY ARCHITECTURE                                                            │ CONTEXT      │
│              │                                                                                │              │
│ Story        │  THE STORY                                                                    │ Selected     │
│ World & Cast │  A concise premise / promise / visual intention lives here.                   │ Block 09     │
│ Story Engine │                                                                                │ Mini 34      │
│ Structure    │  [Premise] [Pitch] [Visual intention] [Next useful task]                      │ Scene 18     │
│ Canon & Notes│                                                                                │              │
│              │  ───────────────────────────────────────────────────────────────────────────   │ Characters   │
│              │                                                                                │ Location     │
│              │  4 ACTS                                                                       │ Thread       │
│              │  ACT I            ACT II           ACT III          ACT IV                     │              │
│              │  01 02 03 04 05 06 07 08 [09] 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 │ Canon        │
│              │                                                                                │ links        │
│              │  MINI-BLOCKS FOR BLOCK 09                                                     │              │
│              │  33  [34]  35  36                                                            │              │
│              │                                                                                │              │
│              │  SELECTED STORY UNIT                                                          │              │
│              │  Goal / conflict / choice / action / consequence / emotional turn            │              │
│              │                                                                                │              │
│              │  Visual intention                                                             │              │
│              │  What should the audience see, feel and understand here?                      │              │
│              │                                                                                │              │
│              │  [Edit story]   [Open in Storyboard]   [Open in Write]   [More ▾]             │              │
├──────────────┴──────────────────────────────────────────────────────────────────────────────┴──────────────┤
│ Canon status · autosaved locally · same PPF story identity carried forward to every module                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Visual contract
- matte-black / near-black full desktop canvas with restrained warm-gold accents
- same thin persistent PlotPickle Studio shell as Dashboard and Learn
- typewriter/editorial typography with strong hierarchy and generous spacing
- fixed Plan rail on the left; the central story canvas owns most of the screen
- optional compact context inspector on the right only when a selected story unit benefits from it
- no legacy white planner canvas, teal panels, configuration cards or dense settings-like grids
- technical provider/model/endpoint/checkpoint language never appears in the normal Plan surface

## Information architecture
The existing planning system is preserved but grouped into five understandable creative areas.

### Story
- Simple Start / Project Overview
- Story Setup
- Concept Canvas
- Pitch & Vision
- Visual intention

### World & Cast
- World
- Locations
- Characters
- Relationships
- Visual References

### Story Engine
- Ghost
- Catalyst
- Foundations
- The Pickle
- Dialogue
- Threads / arcs / dramatic question / stakes / transformation

### Structure
- four Acts
- six Blocks per Act
- twenty-four Blocks total
- four mini-blocks per Block
- ninety-six mini-blocks total
- scenes / sequences / Story Clock / structure map

### Canon & Notes
- Core Model
- continuity
- rights / provenance
- revision history
- working notes

## Default Plan experience
Opening Plan should answer four questions immediately:
1. What is this story?
2. Who and what world are we following?
3. Where are we in the 4 Act / 24 Block / 96 mini-block architecture?
4. What should the writer work on next?

The default central canvas therefore shows a concise story promise, visual intention, the four-Act structure, all twenty-four Blocks, the selected Block's four mini-blocks, and the selected unit's story purpose.

## Story-unit interaction contract
- selecting an Act changes the visible six-Block group without changing story identity
- selecting a Block shows its four mini-blocks and all attached scene/story context
- selecting a mini-block or scene updates the contextual inspector and primary editing area
- Plan edits write to the same canonical PPF object consumed by Storyboard, Write, Edit, Graphic Novel, Build, Feedback and Refine
- no parallel planning copy is created
- direct handoffs to Storyboard and Write preserve the current Act / Block / mini-block / scene selection

## Visual intention contract
Visual intention belongs in Plan as creative direction, not as an image-generation settings form.

For a project, character, location, Block, mini-block or scene, the writer can record what the audience should see, feel and understand. Storyboard and later visual-generation workflows inherit that approved intention automatically. Provider and model routing remains automatic and configurable only in Settings.

## Progressive disclosure
Primary Plan actions are creative and obvious:
- Edit story
- Add / edit character or world detail
- Shape story engine
- Open selected Block or mini-block
- Open in Storyboard
- Open in Write

Secondary or advanced material such as rights detail, provenance, full revision history, AI routing diagnostics and technical configuration stays behind More / Advanced or in Settings.

## Existing content preservation
The redesign must not remove the useful legacy planning sections. Existing project data, fields and editing behaviour remain available even where navigation is consolidated into the five Plan groups.

## Review against #444
- uses the same Studio shell and visual language: PASS
- full available desktop workspace: PASS
- exposes 4 Acts / 24 Blocks / 96 mini-blocks: PASS
- keeps current story position visible: PASS
- shows how one canonical story unit enters and leaves Plan: PASS
- keeps Settings / providers outside the creative flow: PASS
- preserves existing planning depth: PASS
- forwards visual intention into Storyboard: PASS

## Implementation gate
Implementation may begin only after this wireframe exists in the branch and remains the reference contract. If the rendered Plan implementation materially diverges from this layout or interaction hierarchy, update and review this wireframe before continuing.

The implementation PR must include focused regression coverage and the real rendered desktop Plan capture must be visually compared with this wireframe before merge.
