# #2807 Storyboard locked-shot Previs handoff matrix

## Developer Brief

### Objective

Replace the duplicate candidate-frame gallery at the bottom of Storyboard with a locked-shot information handoff for Previs.

Live UAT showed that the embedded `Storyboard detail` / Visual Story section can render dozens of frames (for example 67) including kept, candidate, recovered-local and other attached frame records.

That is redundant with the 25 Storyboard Shot cards above, where each Shot already owns its candidate browsing through left/right chevrons.

The bottom of Storyboard should therefore stop acting as a second frame browser.

Instead, it should summarize only the Human-locked Storyboard Shots and the structured information that will carry forward into Previs.

### Product decision

Candidate/version browsing belongs in the 25 Storyboard Shot cards.

```text
Shot 01 card
→ candidate 1 / 2 / 3 / ...
→ Previous / Next chevrons
→ Save / Lock / Unlock / Redo / Delete
```

The embedded section at the bottom becomes:

```text
LOCKED SHOT HANDOFF
→ one row per locked Shot
→ locked image
→ story / narration / camera / continuity / timing information
→ read-only projection into Previs
```

Do not show every candidate frame again.

### Confirmed current implementation

`storyboard-readiness-workspace.tsx` embeds `VisualStoryWorkspace` at the bottom of Storyboard with `embedded` and `allowTimeline={false}`.

The current `VisualStoryWorkspace` renders:

- Beat rows;
- Shot rows;
- every projected Frame at the anchor;
- an inspector for selected Shot details.

Its Frame row renders all projected frames, including non-accepted candidates. That is why the embedded Storyboard section can expand to dozens of duplicate frame cards even though the candidate versions are already available above.

The standalone Visual Story workspace has broader pre-production responsibilities under the existing Visual Story architecture. This issue should change the embedded Storyboard presentation without removing the standalone Visual Story capability.

### Existing authority to preserve

Reuse and project from existing owners:

- Storyboard accepted / locked artifact authority via `acceptedVisualArtifactIds`;
- Shot order 1–25;
- Storyboard candidate chevrons from #2483;
- Lock/Unlock semantics from #2806;
- Scene / Beat / Shot projection from `projectVisualStory(...)`;
- Storyboard narrative purpose / visual intent;
- Shot size;
- angle;
- movement;
- lens;
- lighting intent;
- timing when authored;
- information directives (SHOW_NOW / WITHHOLD_NOW);
- Production Shot / Previs direction where already authored;
- existing Previs narration / presentation data when it exists;
- screenplay / Scene / Beat evidence;
- continuity / provenance already attached to the Shot or locked artifact.

Do not create a second Shot, Frame, narration, camera, continuity or Previs store.

### Phase 1 — remove duplicate embedded candidate gallery

When `VisualStoryWorkspace` is embedded inside Storyboard:

- do not render the broad Frame row that displays every attached candidate;
- do not render recovered/candidate images as a second version browser;
- do not duplicate the 25 Shot cards' image-version controls;
- preserve standalone Visual Story behavior outside the embedded Storyboard context unless a separate Human decision changes it.

Candidate history remains reachable exclusively from each Shot's existing Previous / Next chevrons.

### Phase 2 — locked-shot handoff matrix

Replace the embedded bottom detail with a read-only matrix/grid containing one row for each locked Storyboard Shot in the selected Mini-Block.

Only accepted/locked Storyboard images are rows.

If 18 of 25 Shots are locked, show 18 rows and a concise status such as:

`18 of 25 Shots locked · 7 still open`

Do not fabricate placeholder locked rows.

Recommended columns / fields, where available:

1. Shot
   - Shot number;
   - stable Shot identity.

2. Locked Image
   - authoritative locked Storyboard image only;
   - never an unlocked candidate.

3. Story Responsibility
   - narrative purpose;
   - visual intent;
   - Scene / Beat relationship;
   - relevant screenplay evidence summary.

4. Narration / Dialogue
   - existing approved/saved Previs narration when available;
   - relevant mapped dialogue or narration evidence when already authored;
   - otherwise `Not authored` / `Not generated yet`;
   - no provider call merely to populate this matrix.

5. Camera
   - shot size;
   - angle;
   - lens;
   - movement;
   - framing/composition where authoritative.

6. Performance / Blocking
   - character/action blocking;
   - performance energy / action intent where authored.

7. Lighting / Look
   - lighting intent;
   - time/environment/look references where authoritative.

8. Timing
   - intended Shot duration when authored;
   - otherwise the current Storyboard planning target (~3 seconds) clearly labelled as a planning target, not observed media duration.

9. Information Boundary
   - audience learns now;
   - audience must not know yet;
   - omit or compact this column for ordinary Shots without directives.

10. Continuity / Handoff
   - continuity in/out;
   - neighboring Shot relationship;
   - relevant identity/wardrobe/location/prop continuity where already known.

11. Previs Readiness
   - Locked;
   - which structured fields are present/missing;
   - no false claim that Previs media/narration has been generated when it has not.

The exact visual layout may group related fields to keep the matrix readable, but the Human should be able to scan the locked image and its downstream directing information horizontally.

### Phase 3 — selected-row detail

If the complete information set is too wide for one row:

- keep the high-value columns visible;
- allow one locked Shot row to expand inline for secondary information;
- do not open another page;
- do not reintroduce a second image gallery;
- do not require the Human to inspect provider-specific prompt text.

Provider-facing/generated director instructions remain Advanced/read-only material under their existing authority and are not the primary Storyboard handoff.

### Phase 4 — Previs handoff parity

The matrix is a projection of information Previs can consume later.

Prove that the same locked Shot identity and fields resolve consistently when entering Previs.

Important boundaries:

- Storyboard remains the owner of image Lock authority.
- Previs remains the owner of its playback/presentation behavior.
- Narration shown in Storyboard is existing saved/approved presentation data or authoritative source evidence; Storyboard does not silently generate new narration.
- Camera/production fields shown here remain owned by their current Shot / ProductionShot authorities.
- Unknown information stays explicit.

### Phase 5 — regression coverage

Add focused tests proving:

1. embedded Storyboard no longer renders all projected candidate Frames;
2. the candidate versions remain browsable through the 25 Shot-card chevrons;
3. only accepted/locked Storyboard images appear in the bottom handoff matrix;
4. one locked image per Shot produces at most one handoff row;
5. an unlocked candidate never appears as a locked handoff row;
6. Unlocking a Shot via #2806 removes that row from the locked handoff;
7. re-locking it restores the row;
8. narration is displayed only when existing narration/presentation authority exists;
9. missing narration/camera/continuity fields are reported honestly;
10. standalone Visual Story retains its broader Frame/Shot behavior unless intentionally changed elsewhere;
11. entering Previs resolves the same locked artifact identity;
12. no story canon or approval state changes merely by viewing the handoff.

### Scope boundaries

In scope:

- embedded Storyboard detail only;
- removal of duplicate candidate-frame gallery;
- locked-shot handoff matrix;
- read-only Story/Shot/Previs information projection;
- locked count / missing-lock summary;
- regression and Previs identity parity.

Out of scope:

- changing candidate generation;
- changing the number of candidates per Shot;
- changing chevron behavior;
- changing Lock/Unlock authority (#2806);
- changing WebP routing (#2805);
- generating narration automatically just to fill the handoff;
- redesigning standalone Visual Story;
- redesigning Previs playback;
- creating a new production-data store.

### Acceptance criteria

- [ ] The bottom embedded Storyboard section no longer displays dozens of candidate/recovered Frames.
- [ ] All image-version browsing remains available through each Shot's chevrons.
- [ ] The bottom section shows only locked Storyboard Shots.
- [ ] Each locked Shot appears once.
- [ ] The locked image shown is the same accepted artifact used by Previs.
- [ ] The handoff exposes story responsibility and Scene/Beat context.
- [ ] Existing narration/dialogue data is shown where available without inventing new text.
- [ ] Camera size, angle, lens and movement are shown where authored.
- [ ] Performance/blocking, lighting/look, timing, information-boundary and continuity fields are shown where authoritative.
- [ ] Missing fields are explicitly marked rather than fabricated.
- [ ] Unlocking a Shot removes it from the locked handoff.
- [ ] Re-locking restores it.
- [ ] The matrix reports locked count versus 25 planned Shots.
- [ ] Standalone Visual Story is not unintentionally stripped of its broader visual-production role.
- [ ] Viewing the handoff cannot mutate canon, locks or production intent.
- [ ] Focused tests and required exact-head verification are green before merge.

### Definition of done

At the bottom of Storyboard, the Human no longer sees a second gallery of every candidate Frame. Instead, they see a concise Previs-oriented handoff of the Shots they have actually locked, with each locked image and the story, narration, camera, timing, continuity and production information already known for that Shot.

### Delivery rule

Build → focused test → fix → PR → required exact-head verification → fix until green → merge when green.

### Human clarification — Storyboard narration / comic-bubble authoring

The last field in the locked-shot handoff is not merely read-only narration status.

For each locked Storyboard Shot, the Human wants an explicit narration/presentation authoring action that can use PlotPickle's existing Graphic Novel agent to propose the wording for that particular Shot.

The intended flow is:

```text
locked Storyboard Shot
→ Generate Narration / Bubble
→ Graphic Novel agent receives bounded Shot + screenplay + locked-image evidence
→ returns short narration and/or comic-style speech bubble
→ Human reviews/accepts
→ save through existing PrevisGraphicNovelTextApproval authority
→ Previs reads the exact approved text
→ Timeline reuses the same approved text when its source key is still current
```

#### Reuse the existing narration authority

Do not create a Storyboard-only narration store.

Reuse:

- `app/api/previs/narration/route.ts`;
- the existing `graphic-novel` agent execution profile;
- `core/media/previs-narration.mjs` validation and source-bounded narration rules;
- `PrevisGraphicNovelTextApproval`;
- `PrevisProductionState.graphicNovelTextApprovals`;
- existing source-key staleness semantics;
- Timeline's existing reuse of approved Previs narration.

The current contract already separates presentation text from screenplay/story canon. Preserve that boundary.

#### Shot-level UX

In the locked-shot handoff, the final presentation field should expose:

- current approved narration, if one exists;
- current approved speech bubble, if one exists;
- an explicit `Create Narration` / `Regenerate` action for that locked Shot;
- Human review before approval;
- an explicit no-text/silent choice using the existing `noText` authority.

The visual presentation should read like a Graphic Novel / comic-book treatment.

Where dialogue is returned, render it as a comic-style speech bubble associated with the named screenplay character.

Where narration is returned without dialogue, render it as a compact caption/narration treatment.

A Shot may remain deliberately silent.

#### Agent boundaries

The agent must be grounded only in bounded evidence for the selected locked Shot and its immediate story context:

- locked Storyboard image;
- mapped screenplay passages;
- Shot narrative intention / story responsibility;
- Scene / Beat context;
- approved character identity/reference evidence where required.

The screenplay governs events and speakers.

Do not:

- invent a speaker not present in screenplay evidence;
- invent plot events;
- rewrite story canon;
- alter the locked image;
- auto-approve generated text;
- generate text for unlocked candidates.

The current parser limits should remain the default safety envelope unless later Human review explicitly changes them:

- short narration;
- at most one concise speech bubble per Shot;
- named screenplay speakers only.

#### Source-key and staleness behavior

The approved text must remain tied to the exact locked-image/story source key.

If the Human:

- unlocks the image;
- locks a different candidate;
- changes relevant screenplay/story evidence;

then the previous narration approval becomes stale and must not silently flow forward as current.

It may remain preserved as historical presentation evidence, but Previs and Timeline should require current approved text or explicit silence.

#### Downstream behavior

Previs:

- shows/plays the exact Storyboard-approved narration/bubble;
- does not regenerate it simply because the Human entered Previs;
- may still offer its existing narration workflow for Shots with no current approved text.

Timeline:

- uses the same approved narration/bubbles through its existing Previs narration handoff;
- does not independently invent replacement narration;
- preserves silent Shots.

This makes Storyboard the earliest place to author the presentation wording while keeping Previs/Timeline as downstream consumers of the same approved presentation record.

#### Additional acceptance criteria

- [ ] Each locked Shot has a narration/presentation cell.
- [ ] The Human can ask the existing Graphic Novel agent to propose text for that locked Shot.
- [ ] Generated text is reviewable before approval.
- [ ] Approved narration/bubbles are stored through `PrevisGraphicNovelTextApproval`, not a new Storyboard store.
- [ ] A Shot can explicitly be marked silent/no-text.
- [ ] Unlocked candidates cannot own current approved narration.
- [ ] Changing the locked image or relevant source evidence makes prior narration stale.
- [ ] Previs reads the same approved text without regenerating it.
- [ ] Timeline reuses the same current approved text/bubbles.
- [ ] No narration action changes screenplay/story canon or image Lock authority.
