# #2458 Story-to-Screen Convergence — Phase 0 Ownership Audit

Issue: #2458

## Decision

The proposed PlotPickle Production Packet is a projection, not a new persistent store.

The existing modern PPF already owns the upstream identities needed by the story-to-screen chain. #2458 adds only the downstream records that were genuinely absent: typed Sound intent, versioned generated takes, Rough Cut revisions and Screening observations.

## Authority map

| Need | Existing / new authority | Decision | Persistence owner | Consumers |
| --- | --- | --- | --- | --- |
| Story / 24×96 address | Library PPF structure + source evidence | REUSE | Library PPF | Outline, Storyboard, Previs, Timeline |
| Locked Storyboard visual | existing Build / Storyboard visual artifact authority | REUSE | Library PPF Build | Previs, Production Packet |
| Creative Shot identity | `ProductionShotIntent` | REUSE | `PPFProject.production.shots` | Previs, Timeline, Rough Cut, Screening |
| Intended Shot timing | `ProductionShotIntent.durationSeconds` | REUSE | Previs authority | Timeline, Rough Cut |
| Provider-neutral production intent | `PreproductionProductionIntent` + Director Specification | REUSE / PROJECT | no new packet store | provider adapters, Rough Cut |
| Observed generated timing | Sequence Evidence / take observation | REUSE + PROJECT | evidence / take record | Rough Cut, Screening |
| Timeline cue projection | Scene Timeline + Scene Workspace | REUSE / ADAPT | source owners remain authoritative | Timeline |
| Narration / Music / Foley intent | typed `ProductionSoundCue` | NEW bounded record | `PPFProject.production.soundCues` | Timeline, Rough Cut, Screening |
| Generated video/audio take lineage | `ProductionTake` | NEW bounded record | `PPFProject.production.takes` | Rough Cut, Screening |
| Rough Cut assembly revision | `RoughCutRevision` | NEW bounded record | `PPFProject.production.roughCuts` | Rough Cut, Screening |
| Screening findings | `ScreeningObservation` | NEW evidence record | `PPFProject.production.screeningObservations` | Screening / bounded repair routing |
| Technical 25×3s render grid | existing RenderClip / Sequence Evidence | REUSE | existing evidence system | generation verification |
| Human consequential edits | Creative Transaction / current command authority | REUSE | existing PPF mutation path | all downstream surfaces |

## Stable identity

A downstream item continues to reference the existing Production Shot id, Storyboard artifact id, Storyboard dependency key and story address.

No new Scene, Beat, Shot, Frame or timeline identity is introduced by #2458.

## Intended versus observed timing

Intended timing remains `ProductionShotIntent.durationSeconds`.

A generated take may record `observedDurationSeconds`, but that value never overwrites intended timing.

Sequence Evidence remains the stronger machine-observation authority where technical measurement exists.

## Sound ownership

The old legacy Sonic Cue model remains readable where current legacy project context exists.

The modern PPF now owns explicit typed sound intent:

- Narration
- Music
- Foley

A Sound cue may attach to a Production Shot or to the owning Storyboard Mini-Block address. Untimed cues remain untimed.

## Take ownership

A Production Take records:

- Production Shot id;
- Storyboard dependency key;
- project revision at generation/registration;
- durable media reference;
- provider/model provenance;
- intended duration;
- observed duration when known;
- Human review state;
- provenance references.

A later take never deletes an earlier take.

Storyboard dependency drift makes a take stale. Ordinary downstream PPF writes do not stale media merely because the project revision number advanced.

## Rough Cut ownership

A Rough Cut is a revisioned assembly projection over approved Production Shots.

Each placement records:

- Production Shot id;
- selected take id or explicit missing media;
- associated Sound cue ids.

Creating a later cut records `supersedesCutId`; earlier cuts remain recoverable.

A missing take remains an explicit placeholder. PlotPickle does not claim final media exists when it does not.

## Screening ownership

Screening reads a Rough Cut revision and stores observations as evidence.

An observation can be anchored to:

- the whole cut;
- a Production Shot;
- a time range;
- later, a specific Sound cue where needed.

Screening does not automatically:

- change story canon;
- modify a Shot;
- move Timeline timing;
- regenerate media;
- approve/reject a take;
- assign an opaque overall film-quality score.

The Human remains the decision authority.

## SceneFlow / Framewright / Wind Comic adaptation boundary

SceneFlow informed synchronized cue projection and intended-versus-observed comparison.

Framewright informed immutable/versioned take thinking and a provider-neutral Production Packet projection.

Wind Comic informed bounded reruns, take/version lineage and Rough Cut / Screening repair loops.

None of these repositories is added as a dependency, and none becomes a PlotPickle storage or provider authority.

## Current Previs boundary

The September 25 Act-first Previs + locked-frame Flip Book remains the upstream UI boundary.

#2458 does not replace or redesign it.

The downstream chain is:

```text
locked Storyboard Frame
→ Previs Production Shot
→ Timeline + Sound intent
→ versioned Take
→ Rough Cut revision
→ Screening observation
→ bounded Human repair
```

## Verification by change type

- PPF production contract change → normalization + story-command regression.
- Sound change → Sound persistence + Timeline cue projection.
- Rough Cut change → take lineage + prior-cut preservation.
- Screening change → observed evidence + no automatic canon mutation.
- Dashboard navigation change → menu state + routing regression.
- Previs-related change → Act-first Previs boundary regression.
- Full build, architecture and visual readiness remain existing GitHub gates; #2458 adds no permanent CI workflow.
