# #2124 Phase 5 — Controlled re-baseline

Phase 5 uses the existing Experience Skins / WebMCP capture path and does not create a new visual harness.

## Locked-surface audit

The Skin V1 manifest currently has one locked Matrix surface: `dashboard`.

Dashboard remains the canonical Matrix visual precedent and is not intentionally superseded by the #2124 Experience Surface Contract. It therefore remains `locked`; no locked surface is moved back to `candidate` in this phase.

`story-map`, `visual-story`, and `scene-timeline` remain `candidate` real-application captures. Successful verification does not auto-lock them.

## Live-capture review

The Phase 4 exact-head WebMCP run captured all three pre-production surfaces through the existing standard-surface catalogue.

Review found one implementation mismatch before any baseline decision:

- Story Map still exposed a legacy independent teal / blue / orange / red / purple presentation palette and glow-oriented treatment.

Visual Story and Scene Timeline already follow the Matrix contract closely enough to remain Human-review candidates without a Phase 5 presentation rewrite.

## Corrective scope

Phase 5 changes only Story Map presentation:

- preserve the existing 4 Acts → 12 Sequences → 24 Blocks → 96 Mini-Blocks structure and all Story/PPF semantics;
- preserve evidence-state labels as non-colour meaning;
- remap the effective Story Map presentation to existing `--pp-skin-*` colour, focus, line and surface roles;
- remove glow-dependent emphasis from the Phase 5 presentation layer;
- keep Dashboard locked and all three pre-production surfaces candidate.

No Story/PPF data authority, WebMCP registry, provider route, Agent authority or production-object semantics change.

## Approval boundary

The next WebMCP capture is review evidence only. None of the three pre-production surfaces may become `locked` without explicit Human approval of the real PlotPickle output.
