# #2803 Timeline provider-neutral 75-second Shot Generation Packets

## Phase 0 reuse decision

The implementation reuses the existing PlotPickle production chain instead of adding a parallel prompt, provider, continuity or media authority.

| Need | Decision | Existing owner |
| --- | --- | --- |
| 25 × ~3-second Timeline identity | REUSE | TimelinePrevisPlacement / fixed render-slot contract |
| Mini-Block story evidence | REUSE | Storyboard anchor evidence / screenplay / structure |
| Character visual truth | REUSE | Character Truth + approved World Map references |
| Camera / blocking / performance intent | REUSE | ProductionShotIntent |
| Provider-neutral production direction | REUSE / ADAPT | #2064 Director Specification and provider instruction boundary |
| Shot Generation Packet | PROJECT | Read-only deterministic projection assembled from existing authorities |
| Input-modality selection | ADAPT | Existing video routing plus actual provider/workflow capability |
| Native H3 workflow family | ADAPT | Existing H3 status/probe contract |
| Generated job state | ADAPT | TimelineMotionShot remains the Timeline job/view projection |
| Completed generated take lineage | REUSE | ProductionTake when an authoritative ProductionShot exists |
| Stale detection | ADAPT | Existing Timeline source key plus Shot Generation Packet fingerprint |
| Intended timing | REUSE | Timeline 3-second slot |
| Provider/observed timing | ADAPT | Provider job metadata / ProductionTake observedDurationSeconds |
| Human/cloud consent | REUSE | Existing Timeline confirmation and routing activation boundary |
| Verification | REUSE | Focused issue tests plus existing exact-head repository gates |

The Shot Generation Packet is deliberately not a second canonical store. It is regenerated from current authoritative project state. Provider-facing instruction prose remains disposable.

Existing saved TimelineMotionShot records are not deleted. Their older source key naturally becomes stale when compared with the richer packet fingerprint and the Human can regenerate them deliberately.

## Implemented packet

Each Timeline Shot can now project:

- stable project / placement / anchor / Shot identity;
- canonical project revision;
- fixed three-second Timeline intent;
- Mini-Block dramatic responsibility;
- mapped screenplay evidence;
- current, previous and next Shot progression context;
- approved Storyboard visual when available;
- a neighboring approved frame for eligible first/last-frame workflows;
- approved World Map character references;
- character truth;
- authored Production Shot camera, lens, movement, blocking, performance, pacing and transition direction;
- continuity locks;
- role-scoped reference bindings;
- upstream provenance references;
- deterministic packet fingerprint.

Unknown information stays absent rather than being invented.

## Capability-aware generation

Timeline no longer defines motion generation as “animate the approved first frame.”

The same packet can route through:

- text-to-video;
- image-to-video;
- first/last-frame;
- reference-to-video.

For native H3, Timeline now reads the actual workflowFamily exposed by the existing H3 probe and blocks incompatible workflows before submission. In-place video editing is not treated as Timeline Shot generation.

For cloud video routes, an approved source image is used when present; otherwise the packet can be expressed as text-to-video instead of failing merely because a locked frame is absent.

The existing no-silent-paid-fallback rule remains unchanged.

## Constrained local H3 correction

The current native H3 provider requires performanceAcknowledged for an 8 GB-class constrained VRAM profile.

Timeline now receives the saved constrained-VRAM acknowledgement from routing status and carries it into the generation request. This fixes the UAT failure where Timeline could pass readiness and then be rejected by the provider because the acknowledgement was dropped.

This does not promise successful generation on every 8 GB workflow. Hardware/runtime truth remains part of H3 readiness.

## Generated take lineage

TimelineMotionShot remains the Timeline job/progress record and now retains:

- generation mode;
- packet fingerprint;
- reference IDs actually selected for the packet;
- provider-native reported duration where available;
- optional ProductionTake link.

When a Timeline slot maps to an authoritative ProductionShot and generation succeeds, Timeline also stores a candidate ProductionTake through the existing production.take.store command. Intended three-second timing and observed/provider duration stay separate.

Older takes are not silently overwritten; a later regeneration can retain replacement lineage.

## Timeline UI

The existing #2797 cinematic production board remains the owner.

Each Shot row now exposes a compact Generation packet inspector with the Shot responsibility/progression and reference/provenance counts. Generate motion is no longer disabled solely because the Shot has no locked Storyboard image.

The existing Preflight / Queued / Running / Ready / Failed / Stale behavior, Human confirmation, playback and MP4 export remain in place.

## Verification

Focused #2803 coverage proves:

- deterministic packet identity and fingerprint changes;
- text-to-video without an image;
- image-to-video input requirements;
- first/last-frame requirements;
- incompatible H3 workflow rejection before dispatch;
- workflowFamily visibility;
- constrained-VRAM acknowledgement propagation;
- packet lineage in TimelineMotionShot;
- ProductionTake candidate projection;
- no regression back to the “must have image to animate” guard.

The older #2763 and #2776 motion tests are updated to assert the new capability-aware contract rather than the superseded image-only assumption.
