# #2161 — Coherent Outline → Storyboard → Visual Story → Previs flow

## Purpose

Repair the Human-tested visual story-building journey without inventing new story, provider, Build, Storyboard or Previs authorities.

This work follows #2159 Phase 1: the canonical Surface Registry now owns verification scope. Every repaired surface must stay inside the current Skin V1 Matrix grammar and the same Human-approved Dashboard shell.

## Human UAT path and findings

The September 17 UAT walked:

`Dashboard → Outline → Block 01 / Awakening → Mini-Blocks 1–4 → Storyboard → Visual Story / Scene Workspace → Previs / Build`.

Observed behavior:

- Outline opens correctly and the selected Block/Mini-Block changes as expected.
- Mini-Block detail exposes Anchor, Promise, read-only source/background story text, Save and Add a Visual.
- Dashboard Previs is visibly in-review but selecting it does not open Previs.
- Storyboard is functionally present but feels like an older/parallel application rather than the current Skin V1 continuation.
- the empty `+` preview in Storyboard looks interactive but is not an action.
- `Open Visual Story` changes selection but can look like a no-op because the projection is below the fold and may truthfully contain no related Scene.
- Scene Workspace exists but its relationship to Visual Story is not obvious.
- `Open BUILD evidence` and other `/?workspace=build` handoffs leave Skin V1 and, after the Skin V1 bootstrap takes authority, appear to drop the Human back rather than continue the flow.
- Add a Visual can correctly reject a Story Mode CLOUD / selected image route LOCAL mismatch, but the message does not provide a clear in-context path to the governing configuration.

## Canonical model carried forward from prior decisions

1. 4 Acts → 12 Sequences → 24 Blocks → 96 Mini-Blocks is the stable structural address space.
2. Scenes, Beats, creative Shots and Frames are variable-density story/visual objects. They are not forced to equal the 96 anchors.
3. The 2,400 RenderClip grid is technical production plumbing, not a creative shot quota.
4. Outline / Story Map owns structural navigation.
5. Storyboard owns visual planning around the selected Block and Mini-Block addresses.
6. Visual Story projects real `Scene → Beat → Shot → Frame` relationships.
7. Scene Workspace is a sibling timing/order view over the same selected material.
8. Previs owns creative camera/timing intent downstream of kept Storyboard evidence.
9. Missing Scene/Beat/Shot/Frame material stays truthfully empty. PlotPickle never manufactures canon to make a screen look populated.
10. Settings / Story Mode remains Local/Cloud/Hybrid provider-policy authority.

## Implementation contract

### Skin V1 flow state

The Dashboard review host owns the temporary in-shell navigation state for the Human review journey:

- Outline
- Build evidence
- Storyboard
- Previs

It also owns the selected `{ blockNumber, miniBlockNumber }` review address so moving among these projections does not lose context.

This state is UI navigation context only. It is not story canon and it does not replace the PPF.

### Reusable review surfaces

Create bounded Skin V1 adapters around existing authorities rather than importing legacy route shells:

- Storyboard review adapter loads the current canonical project and reuses `StoryboardReadinessWorkspace`.
- Previs review adapter loads the current canonical project and reuses `PrevisReadinessWorkspace`.
- Build review adapter reuses the existing `FoundationsBuildWorkspace` with the existing curriculum.

The standalone `/storyboard`, `/previs` and `/?workspace=build` routes remain available for compatibility. Skin V1 no longer needs to leave its shell for these review handoffs.

### Story address continuity

`Block NN · Mini-Block N` must remain visible and preserved when moving:

`Outline → Storyboard → Visual Story / Scene Workspace → Previs`.

Where a downstream authority only uses Block initially, preserve the Mini-Block as review context and use it when opening the owning Storyboard anchor.

### Visual Story affordance

`Open Visual Story` must:

- update the selected Mini-Block;
- scroll/focus the Visual Story projection;
- make the selected address visible;
- render either real Scene/Beat/Shot/Frame material or the existing truthful empty state.

No synthetic Scene is created.

### Scene Workspace affordance

Visual Story and Scene Workspace are explicitly labeled as sibling views over the same selected material. Switching view preserves Block/Mini-Block and real Scene/Shot selection. The Scene Workspace converges the source preview, intent playback, cue inspector and Dialogue / Action / Shot / Audio lanes without introducing another timeline store.

### Empty `+` preview

The `+` in an empty Storyboard preview is presentation-only today; it has no existing generation action. Replace it with a non-interactive `NO VISUAL YET` state so the UI does not advertise a dead control.

### Build handoff

Skin V1 Build links open the existing Build workspace inside the current review host. No second Build implementation is created.

### Story Mode / image-route mismatch

The existing Add-a-Visual logic remains authoritative. When policy and selected route locality disagree, the message must state both values and expose one direct `Open Story Mode Settings` action. The action signals the current Skin V1 host to open the existing Story Mode settings surface. It never changes provider or policy automatically.

## Non-goals

- no new provider selector;
- no automatic Story Mode switch;
- no generated placeholder Scene/Beat/Shot/Frame;
- no second Build workspace;
- no new PPF store;
- no route removal;
- no broad Storyboard/Previs redesign beyond Skin V1 continuity and clear handoffs;
- no new visual baseline lock without Human review.

## Acceptance criteria

1. Dashboard Previs opens the existing Previs authority inside Skin V1 and remains marked in-review.
2. Dashboard Storyboard stays inside the current Skin V1 shell with one standard header/return path.
3. Outline can hand off the selected Block/Mini-Block to Storyboard and Build without leaving Skin V1.
4. Storyboard clearly displays the current Block/Mini-Block address.
5. `Open Visual Story` visibly moves to the projection and always produces either real content or a truthful explicit empty state.
6. Scene Workspace is clearly a sibling view over the same selection.
7. Previs receives the selected Block context and can return to the owning Storyboard address.
8. `Open BUILD evidence` opens canonical Build inside Skin V1.
9. Dead `+` chrome is removed/replaced with an honest empty-preview label.
10. Story Mode/image-route mismatch states both active values and offers a direct link to existing Story Mode Settings.
11. No story/visual canon is fabricated and no provider/policy is silently changed.
12. Focused regression tests and exact-head Architecture Verification are green before merge.
