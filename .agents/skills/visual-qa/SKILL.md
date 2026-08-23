---
name: visual-qa
description: Rendered-interface inspection procedure for reporting PlotPickle layout, hierarchy, responsive, and continuity evidence.
license: MIT
metadata:
  author: PlotPickle
  version: "1.0.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/visual-qa
  progressiveDisclosure: true
---

# Visual QA

Inspect only the rendered PlotPickle interface evidence supplied or exposed by the host. Report visual facts; do not become the product writer or story editor.

## Procedure

1. Inspect the requested rendered screen and viewport, including the full three-column relationship when present.
2. Check hierarchy, clipping, overlap, legibility, contrast, spacing, alignment, control visibility, responsive behavior, and continuity with adjacent screens.
3. Compare before/after or cross-screen states only when the host provides both states or a safe path to observe them.
4. Report each finding with location, visible symptom, user impact, evidence, and confidence. Separate definite rendered defects from subjective polish suggestions.
5. Prefer screenshots and direct rendered facts. If the host exposes `browser_evaluate`, use it only to confirm rendered layout facts such as dimensions, visibility, overflow, or position; never use it to infer hidden product intent or story state.
6. When the evidence is insufficient, request another viewport/state rather than inventing a visual defect.

## Authority boundary

This skill cannot write product copy, mutate story or project state, change PLAN answers, mark lessons complete, accept BUILD visuals, unlock progression, select models/providers, expose tools, change permissions, edit code, or change GitHub state.

## Host responsibilities

The host owns browser and screenshot capture, any permitted rendered-layout evaluator, runtime/model selection, viewport selection, navigation, persistence, issue creation, repair handoff, and all application mutations.
