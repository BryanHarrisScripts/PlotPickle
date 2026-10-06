# #2810 Timeline inline motion clips / comic-book-to-movie flow

## Developer Brief

### Objective

Simplify Timeline into PlotPickle's **comic-book-to-movie** workspace.

The Human enters Timeline after Storyboard and Previs have already established:

- the 25 ordered Shots for the Mini-Block;
- the locked Storyboard image for each Shot;
- Graphic Novel / narration presentation where approved;
- basic visual/story context.

Timeline's job is now to turn those locked still Shots into motion clips and assemble them into a moving visual story.

The primary interaction should therefore be:

```text
Shot 01 locked still
→ Generate motion
→ Shot 01 visual becomes a playable motion clip
→ Play inline or expand for larger review

Shot 02 locked still
→ Generate motion
→ Shot 02 visual becomes a playable motion clip

...continue through the 25 Shots
```

### Live UAT product decision

The following Timeline controls are redundant because their review/presentation purpose is already owned by Previs:

- Previous Shot;
- Play / Pause;
- Next Shot;
- Playback: Still images / Generated motion;
- Written narration On / Off;
- the separate Previs-style playback monitor as the primary way to inspect a Shot.

Timeline should not ask the Human to switch between still-image playback and motion playback.

The Timeline Shot itself should visibly evolve from:

```text
LOCKED STORYBOARD IMAGE
```

to:

```text
GENERATED MOTION CLIP
```

when motion is ready.

The original locked still remains preserved as source/provenance and fallback evidence; it is not deleted or overwritten in storage.

### Product model

Canonical flow:

```text
Storyboard
→ choose/lock the visual

Previs
→ read the Graphic Novel / narration / pacing presentation

Timeline
→ turn each locked visual Shot into motion
→ review the generated clip
→ assemble the motion sequence

Rough Cut
→ downstream committed edit/revision
```

Timeline is therefore not another Graphic Novel reader.

It is the production bridge from still visual storytelling into moving picture.

### Relationship to current work

Preserve and extend:

- #2797 — cinematic 25-Shot Timeline production board;
- #2803 — provider-neutral Shot Generation Packets;
- #2808 — remove the obsolete Block Visual Workspace from Timeline;
- #2809 — truthful Generate Motion preflight/failure state;
- existing Production Take lineage;
- existing stale-source detection;
- existing Human confirmation/provider-routing rules;
- locked Storyboard/Previs source identity.

This issue changes the Human interaction and information hierarchy, not the underlying motion-generation authority.

### Phase 1 — Shot visual becomes the motion player

Each of the 25 Timeline Shot rows/cards has one primary visual area.

Before successful motion generation:

- show the authoritative locked Storyboard image;
- show current motion state;
- expose `Generate motion`.

While generating:

- retain the still image;
- visibly show PREFLIGHT / SUBMITTING / QUEUED / RUNNING over or beside the Shot visual;
- do not replace the still with a blank placeholder.

After successful generation:

- the primary visual area becomes the generated motion clip;
- display an inline Play control;
- preserve Shot number and duration;
- retain an unobtrusive indicator that the clip derives from the locked Storyboard image;
- expose Regenerate motion without deleting the existing take.

The stored locked still remains independently available for provenance/recovery.

### Phase 2 — inline clip playback

A Ready Shot should be directly playable from its Shot row/card.

Required behavior:

- click Play on Shot 01;
- only Shot 01 motion plays;
- click/pause again to stop;
- starting another Shot pauses the previously playing Shot;
- playback stays bounded to the Timeline Shot's intended approximately 3-second slot, even if provider-native output is longer;
- no unrelated global playback mode toggle is required.

Do not silently substitute the still if the motion clip is failed/stale/missing.

If motion is not ready, show the truthful generation state from #2809.

### Phase 3 — expanded Shot review

Provide a simple larger review state for a generated Shot.

The Human asked for approximately a half-screen review rather than a separate full application/player.

Preferred interaction:

```text
Ready motion clip
→ Expand
→ larger inline/dialog review
→ Play / Pause
→ close
→ return to same Shot position
```

Requirements:

- preserve focus/accessibility;
- do not navigate away from Timeline;
- keep Shot number and source context visible;
- display the motion clip prominently;
- include only the controls necessary to review that Shot;
- no duplicate Previs transport UI inside the expanded view.

### Phase 4 — remove redundant Previs-style Timeline playback controls

Remove from Timeline's main Human-facing workflow:

- Previous Shot;
- global Play / Pause;
- Next Shot;
- Playback Still images / Generated motion toggle;
- Written narration On / Off;
- separate playback monitor whose purpose is to alternate between still and motion content.

Do not remove stored narration/provenance from the data model.

Narration may still be visible in Shot information where useful, because it informs the motion-generation packet and downstream edit, but Timeline no longer needs a narration playback toggle simply to replay the Graphic Novel experience.

### Phase 5 — keep 25-Shot movie-building progression obvious

The Timeline should visually communicate progress such as:

`7 of 25 motion Shots ready`

Each Shot row should make its current state immediately recognizable:

- Still / Not generated;
- Preflight;
- Submitting;
- Queued;
- Running;
- Ready;
- Failed;
- Stale.

A Human should be able to work sequentially:

```text
01 Generate
02 Generate
03 Generate
...
25 Generate
```

or revisit any Shot independently.

Generation order does not change canonical Shot order.

### Phase 6 — Timeline assembly remains downstream of Shot generation

Do not remove the chronological assembly authority.

Timeline may continue to own:

- ordered Mini-Block placement;
- source/current/stale status;
- motion-take provenance;
- assembly/export;
- larger Block/movie continuity.

But the selected Mini-Block's primary creative task is now Motion Shot creation, not replaying Previs controls.

When enough motion Shots are ready, the assembly/export path should consume those current motion takes in canonical order while retaining explicit failures/missing Shots.

### Phase 7 — source and take lineage

When motion replaces the visible still in the Shot card:

- this is a presentation replacement only;
- the original locked Storyboard artifact remains authoritative upstream visual evidence;
- the generated video remains a candidate Production Take until Human review/approval rules say otherwise;
- Regenerate preserves earlier takes;
- upstream Storyboard changes mark the generated motion stale through existing packet/source-key semantics.

Do not overwrite the locked still asset URL with a video URL.

### Phase 8 — regression coverage

Add focused tests proving:

1. an ungenerated Shot displays its locked Storyboard still;
2. Generate motion invokes the current #2803 generation path;
3. generation state appears directly on the Shot;
4. a successful Shot displays a playable video in the Shot's primary visual area;
5. the locked still remains stored and traceable after motion succeeds;
6. inline Play/Pause works for that Shot;
7. playing one Shot stops another active Shot clip;
8. Expand opens a larger Shot review without leaving Timeline;
9. expanded review returns to the same Shot;
10. Timeline no longer exposes Previous Shot / global Play / Next Shot;
11. Timeline no longer exposes the Still images / Generated motion toggle;
12. Timeline no longer exposes Written narration On/Off;
13. narration/story evidence remains available as generation/context data where required;
14. failed/stale motion does not silently show the still as though motion succeeded;
15. #2809 failure truth remains visible;
16. regenerated motion preserves previous Production Take lineage;
17. 25-Shot order and ~3-second placement remain unchanged;
18. assembly/export behavior remains green.

### Scope boundaries

In scope:

- Timeline Shot-level still → motion presentation;
- inline motion playback;
- expanded Shot review;
- removal of redundant Previs-style playback controls;
- motion progress/readiness presentation;
- retaining source/take lineage.

Out of scope:

- changing Storyboard generation;
- changing Previs Graphic Novel behavior;
- changing narration generation/approval;
- changing #2803 provider selection or packet semantics;
- changing #2809 preflight error handling;
- changing Rough Cut;
- changing canonical 25-Shot mathematics.

### Acceptance criteria

- [ ] Timeline reads as a motion-generation workspace rather than another Previs player.
- [ ] Before generation, each Shot shows its locked Storyboard image.
- [ ] Generate motion acts on that Shot.
- [ ] A successful motion result replaces the still visually with a playable clip in that Shot row/card.
- [ ] The locked still remains preserved as upstream source/provenance.
- [ ] The motion clip can be played inline.
- [ ] The motion clip can be expanded to a larger approximately half-screen review.
- [ ] Expanding does not navigate away from Timeline.
- [ ] Previous Shot / global Play / Next Shot are removed from the primary Timeline UI.
- [ ] Still images / Generated motion toggle is removed.
- [ ] Written narration On/Off is removed.
- [ ] Timeline retains Shot-level narration/story evidence only as useful production context.
- [ ] Motion generation state remains visible on each Shot.
- [ ] Failed/stale Shots remain truthful and retryable.
- [ ] Motion Take provenance and prior generations remain preserved.
- [ ] 25 Shots remain ordered at approximately 3 seconds each.
- [ ] Existing assembly/export authority remains functional.
- [ ] Focused tests and required exact-head verification are green before merge.

### Definition of done

Timeline feels like the moment PlotPickle's Graphic Novel becomes a movie: each locked Storyboard Shot starts as a still, the Human generates motion for it, that Shot becomes a directly playable motion clip, and the 25 ordered clips can then be assembled into the moving visual story without repeating the Previs playback experience.

### Delivery rule

Build → focused test → fix → PR → required exact-head verification → fix until green → merge when green.

### Human clarification — top playback monitor and Timeline decluttering

Live UAT refined the layout after #2808 removes the obsolete Block Visual Workspace.

This clarification supersedes the earlier wording in this brief that implied the Playback Monitor itself should disappear.

#### Playback Monitor moves into the vacated top workspace

The space currently occupied by `BLOCK VISUAL WORKSPACE · TIMELINE` should become the selected-Shot Playback Monitor.

The intended interaction is:

```text
select Shot 01
→ top Playback Monitor shows Shot 01
→ if motion is Ready, Play runs that approximately 3-second clip
→ if motion is not Ready, monitor shows the locked still plus truthful generation state

select Shot 02
→ monitor updates to Shot 02
→ Play reviews Shot 02 independently
```

This is similar in orientation to Previs, but the media unit is different:

- Previs reviews still-frame / Graphic Novel presentation;
- Timeline reviews one generated motion Shot at a time.

The top monitor is the larger selected-Shot review surface requested by the Human. A second modal/full-screen implementation is not required for the first implementation unless later UAT proves it useful.

The monitor should be visually prominent—approximately the useful half-screen review role discussed in UAT—without becoming a separate application.

#### Keep Shot-level playback and top monitor synchronized

#2810 still requires each Ready Shot to expose its own motion state and direct Play affordance.

Selecting or playing a Shot should synchronize the top Playback Monitor to that Shot.

There must be one playback truth:

- the Shot row/card identifies the selected motion clip;
- the top monitor is the larger viewer for that same clip;
- do not create a second independent playback state.

#### Remove the old global Previs-style transport

The top Playback Monitor does **not** restore the redundant global controls.

Remove:

- Previous Shot;
- global Play/Pause transport across the 75-second still sequence;
- Next Shot;
- Playback: Still images / Generated motion;
- Written narration On / Off;
- global seek/scrub whose purpose is replaying the Previs-style sequence.

The selected Shot's own Play/Pause is sufficient for this phase.

#### Simplify the Selected Mini-Block inspector

The current Selected Mini-Block inspector contains controls that are not needed in the present Timeline product:

- `Open owning Previs Mini-Block`;
- `Open owning Storyboard Mini-Block`;
- `Move earlier`;
- `Move later`;
- `Remove placement`.

Remove those Human-facing controls from the primary Timeline surface.

Rationale:

- upstream visual choice/order is already established before Timeline;
- Timeline's current task is motion generation and review;
- manual reordering/removal can be reconsidered later if real editing UAT proves it is needed;
- removing the controls does not authorize deleting provenance, source snapshots or revision history.

Keep only compact selected Mini-Block information that materially supports motion generation, freshness, export or diagnostics.

#### Preserve continuity information

Keep the existing:

`Authoritative story and production continuity`

This information is valuable production context and should remain available.

Preserve, where authoritative:

- Scenes;
- dramatic responsibility;
- structural finding;
- action continuity;
- dialogue continuity;
- sound continuity;
- character / character truth;
- wardrobe / props / location unknown states;
- camera;
- blocking;
- transitions;
- lighting / palette;
- spatial / scene-flow evidence;
- synchronized screenplay source.

Unknown values must remain explicit.

#### Remove the bottom Media Timeline from the primary surface

The current bottom section:

`Media timeline · Chronological Mini-Block assembly`

does not provide enough value in the current motion-generation workflow and should be removed from the primary Timeline UI.

This supersedes #2797's earlier requirement to retain that rail.

Important authority boundary:

- remove the Human-facing rail;
- do **not** delete `TimelineAssemblyRevision`, source snapshots, provenance or canonical story order;
- do not add a new ordering store;
- underlying assembly/export code may continue to use canonical placement/source data as required.

Manual `Move earlier / Move later / Remove placement` controls are therefore also removed from the current product surface.

If later Rough Cut / editing UAT needs explicit reorder controls, that should be a later Human decision rather than preserving them speculatively in Timeline now.

#### Revised top-level Timeline information hierarchy

After #2808 + #2809 + #2810, the preferred Timeline order is:

1. compact production context;
2. selected-Shot Playback Monitor in the former Block Visual Workspace area;
3. authoritative visual references where useful;
4. 25-Shot motion-production board;
5. selected Shot story/camera/narration context;
6. Authoritative story and production continuity;
7. compact motion provider / export status where required.

Do not keep a separate bottom chronological rail solely because it existed previously.

#### Additional regression coverage

Add tests proving:

- the Playback Monitor is rendered in the primary/top Timeline region after the obsolete Block Visual Workspace is removed;
- selecting Shot N synchronizes the monitor to Shot N;
- a Ready Shot plays its approximately 3-second motion clip in the monitor;
- an ungenerated/failed/stale Shot shows truthful still/status evidence in the monitor without pretending motion is ready;
- no Previous Shot / global Play / Next Shot / Still-vs-Motion / narration toggle remains;
- Selected Mini-Block no longer exposes Open owning Previs;
- Selected Mini-Block no longer exposes Open owning Storyboard;
- Selected Mini-Block no longer exposes Move earlier;
- Selected Mini-Block no longer exposes Move later;
- Selected Mini-Block no longer exposes Remove placement;
- `Authoritative story and production continuity` remains;
- `Media timeline · Chronological Mini-Block assembly` is absent from the primary Timeline UI;
- Timeline assembly/source/provenance contracts remain intact beneath the UI;
- #2808 direct entry and #2809 truthful preflight failure behavior remain green.

#### Revised acceptance criteria

- [ ] The obsolete top Block Visual Workspace is replaced by the selected-Shot Playback Monitor.
- [ ] The monitor plays the selected Ready motion Shot, approximately three seconds at Timeline authority.
- [ ] Shot selection and monitor selection are one synchronized state.
- [ ] The monitor does not restore Previs-style global playback controls.
- [ ] Open owning Previs / Storyboard controls are removed from the primary Timeline UI.
- [ ] Move earlier / Move later / Remove placement are removed from the primary Timeline UI.
- [ ] Authoritative story and production continuity remains.
- [ ] The bottom Media timeline / Chronological Mini-Block assembly rail is removed from the primary Timeline UI.
- [ ] Underlying assembly revisions, source identity, stale detection and provenance are preserved.


### Human clarification — remove nested scroll windows and flatten production information

Live UAT identified a readability problem in the current Timeline implementation: too many sections behave like separate Windows-style scroll panes inside the page.

Confirmed current CSS includes independent scrolling for, among other areas:

- `.shotRows { max-height: 43rem; overflow: auto; }`
- `.storyEvidence { max-height: 15rem; overflow: auto; }`
- additional scrollable source/range/timeline containers.

This creates a "window inside a window" experience and makes production information harder to scan.

#### Product rule — one primary page flow

Timeline should prefer one natural vertical page scroll rather than stacking multiple independently scrollable content panes.

For the primary Timeline workflow:

- remove the internal max-height/vertical scrollbar from the 25-Shot board where practical;
- allow the 25 ordered Shots to flow naturally in the page;
- remove the independent vertical scrollbar from the screenplay/story-evidence section;
- do not create small scroll boxes for long-form production information simply to constrain panel height;
- preserve horizontal overflow only where genuinely required by narrow responsive layouts, and style/use it deliberately rather than exposing unnecessary default browser chrome.

The Human should generally scroll the Timeline page, not repeatedly enter and exit nested scroll regions.

#### Shot board

The 25-Shot motion-production board remains the primary visual sequence.

It should:

- show the complete ordered Shot list in a readable vertical flow;
- keep column/header context understandable without forcing a fixed-height Windows-style viewport;
- preserve selected-Shot visibility and keyboard accessibility;
- avoid a permanent internal scrollbar solely because there are 25 Shots.

If virtualization or bounded rendering is ever required for performance, it must preserve the same seamless page-reading experience and not reintroduce a visibly nested desktop-scroll window.

#### Production information directly below the Shot board

Immediately below the Shot board, present the useful authoritative production information as one coherent, well-formatted information section.

The Human specifically wants to be able to read together:

- Scene(s);
- current screenplay source;
- Character;
- Character truth;
- Camera;
- Blocking;
- Action continuity;
- Dialogue / narration continuity;
- Sound;
- Transitions;
- Wardrobe;
- Props;
- Location;
- Time / weather;
- Lighting / palette;
- dramatic responsibility;
- structural finding;
- spatial / scene-flow evidence.

This is information for understanding the selected Shot / Mini-Block, not a set of separate applications.

Use a clean production-information grid/columns with clear labels, generous line wrapping and hierarchy.

#### Current screenplay source

The current `Synchronized screenplay source` should no longer be presented as a stack of separate bordered mini-cards inside its own scroll area.

Instead:

- show the current authoritative screenplay passages mapped to the selected Mini-Block / Shot;
- preserve passage type and Scene number where useful;
- render the screenplay text as readable script/source text;
- keep it visually associated with the other Scene / Character / Camera / continuity information;
- allow the text to wrap and expand naturally;
- no internal vertical scrollbar for the screenplay text in the normal desktop layout;
- do not duplicate or rewrite the screenplay;
- do not manufacture timestamps or missing dialogue.

The screenplay remains source evidence, not a Timeline-authored copy.

#### Preferred information hierarchy after the Shot board

A practical layout is:

```text
25-Shot Motion Board
↓
PRODUCTION INFORMATION
  Scene / Story
  Character / Identity
  Camera / Blocking
  Continuity / Sound / Transition
  World / Location / Lighting
↓
CURRENT SCREENPLAY SOURCE
  readable mapped screenplay text
↓
remaining compact status/export/provider controls
```

Exact column counts are responsive implementation details, but the information should read as one designed production sheet rather than many unrelated bordered boxes.

#### Scrollbar acceptance

The goal is not to hide scrollbars cosmetically while keeping the same nested-scrolling behavior.

Acceptance requires reducing unnecessary independent scrolling regions.

Native browser scrollbars may still appear for the page itself and for a genuinely unavoidable horizontal overflow on smaller displays.

Do not use custom scrollbar styling as a substitute for correcting layout structure.

#### Additional regression coverage

Add tests / visual proof that:

- the 25-Shot board is not constrained by the old `max-height: 43rem; overflow: auto` desktop behavior;
- screenplay/story evidence is not constrained by the old `max-height: 15rem; overflow: auto` desktop behavior;
- mapped screenplay passages remain fully visible/readable in natural page flow;
- screenplay evidence stays tied to the selected authoritative Mini-Block / Shot;
- Scene / Character / Camera / continuity fields remain visible directly with the screenplay information;
- no screenplay data is duplicated into a second authority;
- responsive layouts remain usable at ordinary Windows desktop sizes;
- keyboard focus does not become trapped inside nested scroll panes;
- #2810's top Playback Monitor and Shot-level motion interaction remain intact.
