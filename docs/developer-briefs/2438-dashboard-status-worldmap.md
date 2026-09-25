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
- connected/ready → Matrix green
- in-review → warning yellow
- unavailable/disabled → muted gray

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
- Library is no longer in the warning selector and stays connected.
- MindMap, WorldMap, Outline, Storyboard, Previs, Timeline and Production are the yellow review set.
- Package and Deck are disconnected/disabled.
- WorldMap replaces Story in the Develop row.
- Pitch cannot navigate.
- Existing order and shortcuts remain unchanged.
