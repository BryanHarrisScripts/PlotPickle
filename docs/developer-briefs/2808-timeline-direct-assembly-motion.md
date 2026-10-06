# #2808 Timeline direct assembly / motion entry

## Developer Brief

### Objective

Remove the obsolete Block Visual Workspace from the Timeline surface so Timeline opens directly into the current cinematic assembly / motion-generation workspace.

Live UAT showed that entering Timeline currently presents a section labelled approximately:

`BLOCK VISUAL WORKSPACE · TIMELINE`

This section allows the Human to:

- select screenplay passages / Scene-related source material;
- edit a visual prompt;
- generate still images through the configured image route (for example ComfyUI);
- accept a first image;
- build a still-image sequence;
- preview that rough sequence.

Those are upstream visual-development responsibilities already owned by Storyboard and Previs.

Timeline should not ask the Human to repeat passage selection or still-image generation before reaching the actual Timeline.

### Product decision

The visual-production progression remains:

```text
Outline
→ Storyboard
→ Previs
→ Timeline
→ Rough Cut
```

Responsibilities:

- Outline: story structure / intent.
- Storyboard: 25 planned Shots per Mini-Block, candidate image generation/review, Save, Lock/Unlock, approved image.
- Previs: presentation/rehearsal of locked Shots, narration/bubbles, timing/camera preview.
- Timeline: assemble approved/current Previs/Storyboard-derived Shots, generate or attach motion, scrub/play, compare against screenplay, arrange timing and export.
- Rough Cut: downstream committed edit/assembly review.

Timeline must not recreate the Storyboard image-development workflow.

### Confirmed current implementation

The Timeline host currently renders both:

1. `BlockVisualJourneyWorkspace` with `stage="timeline"`;
2. `SkinV1TimelineReviewSurface`, which contains the actual `TimelineAssemblyWorkspace`.

The first component is the redundant layer.

`app/skin-v1/block-visual-journey-workspace.tsx` still contains:

- passage selection;
- Storyboard anchor evidence;
- editable still-image prompts;
- `POST /api/local-ai/generate/image`;
- route/provider readiness;
- cloud billing acknowledgement;
- acceptance of a first generated image;
- sequence-image generation;
- still-image preview.

This is why Timeline appears to repeat work already completed upstream.

### Existing contract / regression relationship

#2759 already established that Timeline:

- consumes approved Previs media / locked visual sources;
- must contain no Shot/image generation authority;
- should send the Human upstream when source visuals need revision.

#2759 is closed because the Timeline assembly workspace itself was implemented.

However, the host still mounts `BlockVisualJourneyWorkspace stage="timeline"` before the assembly workspace.

The existing #2759 regression test checks the `TimelineAssemblyWorkspace` for absence of image/provider controls but does not assert that the Timeline host excludes the older Block Visual Workspace.

This issue closes that coverage gap.

### Current Timeline authority to preserve

Preserve the current Timeline work delivered through the later Timeline architecture, including:

- #2759 Timeline assembly;
- #2763 Previs narration / Timeline playback and export lineage;
- #2797 cinematic 25-Shot Timeline production board;
- #2803 provider-neutral Shot Generation Packets and motion-generation flow;
- current locked Storyboard/Previs source projection;
- current stale/source-revision handling;
- current Timeline motion generation;
- current 25 × ~3-second Mini-Block structure;
- screenplay context / provenance;
- Human provider consent and routing;
- Timeline assembly revisions;
- MP4/export behavior;
- upstream navigation to Storyboard / Previs.

Do not remove the actual Timeline assembly or motion controls.

### Phase 1 — remove obsolete Timeline mount

In `dashboard-bbs-review-host.tsx`:

- do not mount `BlockVisualJourneyWorkspace` for the Timeline surface;
- Timeline should render the current Timeline review/assembly surface directly;
- preserve the selected Block / Mini-Block address;
- preserve Back to Dashboard and existing story navigation.

Do not delete `BlockVisualJourneyWorkspace` globally merely because Timeline no longer uses it. First verify whether another surface still legitimately consumes it.

### Phase 2 — eliminate Timeline still-image authority

After the host cleanup, prove that Timeline no longer exposes:

- Select Written Passage;
- editable still-image prompt;
- Create First Image;
- Use Image;
- Build Sequence;
- still-image sequence generation;
- image-provider selection/readiness;
- ComfyUI/OpenAI/MiniMax image-generation controls;
- cloud image billing acknowledgement.

If Timeline needs a different locked source image, it should provide a clear navigation path to the owning Storyboard Shot, not regenerate the image locally.

### Phase 3 — direct Timeline entry

Opening Timeline from the Dashboard should land immediately in the current Timeline assembly / cinematic production board.

The first useful content should be Timeline-owned information such as:

- current Block / Mini-Block context;
- available approved/locked source coverage;
- Timeline placements / Shot rows;
- playback / scrub;
- current still/motion state;
- narration where approved;
- Generate Motion / motion status;
- source freshness / stale state;
- assembly/export controls.

Do not force an upstream planning task before those controls become visible.

### Phase 4 — preserve source context without re-authoring it

Timeline may continue to display screenplay / Scene / Beat / Shot evidence as read-only context and provenance.

Distinction:

- display source context = valid;
- ask Human to re-select source passage = redundant;
- use source context in #2803 Shot Generation Packets = valid;
- generate replacement Storyboard still = upstream responsibility.

The source context should follow the selected Timeline Shot rather than becoming a separate pre-Timeline workflow.

### Phase 5 — regression coverage

Add/update focused tests proving:

1. the Timeline host does not mount `BlockVisualJourneyWorkspace stage="timeline"`;
2. Timeline opens directly into `SkinV1TimelineReviewSurface` / `TimelineAssemblyWorkspace`;
3. no Timeline surface exposes `/api/local-ai/generate/image` controls;
4. no Timeline surface exposes passage-selection or still-sequence authoring controls;
5. Timeline still exposes current motion generation;
6. Timeline still exposes navigation to owning Storyboard and Previs;
7. screenplay/Scene/Beat evidence remains readable as context/provenance;
8. locked Storyboard/Previs sources still populate Timeline;
9. stale-source handling still works;
10. #2797 cinematic board behavior remains intact;
11. #2803 Shot Generation Packet / motion generation remains intact;
12. existing Timeline playback/export tests remain green.

Strengthen the #2759 regression so it validates the composed Timeline host, not only the inner assembly component.

### Scope boundaries

In scope:

- Timeline host composition;
- removal of redundant Block Visual Workspace from Timeline;
- direct entry into assembly/motion;
- regression coverage for composed Timeline;
- preserving source context as read-only provenance.

Out of scope:

- changing Storyboard image generation;
- changing Previs narration;
- changing #2803 motion packet semantics;
- redesigning Timeline motion providers;
- deleting BlockVisualJourneyWorkspace if it is still legitimately used elsewhere;
- redesigning Rough Cut;
- changing the canonical 25-Shot / ~75-second Mini-Block mathematics.

### Acceptance criteria

- [ ] Timeline no longer renders `BLOCK VISUAL WORKSPACE · TIMELINE`.
- [ ] Timeline no longer asks the Human to select a written passage before working.
- [ ] Timeline no longer provides still-image generation controls.
- [ ] Timeline no longer provides first-image acceptance or still-sequence generation.
- [ ] Opening Timeline lands directly in the current assembly/cinematic Shot workspace.
- [ ] Existing locked Storyboard/Previs material appears without re-authoring.
- [ ] Timeline can still show mapped screenplay/Scene/Beat evidence as read-only context.
- [ ] Motion generation remains available through the current Timeline provider-neutral path.
- [ ] 25 × ~3-second Shot timing remains unchanged.
- [ ] Existing narration, playback, stale-source, placement, export and provenance behavior remains intact.
- [ ] Upstream visual corrections navigate to Storyboard/Previs rather than creating images in Timeline.
- [ ] #2759 regression coverage is strengthened to test the composed Timeline host.
- [ ] #2797 and #2803 focused tests remain green.
- [ ] Required exact-head verification is green before merge.

### Definition of done

When the Human selects Timeline, PlotPickle no longer repeats visual-development work already completed in Storyboard and Previs. Timeline opens directly into the cinematic assembly workspace, where existing locked Shots can be arranged, reviewed, given motion, played and exported while retaining upstream screenplay and visual provenance.

### Delivery rule

Build → focused test → fix → PR → required exact-head verification → fix until green → merge when green.