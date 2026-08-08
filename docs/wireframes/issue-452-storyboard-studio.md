# Issue #452 — Storyboard Studio wireframe

Approved direction: Storyboard is the visual-directing workspace inside the same PlotPickle Studio shell established by Splash, Dashboard, Learn and Plan. It receives the exact canonical story moment from Plan and turns creative intention into reviewed visual versions without exposing provider plumbing.

## Desktop wireframe — selected story moment

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Afterglow ▾      STORYBOARD      Act II · Block 07 · Mini 7.3 · Scene 14         Settings            │
├──────────────┬─────────────────────────────────────────────────────────────────────────────────────────────┬──────────────┤
│ STORYBOARD   │ VISUAL DIRECTION                                                                            │ CONTEXT      │
│              │                                                                                             │              │
│ Overview     │ ACTS       I      [II]      III      IV                                                     │ STORY MOMENT │
│ Story World  │ BLOCKS    07  [08] 09 10 11 12             24 total                                        │ Act II       │
│ Moments      │ MINI      7.1  7.2  [7.3]  7.4             96 total                                        │ Block 07     │
│ Continuity   │                                                                                             │ Mini 7.3     │
│ Versions     │ ─────────────────────────────────────────────────────────────────────────────────────────   │ Scene 14     │
│              │                                                                                             │              │
│              │ PLAN INTENTION                                                                              │ Characters   │
│              │ “The new world should feel beautiful at first, but one visual contradiction reveals danger.”│ Location     │
│              │                                                                                             │ Time / light │
│              │ STORY PURPOSE                                                                               │ Continuity   │
│              │ Goal · resistance · visible action · turn · emotional exit                                 │ locks        │
│              │                                                                                             │              │
│              │ ┌──────────────────────────────────────────────┐   ┌──────────────────────────────────────┐ │ Approved     │
│              │ │                                              │   │ CURRENT APPROVED                    │ │ identity     │
│              │ │              VISUAL FRAME                    │   │ Image v03                            │ │ refs         │
│              │ │          selected image / video              │   │ Approved by writer                   │ │              │
│              │ │                                              │   │ Continuity: clear                    │ │              │
│              │ └──────────────────────────────────────────────┘   │ Visual direction summary             │ │              │
│              │                                                    └──────────────────────────────────────┘ │              │
│              │                                                                                             │              │
│              │  [✓ KEEP]     [CHANGE DIRECTION]     [TRY AGAIN]     [COMPARE 3 VERSIONS]                  │              │
│              │                                                                                             │              │
│              │  Creative direction                                                                         │              │
│              │  Shot / composition · visible action · mood / light · continuity note                      │              │
│              │                                                                                             │              │
│              │  [Illustrate this moment]   [Animate approved image]   [Import visual]   [More ▾]           │              │
│              │                                                                                             │              │
│              │ ─────────────────────────────────────────────────────────────────────────────────────────   │              │
│              │ VERSION STRIP                                                                               │              │
│              │  v01 archived      v02 candidate      [v03 approved]      v04 candidate                     │              │
│              │                                                                                             │              │
│              │ [Open in Write]   [Open in Graphic Novel]   [Send to Build]                                │              │
├──────────────┴─────────────────────────────────────────────────────────────────────────────────────────────┴──────────────┤
│ Same PPF story unit · approved asset lineage · human approval required · saved locally                                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Desktop wireframe — overview

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Current Story ▾      STORYBOARD         4 Acts · 24 Blocks · 96 moments             Settings         │
├──────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ STORYBOARD   │ DIRECT THE FILM                                                                                             │
│              │                                                                                                             │
│ Overview     │ Visual intention from Plan                                                                                  │
│ Story World  │ A concise project-level visual language, mood and continuity promise.                                      │
│ Moments      │                                                                                                             │
│ Continuity   │ [Characters ready] [Locations ready] [Visual language] [Continuity issues]                                 │
│ Versions     │                                                                                                             │
│              │ ─────────────────────────────────────────────────────────────────────────────────────────────────────────   │
│              │  ACT I                  ACT II                 ACT III                ACT IV                                 │
│              │  01 02 03 04 05 06      07 08 09 10 11 12      13 14 15 16 17 18      19 20 21 22 23 24                   │
│              │  24 / 24 Blocks; each expands to four mini-block visual moments                                              │
│              │                                                                                                             │
│              │  Selected Block                                                                                             │
│              │  Block 07 · New World & Exploration                                                                         │
│              │  7.1 Promise       7.2 Progress       [7.3 Pressure]       7.4 Payoff                                      │
│              │                                                                                                             │
│              │  [Open selected moment]                                                                                     │
│              │                                                                                                             │
│              │ ─────────────────────────────────────────────────────────────────────────────────────────────────────────   │
│              │  VISUAL REVIEW QUEUE                                                                                        │
│              │  Needs decision  04      Continuity issue  02      Missing image  18      Approved  72                     │
│              │                                                                                                             │
│              │  [Review next unresolved moment]                                                                            │
└──────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Visual contract
- matte-black / near-black full desktop canvas with restrained warm-gold accents
- editorial/typewriter typography shared with Plan; no white application canvas or teal legacy Storyboard shell
- selected visual story moment is the visual hierarchy anchor
- four Acts, twenty-four Blocks and ninety-six mini-block moments remain visible and understandable
- images/video may carry their own natural colour; controls and framing remain quiet black/gold
- candidate, approved and continuity states use text, icons and border treatment rather than provider colours
- technical provider/model/endpoint/checkpoint terminology never appears in the normal directing surface
- no Workspace Ownership shelf in the normal Storyboard flow

## Storyboard information architecture
The current Storyboard capability is preserved but reduced to five creative areas.

### Overview
- project visual intention inherited from Plan
- four Acts / 24 Blocks / 96 visual moments
- visual readiness and unresolved review queue
- next visual story moment needing a human decision

### Story World
- approved character identity locks and reference images
- locations and environmental references
- props, vehicles and wardrobe continuity
- colour, lighting and project visual language
- these are creative continuity inputs, not provider settings

### Moments
- four Acts
- six Blocks per Act
- four mini-block visual moments per Block
- owning scene and Plan story purpose
- shot / composition / visible action / mood / light / continuity direction
- image and video candidates for the exact canonical moment

### Continuity
- character appearance drift
- location / geography consistency
- wardrobe / prop / injury / time-of-day continuity
- screen direction and recurring visual rules
- missing reference or unresolved visual warnings

### Versions
- image candidates
- video candidates
- approved version history
- archived alternatives
- Compare view
- provenance and asset lineage behind More / details, not in the primary directing controls

## Selected story-moment contract
Storyboard receives a canonical selection from Plan:
- Act
- Block
- mini-block
- owning scene ID
- characters
- locations
- story purpose
- visual intention
- continuity locks

No parallel storyboard story object is created. Image/video versions attach to the same Block / mini-block / scene identity already used by Plan and Write.

Selecting another Act, Block or mini-block changes only the current focus. It never renumbers or duplicates canonical story identity.

## Human decision contract
The primary review language is deliberately simple.

### Keep
- marks the selected candidate as the writer/director-approved visual version for this story moment
- never happens automatically
- previous approved version is retained in version history according to the existing lineage model

### Change direction
- opens creative direction controls before another generation
- writer changes composition, visible action, mood, continuity or visual emphasis
- it does not expose provider/model settings

### Try Again
- generates another candidate from the same approved story/canon context
- candidate remains unapproved until the writer chooses Keep

### Compare
- shows candidate and approved versions side by side
- comparison is visual and story-focused: composition, continuity, emotion, clarity and fit with Plan intention
- no version becomes canon by merely being generated

## Creative generation actions
Primary actions are story-facing:
- Illustrate this moment
- Animate approved image
- Try Again
- Import visual

PlotPickle uses the route configured in Settings automatically. The main Storyboard never asks the writer to choose Ollama, ComfyUI, OpenAI, MiniMax/H3, a checkpoint, endpoint or model name.

If generation is unavailable:
- show `Visual generation needs setup` or `Video generation needs setup`
- provide one Settings recovery link
- preserve existing explicit paid-generation consent before any billable request
- never silently fall back to a paid route

## Plan → Storyboard continuity
A deep link such as `workspace=storyboard&block=7&mini=3&scene=<id>` must open the exact same canonical moment selected in Plan.

Storyboard shows the Plan intention and story purpose beside the visual result so visual generation cannot drift away from narrative intent.

## Storyboard → Write / Graphic Novel / Build
The selected story moment leaves Storyboard with the same canonical identity.

### Write
- opens the same Block / mini-block / scene
- approved visual direction is available as context but never overwrites screenplay text

### Graphic Novel
- receives the same approved image/visual identity and story moment
- page/panel composition creates its own presentation records while linking back to the canonical story unit and approved visual assets

### Build
- receives approved text, image/video and asset versions for the same story moment
- unapproved candidates are not silently promoted

## Progressive disclosure
Always visible:
- current Act / Block / mini-block / scene
- Plan intention
- current approved visual
- Keep / Change / Try Again / Compare
- creative direction
- next/previous visual story moment

Behind More / details:
- full prompt text
- generation provenance
- provider route diagnostics
- rights metadata
- all archived versions
- advanced continuity details

Provider routing and credentials remain in Settings.

## Existing capability preservation
The rebuild must preserve useful existing Storyboard functionality even where the navigation is simplified:
- visual overview
- character identity locks and approved references
- locations/world references
- props, vehicles and wardrobe
- colour, lighting and visual language
- 24-block storyboard
- 96 mini-block frames
- story-aware prompt/context assembly
- image generation
- video generation
- candidate / approved / archived version history
- continuity diagnostics
- pitch/poster/production references
- local asset resolution and lineage
- human approval and paid-consent boundaries

## Review against #444
- same Studio shell and matte-black/gold/editorial language: PASS
- full available desktop workspace: PASS
- explicit 4 Acts / 24 Blocks / 96 mini-block architecture: PASS
- persistent Act / Block / mini-block / scene context: PASS
- receives the same PPF story moment from Plan: PASS
- visual intention and canon are visible before generation: PASS
- Keep / Change / Try Again / Compare makes human approval obvious: PASS
- approved visual/version leaves Storyboard without parallel story copies: PASS
- Settings/provider mechanics stay outside the creative flow: PASS
- existing visual identity, generation, versions and continuity capability is preserved: PASS

## Implementation gate
Implementation may begin only after this wireframe exists in the branch and remains the reference contract. If the rendered Storyboard materially diverges from this hierarchy, update and review this wireframe before continuing.

The implementation PR must reference this wireframe, include focused regression coverage, and compare real rendered desktop evidence for both Storyboard overview and a deep-linked story moment against this contract before merge.
