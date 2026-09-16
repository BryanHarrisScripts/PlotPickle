# #2124 Phase 4 — WebMCP / verification integration

Phase 4 reuses the existing Matrix/WebMCP verification path.

- Matrix `Outline` opens the existing PPF-backed Story Map projection.
- Matrix `Storyboard` opens the existing Storyboard / Visual Story / Scene Timeline workspace.
- `story-map`, `visual-story`, and `scene-timeline` are registered in the existing standard-surface catalogue and visual-baseline manifest.
- All three new surfaces remain `candidate`.
- Dashboard remains the sole `locked` Matrix baseline.
- Scene Timeline exposes a truthful empty state when no Scene exists so verification never manufactures production data merely to make the surface reachable.
- The existing `webmcp-standard-surface-catalogue.mjs` remains the verifier; no parallel harness or design agent was added.

Phase 5 remains the Human-reviewed real-application capture/re-baseline step.
