# Issue #461 — Write + Edit Studio wireframe

Approved direction: Write and Edit are two creative lenses over one canonical screenplay inside PlotPickle Studio. Write creates screenplay material at the selected story position. Edit reviews and improves that same material without creating another draft.

## Desktop wireframe — Write

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Afterglow ▾        WRITE       Act II · Block 07 · Mini 7.3 · Scene 14       Settings │
├──────────────┬──────────────────────────────────────────────────────────────────────────────┬──────────────┤
│ WRITE        │ SCREENPLAY                                                                    │ STORY MOMENT │
│              │                                                                                │              │
│ Act I        │  NEW WORLD & EXPLORATION · PRESSURE                                           │ Block 07     │
│ 01–06        │  What must happen: Escalate resistance, complication, cost or contradiction. │ Mini 7.3     │
│              │                                                                                │ Scene 14     │
│ Act II       │  [Treatment] [Screenplay]                                                     │              │
│ 07 [7.3] 08… │                                                                                │ Plan intent  │
│              │  ┌─────────────────────────────────────────────────────────────────────────┐  │ Characters   │
│ Act III      │  │ INT. LOCATION — NIGHT                                                  │  │ Location     │
│ 13–18        │  │                                                                         │  │ Visual canon │
│              │  │ Action written here…                                                    │  │ Threads      │
│ Act IV       │  │                                                                         │  │              │
│ 19–24        │  │ CHARACTER                                                               │  │ Current text │
│              │  │ Dialogue written here…                                                  │  │ status       │
│              │  └─────────────────────────────────────────────────────────────────────────┘  │              │
│              │                                                                                │              │
│              │  [+ Scene heading] [+ Action] [+ Character] [+ Dialogue] [More formats ▾]     │              │
│              │                                                                                │              │
│              │  [Write next]       [Review in Edit]       [Open Plan]                         │              │
├──────────────┴──────────────────────────────────────────────────────────────────────────────┴──────────────┤
│ Same PPF story · same screenplay elements · autosaved locally · optional assistance never writes silently │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Desktop wireframe — Edit

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PLOTPICKLE STUDIO     Afterglow ▾        EDIT        Act II · Block 07 · Mini 7.3 · Scene 14       Settings │
├──────────────┬──────────────────────────────────────────────────────────────────────────────┬──────────────┤
│ EDIT         │ REVIEW THIS STORY MOMENT                                                     │ REVIEW       │
│              │                                                                                │              │
│ Scene        │  NEW WORLD & EXPLORATION · PRESSURE                                           │ What works   │
│ Dialogue     │  Same canonical screenplay elements created in Write.                        │              │
│ Action       │                                                                                │ Needs work   │
│ Pacing       │  ┌─────────────────────────────────────────────────────────────────────────┐  │              │
│ Continuity   │  │ INT. LOCATION — NIGHT                                                  │  │ Why          │
│              │  │                                                                         │  │              │
│              │  │ Action written in Write…                                                │  │ Evidence     │
│              │  │                                                                         │  │              │
│              │  │ CHARACTER                                                               │  │              │
│              │  │ Dialogue written in Write…                                              │  │              │
│              │  └─────────────────────────────────────────────────────────────────────────┘  │              │
│              │                                                                                │              │
│              │  SELECTED SUGGESTION                                                          │              │
│              │  “Tighten this action to make the visible choice clearer.”                    │              │
│              │                                                                                │              │
│              │  [Accept change]  [Rewrite myself]  [Ignore]  [Compare]                       │              │
│              │                                                                                │              │
│              │  [Back to Write 7.3]                  [Next review item]                       │              │
├──────────────┴──────────────────────────────────────────────────────────────────────────────┴──────────────┤
│ Edit proposes · writer decides · accepted wording updates the same screenplay element and revision history │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Visual contract
- matte-black / near-black full desktop canvas with restrained warm-gold accents
- same thin persistent PlotPickle Studio shell as Plan and Storyboard
- typewriter/editorial typography; screenplay text remains highly readable and visually primary
- full available desktop width; remove the current white/teal application-within-an-application appearance
- current Act / Block / mini-block / scene stays visible in both Write and Edit
- the screenplay page is the primary visual object; contextual information is quieter
- technical provider/model/endpoint/key language never appears in normal Write or Edit
- optional AI assistance is described as writing/review help, not provider selection

## Shared story-position contract
Write and Edit share one selected story position:
- Act
- Block
- mini-block
- owning scene ID / scene number
- attached characters
- attached locations
- story threads
- Plan purpose / goal / conflict / turn
- approved Storyboard visual direction and assets where available

A deep link such as `/?workspace=write&block=7&mini=3` selects the canonical Block 7 / mini 7.3 context. Write resolves the owning scene from the existing scene index. The Write → Edit handoff must carry the same identity. Edit must never create a second screenplay element set.

## Write information architecture
### Story position
- four Acts
- six Blocks per Act
- four mini-blocks per Block
- selected owning scene

### Draft
- Treatment
- Screenplay
- canonical screenplay elements
- scene heading / action / character / dialogue / parenthetical / transition and advanced formats

### Story context
- Plan purpose, objective, conflict, turn and outcome
- characters and voice
- location
- story threads
- approved Storyboard visual/canon context

### Production / Advanced
Progressive disclosure only:
- production draft conversion
- revision colours
- production scene numbering
- pagination locks
- element locking / omission
- thread assignment
- optional writing assistance
- exports: Fountain, Final Draft, Print/PDF

These remain available, but they do not dominate the first writing view.

## Edit information architecture
Edit is not a separate screenplay. It is a review workspace over the exact canonical screenplay elements selected by Block / mini-block / scene.

### Scene
Review:
- scene objective
- conflict
- turn
- outcome
- clarity of visible choice
- scene purpose versus Plan

### Dialogue
Review:
- character voice
- subtext
- exposition
- status / strategy
- repetition
- distinction between speakers

### Action
Review:
- visual specificity
- readability
- economy
- playable action
- unnecessary explanation
- consistency with approved visual/story canon

### Pacing
Review:
- scene length
- repeated beats
- escalation
- rhythm
- entry / exit efficiency
- proportion within Block / Act

### Continuity
Review:
- characters
- locations
- props / wardrobe / injuries
- time / geography
- story threads
- approved Storyboard decisions
- scene numbering and production constraints where applicable

## Human-decision contract
Edit may diagnose or propose; the writer owns the final wording.

For each suggestion:
- Accept change — explicitly writes the proposed change into the same canonical screenplay element and records the revision
- Rewrite myself — focuses the same screenplay element for manual editing
- Ignore — dismisses the proposal without changing canon
- Compare — shows current wording and proposal together

No suggestion silently replaces screenplay text. AI assistance cannot auto-advance, auto-approve or create a parallel screenplay.

## Write → Edit → Write continuity
1. Writer opens or receives Block 7 / mini 7.3 from Plan or Storyboard.
2. Write selects the canonical story position and its owning scene.
3. Writer creates or edits screenplay elements attached to that same scene / Block / mini-block.
4. “Review in Edit” opens Edit with Block 7 / mini 7.3 / owning scene identity.
5. Edit reads the same screenplay elements.
6. Accepted changes update those same elements; ignored suggestions do nothing.
7. “Back to Write 7.3” returns to the same story position and immediately shows the accepted wording.

No copy or shadow draft is created anywhere in this path.

## Progressive disclosure
Primary Write actions:
- write/edit screenplay text
- select story position
- add screenplay element
- open Plan
- review this moment in Edit

Primary Edit actions:
- select Scene / Dialogue / Action / Pacing / Continuity lens
- inspect current screenplay text
- Accept change / Rewrite myself / Ignore / Compare
- return to Write

Secondary material belongs behind More / Production / Advanced:
- revision colours
- production pagination
- locks and omissions
- thread assignment
- full craft diagnostics
- optional AI direction/prompt text
- export controls where not immediately needed

Settings contains provider routing, keys, endpoints and paid configuration.

## Existing capability preservation
The rebuild must preserve the useful current Writer system:
- TreatmentEditor
- ScriptWorkspace and canonical screenplay draft elements
- 24/96 navigation
- scene assignment and global scene index
- screenplay formatting and keyboard shortcuts
- imported screenplay conversion
- Fountain / Final Draft / Print/PDF exports
- production draft reconciliation
- revision colour / lock / omission
- story-thread assignment
- craft diagnostics
- optional writing assistant

The implementation may reorganize or progressively disclose these controls, but must not remove the underlying capability.

## Review against #444
- same Studio shell and matte-black / warm-gold visual language: PASS
- full desktop workspace: PASS
- exposes 4 Acts / 24 Blocks / 96 mini-blocks and scene identity: PASS
- receives the same canonical story moment from Plan / Storyboard: PASS
- Write and Edit operate on the same screenplay elements: PASS
- explicit Write → Edit → Write continuity: PASS
- no parallel screenplay copy: PASS
- human approval remains explicit: PASS
- provider/model/endpoint/key mechanics remain in Settings: PASS
- production and export depth is preserved through progressive disclosure: PASS

## Implementation gate
Implementation may begin only after this wireframe exists in the branch and remains the reference contract. If the rendered Write or Edit implementation materially diverges from this hierarchy or continuity model, update and review this wireframe before continuing.

Implementation should proceed in small reviewable slices:
1. Write Studio visual boundary + 4/24/96 context while preserving current Writer behavior.
2. Native Write → Edit story-position handoff and Edit shell over the same screenplay elements.
3. Edit lenses and explicit proposal decisions without silent canon changes.
4. Progressive disclosure / production tools / final rendered continuity proof.

Each implementation PR must include focused regression coverage and rendered desktop evidence compared against this wireframe before merge.
