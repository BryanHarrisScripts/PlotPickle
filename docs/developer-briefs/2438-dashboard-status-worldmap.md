# Developer Brief — Dashboard Status Semantics and WorldMap

Issue: #2438

## Scope

This is a Dashboard presentation/interaction correction only.

### EXPLORE
Ready/green:
- Learn
- Community
- Library

### DEVELOP
In review/yellow:
- MindMap
- WorldMap

Rename the current Story entry to `WorldMap` and remove the old "Story, Logline, Theme and Visual Reference" copy from that row.

Write and Edit remain unchanged.

### VISUALIZE
In review/yellow:
- Outline
- Storyboard
- Previs
- Timeline
- Production

### PITCH
Unavailable/gray and non-activating:
- Package
- Deck

Everything else remains unchanged.

## Status authority

Use three explicit Dashboard states:
- locked → Matrix green. A green square is a product lifecycle promise that the corresponding screen/surface is locked.
- in-review → warning yellow. The surface remains enterable but is not locked.
- unavailable/disabled → muted gray. The destination cannot be entered.

The yellow list must be owned in the Dashboard menu registry rather than duplicated as one-off CSS ids.

## Interaction

Unavailable Pitch rows must:
- render gray
- expose disabled semantics
- ignore mouse activation
- ignore shortcut/Enter/Space activation
- not route to pitch-review

## Verification

Focused tests must prove:
- Library is no longer in the warning selector and is explicitly locked/green.
- Every green Dashboard square exposes locked surface semantics.
- MindMap, WorldMap, Outline, Storyboard, Previs, Timeline and Production are the yellow review set.
- Package and Deck are disconnected/disabled.
- WorldMap replaces Story in the Develop row.
- Pitch cannot navigate.
- Existing order and shortcuts remain unchanged.
