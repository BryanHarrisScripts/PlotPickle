# #1929 — Manual-only expensive Provider Runtime probes

## Problem

The normal Windows Product Gate runs two expensive runtime probes on every pull request even when a change does not touch their provider/native boundaries:

- `Evaluate Pi 0.85.1 compatibility`
- `Validate local whisper.cpp dictation fixture`

Recent measured runs showed these two checks consuming roughly six minutes combined out of an approximately eight-minute Product Gate.

## Decision

During the current two-gate CI transition, keep both probes intact but make them manual-only:

```yaml
if: github.event_name == 'workflow_dispatch'
```

Ordinary `pull_request` Product Gate runs therefore skip both expensive probes. An explicit Product Gate `workflow_dispatch` still executes them unchanged.

The fast bundled local-video contract remains in every Product Gate run.

## Why this is safe

This changes scheduling, not test authority. The Pi evaluator and whisper.cpp installer/smoke scripts remain unchanged. Historical Pi and voice contracts remain discoverable in Product Gate, and full/provider-runtime verification remains available explicitly.

This is a transitional implementation of the #1922 architecture: once the seven-layer verification mesh is active, these probes belong to **Layer 6 Provider Runtime**, where they can be selected by risk/path impact or explicit full verification rather than every PR.

## Non-goals

- Do not delete Pi evaluation.
- Do not delete whisper.cpp smoke verification.
- Do not lower any assertion or integrity check.
- Do not remove bundled local-video validation from normal PR CI.
- Do not redesign the full CI topology in this issue.
