---
name: visual-qa
description: Rendered-interface inspection procedure for reporting PlotPickle layout, hierarchy, responsive, and continuity evidence.
license: MIT
metadata:
  author: PlotPickle
  version: "1.1.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/visual-qa
  progressiveDisclosure: true
---

# Visual QA

Inspect only the rendered PlotPickle interface evidence supplied or exposed by the host. Report visual facts and actionable art direction; do not become the product writer or story editor.

For Skin V1 interface work, Dashboard is the canonical visual authority. A target surface's own historical screenshot is regression evidence only; it is never sufficient evidence that the target belongs to the same visual system as Dashboard.

## Procedure

1. Inspect the requested rendered screen and viewport, including the full three-column relationship when present.
2. For Skin V1 surface work, require both the canonical Dashboard evidence and the target-surface evidence. Compare Dashboard against the target directly rather than approving each screen in isolation.
3. Check typography and hierarchy, clipping, overlap, legibility, contrast, spacing rhythm, alignment, shell/panel measure, border treatment, control density, palette vocabulary, control visibility, responsive behavior, and continuity with adjacent screens.
4. When the host provides `.artifacts/visual-readiness/visual-director-report.json`, read its findings before declaring visual work complete. Treat `blocker` findings as required repairs. Treat `advisory` findings as explicit developer guidance that must be acknowledged or intentionally justified.
5. Convert differences into concrete corrections. Prefer statements such as “reduce competing headings,” “reuse Dashboard panel width,” “return padding to the four-pixel Skin V1 rhythm,” or “replace this local colour with the canonical Skin token” over a bare pass/fail verdict.
6. Compare before/after or cross-screen states only when the host provides both states or a safe path to observe them.
7. Report each finding with location, visible symptom, user impact, evidence, expected Dashboard/Skin V1 treatment, and confidence. Separate definite rendered defects from subjective polish suggestions.
8. Prefer screenshots and direct rendered facts. If the host exposes `browser_evaluate`, use it only to confirm rendered layout facts such as dimensions, visibility, overflow, position, or computed presentation; never use it to infer hidden product intent or story state.
9. Never approve a Skin V1 target solely because it matches its own previous baseline. Regression stability and cross-surface visual continuity are separate questions, and both must pass.
10. When the evidence is insufficient, request another viewport/state rather than inventing a visual defect.

## Completion rule

Visual work is complete only when the target is functionally sound, serious Visual Director findings are cleared, and the rendered target can be explained as belonging to the same Skin V1 system as Dashboard. The report should tell the developer what to change, not merely whether a screenshot changed.

## Authority boundary

This skill cannot write product copy, mutate story or project state, change PLAN answers, mark lessons complete, accept BUILD visuals, unlock progression, select models/providers, expose tools, change permissions, edit code, or change GitHub state.

## Host responsibilities

The host owns browser and screenshot capture, Dashboard and target evidence selection, any permitted rendered-layout evaluator, runtime/model selection, viewport selection, navigation, persistence, issue creation, repair handoff, and all application mutations.
