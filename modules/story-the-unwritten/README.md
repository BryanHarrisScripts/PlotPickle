# Story: The Unwritten module

This module owns STORY's playable-story grammar, session mechanics, rule validation and game-facing state. It does not own PlotPickle canon, host permissions, provider selection, social discovery or the application agent runtime.

Phase 0 is contract-first. `contracts.ts` defines the compile-time vocabulary and `contract-invariants.mjs` enforces the boundaries that imported or user-created data must satisfy before later engine phases consume it.

The module follows four storage and execution separations:

1. Character Definition is not mutable Character State.
2. A graph node is a lightweight index record, not an embedded character package.
3. A stored character is not necessarily hydrated, active or running inference.
4. A Story Agent Definition references approved host authority; it never carries authority with it.

Wyrmwood remains independent until a playable STORY vertical slice proves a genuine shared contract.
