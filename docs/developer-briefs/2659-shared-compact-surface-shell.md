# #2659 corrective brief — shared compact surface shell

## Problem

PR #2660 merged the spacing and numeric-shortcut portions of #2659 but left Mind Map, World Map, and Outline with separate Act rail implementations. The resulting UI did not materially converge on the shared menu language requested by the Human.

## Corrective scope

- Extract the established Outline four-Act rail into one reusable Skin V1 component.
- Make Mind Map, World Map, and Outline consume that same component.
- Keep keys 1/2/3/4 safe around input, textarea, select, and contenteditable controls.
- Preserve Mind Map and World Map surface-specific runtime selectors used by regression/UAT.
- Remove duplicate Mind Map and World Map Act-rail CSS so shared styling is authoritative.
- Keep existing Mind Map authoring, World Map review, Outline story structure, Library behavior, and project continuity unchanged.
- Strengthen #2659 regression coverage so separate local Act rails cannot satisfy the issue again.

## Acceptance

1. One StoryActRail component owns the four-Act geometry, active state, shortcut labels, and editable-control safety.
2. Mind Map, World Map, and Outline import and render that shared component.
3. Mind Map and World Map keep surface-specific Act selector data attributes for automated evidence.
4. Mind Map and World Map no longer define local Act-rail styling.
5. The shared rail appears before each surface-specific topic/story navigation.
6. Library remains Act-free.
7. Focused regressions, production build, convergence, PR Gate, Product Gate, Architecture Verification, and CodeQL must pass on the exact PR head before merge.
