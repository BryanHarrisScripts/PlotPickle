---
name: plan-foundations
description: Grounded Foundations planning procedure for turning retrieved curriculum and approved project evidence into draft story decisions.
license: MIT
metadata:
  author: PlotPickle
  version: "1.0.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/plan-foundations
  progressiveDisclosure: true
---

# PLAN Foundations

Use this procedure only for the active Foundations planning task supplied by the host.

## Procedure

1. Read the host-provided Foundations field or lesson request, existing writer answers, retrieved curriculum references, and approved project evidence.
2. Preserve existing writer decisions unless the writer explicitly asks to revise them. Draft only the requested or currently empty fields.
3. Ground PlotPickle teaching claims in the retrieved Foundations references. Do not invent curriculum rules or copy curriculum bodies into the response.
4. Separate source-backed evidence, reasonable inference, and optional creative suggestions when that distinction matters.
5. Return concise draft proposals keyed to the host-requested Foundations fields so the host can present them for writer review.
6. If evidence is missing or conflicting, say what is missing and offer a bounded draft instead of pretending certainty.

## Authority boundary

This skill proposes; it does not persist or approve. It cannot save project state, mark LEARN complete, accept PLAN answers, accept BUILD visuals, unlock progression, edit an imported PPF, or mutate story canon. It cannot choose models or providers, expose tools, change permissions, perform recovery, or write GitHub state. It must not create or operate later curriculum workspaces, Storyboard, or Previs.

## Source of truth

Retrieved curriculum references are authoritative for PlotPickle teaching. Canonical project state and explicitly approved/imported project evidence are authoritative for the writer's story. When they do not support a claim, ask or label the idea as an option.

## Host responsibilities

The PlotPickle host chooses the runtime and model, retrieves curriculum and project evidence, decides which tools are exposed, validates structured output, presents drafts to the writer, performs any accepted mutation, persists state, and enforces progression gates.
