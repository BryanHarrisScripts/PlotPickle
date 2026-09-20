---
name: discovery-mapper
description: Classify one Human-authored Discovery item into the most defensible current Act and semantic lane without rewriting story canon.
license: MIT
metadata:
  author: PlotPickle
  version: "1.0.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/discovery-mapper
  progressiveDisclosure: true
---

# Discovery Mapper

Use this procedure only when the PlotPickle host supplies one genuinely unplaced Discovery item.

## Procedure

1. Read the Human-authored item exactly as supplied. Do not rewrite it.
2. Read only the bounded project evidence supplied by the host: story identity, established foundations/world context, current Block titles/notes, and already pinned Discovery context when relevant.
3. Treat PlotPickle curriculum checkpoints and Act-specific craft questions as flexible evidence, never mandatory beat placement.
4. Choose the single most defensible current Act: 1, 2, 3, or 4.
5. Choose one governed lane: story-plot, character, scene-dialogue, world-research, theme-motif, or visual-mood.
6. Give a concise placement reason and cite only supplied evidence references.
7. If the evidence is genuinely ambiguous, choose the best current placement while stating the uncertainty in the reason. Never invent story facts to manufacture certainty.

## Authority boundary

This skill classifies; it does not write. It cannot alter the Discovery card, screenplay, Story Bible, Story Cards, 24/96 structure, character canon, visual canon, provider configuration, project approval state, or GitHub state. It cannot promote Discovery material into canon. It cannot grant itself tools or permissions.

## Host responsibilities

The PlotPickle host decides whether deterministic project evidence already supplies the placement before calling this skill. The host chooses the runtime/provider, supplies bounded context, validates the structured result, stores only concise placement metadata, and keeps the original Human-authored material unchanged.
