# #2776 — Timeline H3 motion UAT repair

## Problem

Live UAT exposed a gap between provider verification and Timeline generation.

MiniMax H3 can complete its Settings verification through the media-routing `minimax-direct` path while the higher-level AI-routing video choice remains Off. Timeline Phase 3 previously checked only the AI-routing selected choice, so Generate motion could stop during preflight even though the verified H3 authority existed.

Timeline transport also labelled whole Mini-Block placement navigation as Previous clip / Next clip. With one 75-second Mini-Block placed, those controls were disabled while the Human was reviewing 25 individual 3-second Shots.

Generation failures were primarily surfaced in the page-level status line, which made a failed preflight look like a dead Generate motion button.

## Authority chain

The repaired flow keeps one routing authority chain:

```text
Timeline Shot
  → provider readiness preflight
      → /api/ai-routing/status
      → /api/media-routing/status
  → Human confirmation
  → activate current AI video route only when required
      → /api/ai-routing/select
  → submit
      → /api/local-ai/generate/video
  → poll
      → /api/local-ai/video/:id
  → persisted TimelineMotionShot
```

Opening Timeline never activates a paid provider.

A verified MiniMax H3 direct profile can be offered when AI-routing is Off, but the route is activated only after the Human explicitly confirms the Shot generation request and the associated cloud cost/data-sharing boundary.

No unverified cloud provider is selected as a fallback.

## Human-facing states

Each Shot card can show:

- PREFLIGHT
- SUBMITTING
- QUEUED
- RUNNING
- READY
- FAILED
- STALE

The motion section also reports the provider/readiness state, including when a verified MiniMax H3 Direct route is available but will not be activated until confirmation.

Meaningful queued/running transitions are persisted into the Timeline motion record. Successful outputs retain provider, route, model, job ID, source provenance and local output asset.

Generated motion remains separate from the locked Storyboard still. Motion playback never silently substitutes the still when a generated Shot is missing or failed.

## Playback transport

Timeline transport is Shot-oriented:

- Previous Shot
- Play / Pause
- Next Shot

Previous/Next seek to exact Shot boundaries, pause playback, traverse the 25 Shots in the active Mini-Block, and cross into adjacent placed Mini-Blocks when they exist.

Timeline placement/reordering remains Mini-Block-level; only playback stepping changes.

## Timing contract

- 25 Shots per Mini-Block.
- 3 seconds per Shot.
- 75 seconds per Mini-Block.
- Generated providers may return a longer supported source clip, but Timeline consumes only the first 3 seconds for the Shot slot.
- Still-image baseline and existing silent MP4 export remain unchanged.

## Acceptance evidence

Focused regression coverage must prove:

1. both AI-routing and media-routing status participate in motion preflight;
2. verified MiniMax H3 is discoverable while global video choice is Off;
3. provider activation happens only after Human confirmation;
4. generation still goes through the canonical local video generation gateway;
5. Shot cards expose explicit working/terminal states;
6. queued/running transitions are persisted;
7. Previous Shot / Next Shot traverse Shot boundaries and placed Mini-Block boundaries;
8. motion mode never silently substitutes a still;
9. existing #2763 Phase 2/3/4 behavior remains green;
10. exact-head Architecture Verification is green before merge.
