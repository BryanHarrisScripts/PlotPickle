# Issue #470 — Graphic Novel + Build Studio wireframe

Approved direction: Graphic Novel and Build are two connected visual-production lenses over the same canonical PlotPickle story position. Graphic Novel composes approved story and visual canon into pages and panels. Build assembles approved text, images, video and audio into sequences/prototype/animatic material. Neither module creates a parallel story, screenplay or visual canon.

## Desktop wireframe — Graphic Novel

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Afterglow ▾   GRAPHIC NOVEL   Act II · Block 07 · Mini 7.3 · Scene 14       Settings │
├──────────────┬──────────────────────────────────────────────────────────────────────────────┬──────────────┤
│ GRAPHIC      │ PAGE / PANEL COMPOSITION                                                      │ STORY CANON  │
│ NOVEL        │                                                                                │              │
│              │  NEW WORLD & EXPLORATION · PRESSURE                                           │ Scene 14     │
│ Act I        │  Same story moment received from Edit.                                         │ Characters   │
│ 01–06        │                                                                                │ Location     │
│              │  Page 18    [Page view] [Panel view]                                           │ Visual style │
│ Act II       │                                                                                │ Props        │
│ 07 [7.3] 08… │  ┌──────────────────────────────┬──────────────────────────────┐                │ Threads      │
│              │  │ PANEL 1                      │ PANEL 2                      │                │              │
│ Act III      │  │ approved character/location  │ candidate composition        │                │ APPROVED     │
│ 13–18        │  │ image / framing              │ image / framing              │                │ VISUALS      │
│              │  │                              │                              │                │              │
│ Act IV       │  │ dialogue/caption from        │ dialogue/caption from        │                │ Identity ✓   │
│ 19–24        │  │ canonical screenplay         │ canonical screenplay         │                │ Location ✓   │
│              │  └──────────────────────────────┴──────────────────────────────┘                │ Palette ✓    │
│              │                                                                                │              │
│              │  [Keep] [Change] [Try] [Compare]       [Approve panel]                         │              │
│              │                                                                                │              │
│              │  [+ Panel] [Reorder] [Page layout ▾]        [Build this moment →]              │              │
├──────────────┴──────────────────────────────────────────────────────────────────────────────┴──────────────┤
│ Same PPF story · same screenplay/canon references · candidates stay separate until the writer approves    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Desktop wireframe — Build

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Afterglow ▾        BUILD       Act II · Block 07 · Mini 7.3 · Scene 14       Settings │
├──────────────┬──────────────────────────────────────────────────────────────────────────────┬──────────────┤
│ BUILD        │ SEQUENCE / PROTOTYPE                                                         │ SOURCE       │
│              │                                                                                │ MATERIAL     │
│ Act I        │  NEW WORLD & EXPLORATION · PRESSURE                                           │              │
│ 01–06        │  Same approved story moment received from Graphic Novel.                      │ Text ✓       │
│              │                                                                                │ Images ✓     │
│ Act II       │  TIMELINE                                                                      │ Video 2      │
│ 07 [7.3] 08… │  ┌─────────────────────────────────────────────────────────────────────────┐  │ Audio 3      │
│              │  │ [Shot 1 image] [Shot 2 video] [Shot 3 image] [Shot 4 video]           │  │              │
│ Act III      │  │ ─────────────── sequence / timing / transitions ────────────────────── │  │ LINEAGE      │
│ 13–18        │  │ [dialogue]       [ambience]       [music cue]                         │  │              │
│              │  └─────────────────────────────────────────────────────────────────────────┘  │ Approved ✓   │
│ Act IV       │                                                                                │ Candidate ○  │
│ 19–24        │  PREVIEW                                                                       │ Needs work × │
│              │  ┌─────────────────────────────────────────────────────────────────────────┐  │              │
│              │  │                         visual prototype                                │  │ Source links │
│              │  └─────────────────────────────────────────────────────────────────────────┘  │              │
│              │                                                                                │              │
│              │  [Arrange] [Preview] [Approve sequence] [Send item back ▾]                    │              │
├──────────────┴──────────────────────────────────────────────────────────────────────────────┴──────────────┤
│ Build assembles approved material · source assets keep lineage · paid/provider mechanics remain Settings   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Visual contract
- matte-black / near-black full desktop canvas with restrained warm-gold accents
- same thin persistent PlotPickle Studio shell as Plan, Storyboard, Write and Edit
- typewriter/editorial typography with visual material given the largest area
- full available desktop width; no nested white/teal legacy application surfaces
- current Act / Block / mini-block / scene remains visible in both modules
- source/canon/approval context is quiet but continuously available
- provider, model, endpoint, API key and workflow-node mechanics never dominate the creative surface

## Shared story-position contract
Graphic Novel and Build share the exact canonical story position inherited from Edit:
- Act
- Block
- mini-block
- owning scene ID / scene number
- screenplay element references
- attached characters
- attached locations
- story threads
- approved Storyboard visual direction
- character and location visual identity
- approved/candidate asset lineage
- revision and approval history

A handoff such as `/graphic-novel?block=7&mini=3` or the existing workspace-equivalent must resolve the same Block 7 / mini 7.3 story context. Graphic Novel → Build carries that identity forward. No copy of the scene or screenplay is created.

## Graphic Novel information architecture
### Story position
- four Acts
- six Blocks per Act
- four mini-blocks per Block
- selected owning scene

### Page and panel composition
- page sequence
- panel order and size
- composition / framing
- dialogue / captions sourced from canonical screenplay material
- approved character/location/prop identity
- panel visual candidates and approved panel assets

### Human visual decisions
Every candidate supports:
- Keep — preserve the useful qualities/direction
- Change — describe what must change while retaining lineage
- Try — request another creative direction without changing canon
- Compare — inspect candidates side by side
- Approve — make the selected panel/page state part of approved visual canon

Candidates are not canon merely because they exist or were generated.

### Advanced / Settings boundary
Progressive disclosure only:
- layout templates
- detailed image direction
- crop / framing metadata
- export resolution / print settings
- optional generation assistance

Settings owns provider routing, models, endpoints, keys, paid configuration and local/cloud choices.

## Build information architecture
Build is the assembly workspace for approved storyworld material, not a provider dashboard.

### Sources
- canonical screenplay text
- approved Graphic Novel / Storyboard images
- approved or candidate video clips
- dialogue, ambience, sound effects and music cues
- production assets with source-module and revision lineage

### Sequence assembly
- arrange shots/assets
- timing and duration
- transitions
- audio placement
- preview
- sequence approval

### Source correction loop
Each Build item retains a direct source reference. If an item needs correction, “Send item back” routes it to the owning module and exact story position, for example:
- screenplay wording → Write or Edit
- visual identity/composition → Storyboard or Graphic Novel
- structural intent → Plan
- generated media candidate → its owning visual/build source state

The return path does not duplicate the asset or story unit.

## Human-decision contract
Graphic Novel and Build may create or display candidates; the writer/director decides what becomes approved.

- no candidate auto-approves
- no paid provider fallback occurs silently
- no generated replacement silently changes screenplay or visual canon
- approved assets retain provenance and source story position
- a rejected or replaced candidate remains traceable when revision history requires it

## Edit → Graphic Novel → Build continuity
1. Edit holds Block 7 / mini 7.3 / Scene 14 and the canonical screenplay elements.
2. Graphic Novel opens the exact same story position and reads approved characters, locations, screenplay text and visual canon.
3. The writer/director composes panels and compares candidates.
4. Approved panels remain attached to Block 7 / mini 7.3 / Scene 14.
5. “Build this moment” opens Build with that same identity and approved source material.
6. Build arranges approved text/images/video/audio into a sequence or prototype.
7. Any item needing revision can be sent back to the correct source module at the same story position.
8. Approval in Build records the assembled sequence without changing the underlying source canon silently.

## Progressive disclosure
Primary Graphic Novel actions:
- select story position
- inspect page/panel composition
- Keep / Change / Try / Compare
- approve panel/page
- move the selected story moment into Build

Primary Build actions:
- select story position
- choose approved source material
- arrange
- preview
- approve sequence
- send a problem item back to its source module

Secondary / Advanced:
- technical generation direction
- encoding/output details
- provider-specific workflow information
- detailed rendering parameters
- export presets

Those controls remain hidden until deliberately opened; provider configuration remains in Settings.

## Existing capability preservation
The Phase D rebuild must preserve useful current capabilities rather than replace them with a mock shell:
- existing Graphic Novel planning/panel/reader/dialogue/export data
- existing Storyboard approved visual assets and visual canon
- existing Production Shots / animatic / asset sequencing where present
- image, video and audio asset records
- source/provenance metadata
- human approval states
- local-first storage and paid-consent boundaries
- PPF/export compatibility

## Review against #444
- same Studio shell and matte-black / warm-gold visual language: PASS
- full desktop workspace: PASS
- exposes 4 Acts / 24 Blocks / 96 mini-blocks and scene identity: PASS
- receives the same canonical story moment from Edit: PASS
- Graphic Novel uses existing screenplay and approved visual canon rather than shadow copies: PASS
- Build assembles source material with lineage rather than replacing canon: PASS
- explicit Edit → Graphic Novel → Build continuity: PASS
- explicit source-module return path: PASS
- human approval remains explicit: PASS
- provider/model/endpoint/key mechanics remain in Settings: PASS

## Implementation gate
No Phase D implementation begins until this wireframe is merged and remains the reference contract. Material visual/hierarchy changes require this document to be updated before implementation continues.

Implementation should proceed in small reviewable slices:
1. Graphic Novel Studio shell + four-Act / 24 / 96 / scene context while preserving current Graphic Novel behavior.
2. Graphic Novel candidate decisions and explicit approval over existing canon/assets.
3. Native Graphic Novel → Build same-story-position handoff and Build Studio shell.
4. Build assembly / preview / source-lineage / send-back flow.
5. Final rendered desktop continuity proof from Edit → Graphic Novel → Build.

Each implementation PR must include focused regression coverage and rendered desktop evidence compared against this wireframe before merge.
