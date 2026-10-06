# #2809 Timeline motion preflight failure visibility

## Developer Brief

### Objective

Fix the Timeline motion-generation regression where pressing **Generate motion** briefly shows **PREFLIGHT** and then silently returns the Shot to **NOT GENERATED**.

Live UAT symptom:

```text
select Storyboard frame / Shot
→ Generate motion
→ PREFLIGHT
→ NOT GENERATED
→ no visible Shot-level explanation
```

The Human cannot tell whether:

- no compatible video route exists;
- the selected local workflow family is incompatible;
- provider readiness failed;
- a required source/reference is missing;
- route status could not be read;
- another preflight check failed.

The Shot therefore looks as though no attempt occurred.

### Confirmed current implementation

`generateMotionShot(...)` in `app/_components/timeline/timeline-assembly-workspace.tsx` currently does:

1. set `generatingMotionStage("PREFLIGHT")`;
2. call `resolveTimelineMotionRoute(packet)`;
3. if route resolution / strategy eligibility throws:
   - write the error to the general Timeline `message`;
   - write it to `motionRouteMessage`;
   - clear `generatingShotNumber`;
   - clear `generatingMotionStage`;
   - return;
4. no `TimelineMotionShot` failure record is stored.

The Shot row label is derived as:

```text
working stage
→ stale
→ current succeeded/failed status
→ NOT GENERATED
```

Because preflight failure clears the working state and creates no current motion record, the row immediately falls back to `NOT GENERATED`.

This is a UI/state-truth regression, regardless of the underlying provider reason.

### Existing contract to preserve

#2776 explicitly required:

- PREFLIGHT;
- SUBMITTING;
- QUEUED;
- RUNNING;
- READY;
- FAILED;
- STALE;

and required a failure to be visible beside the Shot rather than looking like a dead button.

#2803 later extended motion generation with provider-neutral Shot Generation Packets and capability-aware modality selection.

This issue restores that truthfulness without weakening #2803 routing/capability rules.

### Product decision

`NOT GENERATED` means exactly:

> No current motion generation attempt exists for this Shot Generation Packet.

Once the Human presses **Generate motion**:

- an actual preflight failure must become a visible failure state;
- the exact failure reason must remain attached to the Shot;
- the button becomes **Retry motion**;
- the Human must not have to hunt for a status message elsewhere on the Timeline.

### Required Shot-level states

Use the existing state vocabulary wherever possible:

- NOT GENERATED — pristine / never attempted for this current packet;
- PREFLIGHT — actively checking route/capability;
- AWAITING CONFIRMATION — optional explicit transient state after successful preflight and before Human confirmation;
- SUBMITTING;
- QUEUED;
- RUNNING;
- READY;
- FAILED;
- STALE.

If the existing persisted contract should not add `preflight-failed` as a new enum value, represent the durable result as `status: "failed"` with stage/provenance in the error/details.

Do not overload `NOT GENERATED` with failed attempts.

### Phase 1 — persist / retain preflight failure truth

When `resolveTimelineMotionRoute(packet)` or strategy eligibility fails:

- retain the Shot identity;
- retain the packet fingerprint / source key;
- retain the exact stage (`PREFLIGHT`);
- retain the actionable error text;
- render the Shot as FAILED rather than NOT GENERATED;
- expose **Retry motion**.

Preferred reuse path:

- store a failed `TimelineMotionShot` through the existing `production.timeline.motion.store` command;
- provider / route / job fields may remain empty when no provider request was made;
- preserve packet fingerprint, source key, generation references and requested Timeline duration.

Do not create a second motion-error store.

### Phase 2 — make the failure visible where the Human acted

The affected Shot row must show, immediately and after reload:

- `FAILED` or `PREFLIGHT FAILED`;
- the exact reason;
- current route/capability context where useful;
- **Retry motion**.

Examples:

- `PREFLIGHT FAILED · No verified video generation route is ready.`
- `PREFLIGHT FAILED · Active local H3 workflow family is unknown.`
- `PREFLIGHT FAILED · Image-to-video requires an approved source image.`
- `PREFLIGHT FAILED · Media route status is unavailable.`

The general Timeline status region may repeat the error, but it cannot be the only place the Human can see it.

### Phase 3 — distinguish cancellation from failure

If preflight succeeds and the Human explicitly chooses **Keep still image** / cancels the confirmation:

- do not record a provider failure;
- do not claim generation failed;
- leave the Shot ungenerated;
- show a concise cancellation message;
- no route activation or provider request occurs.

If useful, show a transient `CANCELLED` presentation state, but the durable source remains ungenerated.

Cancellation and preflight failure must not be conflated.

### Phase 4 — stage-specific diagnostics

Preserve the actual failure boundary:

```text
route status
→ capability / workflow-family resolution
→ confirmation
→ route activation
→ provider submission
→ queued/running polling
→ completed output
```

Every failure should identify the stage.

For preflight specifically, surface enough information to answer:

- selected route;
- route ready/not ready;
- workflow family if local H3;
- resolved generation modality if any;
- whether a required visual reference is present;
- whether performance acknowledgement is available when required.

Do not expose secrets or credentials.

### Phase 5 — regression coverage

Add focused tests proving:

1. route-resolution failure does not return the row to `NOT GENERATED`;
2. strategy-ineligible failure becomes a Shot-level FAILED state;
3. preflight error text is visible beside the Shot;
4. Retry motion appears after preflight failure;
5. failure persists/reloads through existing Timeline motion storage;
6. pristine never-attempted Shot still says `NOT GENERATED`;
7. explicit Human cancellation is not persisted as provider failure;
8. successful preflight proceeds to confirmation;
9. no provider activation/request occurs before confirmation;
10. SUBMITTING / QUEUED / RUNNING / READY behavior remains unchanged;
11. #2803 text-to-video / image-to-video / first-last-frame / reference-to-video rules remain intact;
12. constrained-VRAM acknowledgement behavior remains intact;
13. stale packet behavior remains intact;
14. exact underlying preflight reason survives to the UI.

### Scope boundaries

In scope:

- Timeline motion preflight failure state;
- Shot-level diagnostic visibility;
- retry behavior;
- persistence/reload of failed attempts where appropriate;
- distinction between never-attempted, cancelled and failed;
- regression coverage.

Out of scope:

- selecting a new video provider automatically;
- silently switching providers;
- weakening capability checks;
- changing #2803 Shot Generation Packet semantics;
- changing Storyboard image generation;
- redesigning the Timeline board;
- changing #2808 direct Timeline entry.

### Acceptance criteria

- [ ] Generate motion no longer transitions `PREFLIGHT → NOT GENERATED` after a failed preflight.
- [ ] Failed preflight remains visible on the exact Shot.
- [ ] Exact failure reason is displayed beside the Shot.
- [ ] Retry motion is available.
- [ ] Reload preserves the failed attempt/reason when persisted.
- [ ] Never-attempted Shots alone use `NOT GENERATED`.
- [ ] Human cancellation is distinct from failure.
- [ ] Successful preflight still requires explicit Human confirmation before activation/submission.
- [ ] No silent provider fallback is introduced.
- [ ] Existing #2776 state semantics are restored.
- [ ] Existing #2803 capability-aware generation remains authoritative.
- [ ] Focused tests and required exact-head verification are green before merge.

### Definition of done

When the Human presses Generate motion, the Shot always tells the truth about what happened. If preflight fails, the Shot remains visibly failed with the actual reason and a Retry action. `NOT GENERATED` is reserved for Shots that genuinely have not been attempted for the current generation packet.

### Delivery rule

Build → focused test → fix → PR → required exact-head verification → fix until green → merge when green.