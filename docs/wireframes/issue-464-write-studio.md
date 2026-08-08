# Issue #464 — Write Studio wireframe

Approved direction: Write is the screenplay-creation workspace inside the same PlotPickle Studio established by Dashboard, Learn, Plan and Storyboard. It receives the exact canonical story moment from Plan or Storyboard and makes screenplay writing the dominant activity. Later-stage editing, production locking, export plumbing and provider configuration stay secondary or outside the normal drafting flow.

## Desktop wireframe — deep-linked scene / story moment

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Afterglow ▾      WRITE        Act II · Block 07 · Mini 7.3 · Scene 14             Settings          │
├────────────────┬───────────────────────────────────────────────────────────────────────────┬───────────────────────────────┤
│ STORY MAP      │ WRITE THE SCENE                                                           │ STORY CONTEXT                 │
│                │                                                                           │                               │
│ ACT I          │ Scene 14 · Confrontation and turn                       Saved locally     │ SAME PPF STORY MOMENT         │
│ 01 02 03 04    │ Block 07.3 · Pressure                                                     │ Act II · Block 07 · Mini 7.3 │
│ 05 06          │                                                                           │ Scene 14                      │
│                │ ┌───────────────────────────────────────────────────────────────────────┐ │                               │
│ ACT II         │ │ INT. OBSERVATION DECK — NIGHT                                        │ │ STORY PURPOSE                 │
│ [07] 08 09     │ │                                                                       │ │ Escalate resistance,          │
│ 10 11 12       │ │ Ren reaches the glass and stops.                                     │ │ complication, cost or        │
│                │ │                                                                       │ │ contradiction.               │
│ 7.1 Promise    │ │                         REN                                           │ │                               │
│ 7.2 Progress   │ │             This isn't what they promised us.                        │ │ CHARACTERS                     │
│ [7.3 Pressure] │ │                                                                       │ │ Ren · Mara                     │
│ 7.4 Payoff     │ │ Mara does not answer. Beyond the glass, the lights                    │ │                               │
│                │ │ across the station go dark one row at a time.                         │ │ LOCATION                       │
│ ACT III        │ │                                                                       │ │ Observation Deck              │
│ 13 14 15 16    │ │                         MARA                                          │ │                               │
│ 17 18          │ │             Keep moving.                                             │ │ APPROVED VISUAL DIRECTION     │
│                │ │                                                                       │ │ [approved frame thumbnail]    │
│ ACT IV         │ │                                                                       │ │ Beautiful new world with one  │
│ 19 20 21 22    │ │                                                                       │ │ contradiction revealing danger│
│ 23 24          │ └───────────────────────────────────────────────────────────────────────┘ │                               │
│                │                                                                           │ [Open in Storyboard]           │
│                │  + Action  + Character  + Dialogue  + Parenthetical  + Transition        │                               │
│                │                                                                           │                               │
│                │  [← Previous scene]                      [Next scene →]                    │                               │
├────────────────┴───────────────────────────────────────────────────────────────────────────┴───────────────────────────────┤
│ Drafting · screenplay text writes to the same canonical scene · no AI change is applied without writer approval          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Desktop wireframe — Write overview / re-entry

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Current Story ▾      WRITE       4 Acts · 24 Blocks · 96 mini-blocks               Settings         │
├────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ STORY MAP      │ SCREENPLAY                                                                                               │
│                │                                                                                                          │
│ Act I          │ Untitled Story                                                     Draft saved locally                  │
│ Act II         │ 48 planned scenes · 12 drafted · 36 remaining                                                           │
│ Act III        │                                                                                                          │
│ Act IV         │ ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│                │ │ CONTINUE WRITING                                                                                    │ │
│ Draft          │ │ Act II · Block 07 · Mini 7.3 · Scene 14                                                            │ │
│ Treatment      │ │ New World & Exploration · Pressure                                                                │ │
│ Notes          │ │ [Continue scene]                                                                                   │ │
│                │ └─────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                │                                                                                                          │
│                │ FOUR-ACT DRAFT MAP                                                                                       │
│                │ ACT I        ACT II        ACT III       ACT IV                                                           │
│                │ 01–06        07–12         13–18         19–24                                                            │
│                │ █████░       ███░░░        ░░░░░░        ░░░░░░                                                           │
│                │                                                                                                          │
│                │ RECENT SCENES                                                                                            │
│                │ Scene 13 · drafted       Scene 14 · in progress       Scene 15 · empty                                  │
│                │                                                                                                          │
│                │ [Continue writing]      [Open treatment]      [More ▾]                                                   │
└────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Visual contract
- matte-black / near-black full desktop canvas with restrained warm-gold accents
- editorial/typewriter typography shared with Plan and Storyboard
- screenplay page/editor is the highest-contrast writing surface, but not a bright white legacy application canvas
- current Act / Block / mini-block / scene remains visible while writing
- story context is narrow and read-only; it informs writing without competing with the screenplay
- no cyan ownership shelf, floating Feedback badge or provider-specific controls in the normal Write flow
- production/export controls are not top-level drafting actions

## Information architecture

### Story Map
- four Acts
- six Blocks per Act
- four mini-blocks per Block
- owning scenes beneath the selected mini-block
- direct previous / next story-position navigation
- the selected position never changes identity when moving between Plan, Storyboard and Write

### Draft
- selected screenplay scene is the primary canvas
- canonical screenplay elements: scene heading, action, character, dialogue, parenthetical, transition
- compact add-element controls
- local save state
- scene/page estimates may remain visible but secondary

### Treatment
- retained as an alternate writing view where useful
- same Block / mini-block / scene identity
- never becomes a second story model
- screenplay and treatment remain views over the same canonical project structure

### Context
Always visible for the selected scene:
- same PPF story identity
- story purpose / turn / outcome
- characters in the scene
- location
- approved Storyboard visual direction or image, when available
- continuity warning only when it affects the current writing decision

### Notes / More
Behind deliberate disclosure:
- scene notes
- source/import provenance
- revision details
- screenplay export
- production-draft conversion
- locked pagination / revision sets / production annotations
- advanced writing assistance

Production conversion is important but belongs behind More / Build-facing workflow; it must not dominate initial screenplay creation.

## Plan / Storyboard → Write contract
A deep link such as:

`workspace=write&block=7&mini=3&scene=<id>`

must open the same canonical story moment already selected in Plan or Storyboard.

Write receives, read-only:
- Act / Block / mini-block / scene identity
- story purpose
- characters
- location
- approved Storyboard visual direction and approved visual asset where available

Write owns the screenplay text for that scene. It does not copy the story moment into a parallel screenplay object.

## Screenplay editing contract
The writing canvas edits the existing canonical screenplay scene references and screenplay elements already used by PlotPickle.

Primary actions:
- type / revise screenplay text
- add screenplay element
- move to previous / next scene

Secondary actions:
- switch Treatment / Screenplay view
- open Plan Block
- open Storyboard moment
- scene notes

Behind More / Advanced:
- export Fountain / Final Draft / PDF
- production draft conversion
- production annotations and revision sets
- import/source provenance
- optional writing assistance

## Write → Edit boundary
Write owns initial screenplay creation. Edit is a later Studio module for deliberate copy, dialogue, action, pacing and tone revision.

Once Edit has a canonical receiver, Write will pass:
- Block
- mini-block
- scene ID
- current canonical screenplay text / element identity
- existing story and visual context references

Do not create a fake Edit receiver before the Edit workspace is rebuilt. The wireframe reserves the handoff, but implementation waits until the receiving side is real.

## Writing assistance boundary
Normal Write never exposes provider/model/endpoint language.

If optional assistance is used:
- it receives the current canonical story/scene context
- suggestions are proposals only
- no suggestion silently overwrites screenplay text
- any paid/external route retains existing explicit consent
- Settings owns provider/model/API configuration

## Current capability preservation
The rebuild must preserve useful existing Write functionality:
- Treatment and Screenplay views
- 24 Block / 96 mini-block story navigation
- canonical scene references
- screenplay element editing
- scene headings, action, character, dialogue, parenthetical and transition
- imported screenplay source and normalization
- local autosave / canonical PPF synchronization
- screenplay exports
- production-draft conversion and revision systems, moved behind progressive disclosure
- approved dialogue handoff
- Plan / Storyboard Block+mini deep-link receiver behavior

## Review against #444
- same Studio shell and matte-black/gold/editorial language: PASS
- full available desktop workspace: PASS
- four Acts / 24 Blocks / 96 mini-block architecture: PASS
- persistent Block / mini-block / scene identity: PASS
- receives same PPF story moment from Plan / Storyboard: PASS
- screenplay editor is the primary hierarchy anchor: PASS
- story / cast / location / visual context stays read-only: PASS
- later Edit boundary is explicit without creating a fake receiver: PASS
- provider mechanics stay outside the writing flow: PASS
- existing screenplay / import / export / production-draft capability is preserved: PASS

## Implementation gate
Implementation may begin only after this wireframe exists in the branch and remains the reference contract. If rendered Write materially diverges from this hierarchy, update and review the wireframe before continuing.

The implementation PR must reference this wireframe, include focused regression coverage, and compare real rendered desktop evidence for both Write overview and a deep-linked Block 7 / mini 3 context against this contract before merge.
