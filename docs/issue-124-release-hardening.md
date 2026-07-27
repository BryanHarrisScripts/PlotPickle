# Issue #124 — release hardening and duplication audit

## Product boundary

Build is the only writer-facing structural arrangement workspace. It owns the canonical four acts, twelve sequences, twenty-four Blocks, flexible scenes and ninety-six mini-blocks.

Refine no longer exposes the competing full Structure Engine. Its structure notice opens Build’s contextual diagnostics, while the remaining engines and labs continue to analyse the same project without copying it.

## Reference-safe movement

Block movement continues to use stable-ID ordering and remaps positional references atomically.

Mini-block movement now uses the same pattern:

- pointer drag-and-drop and visible drag handles;
- earlier, later and exact-position keyboard controls;
- movement within a scene and across scenes or Blocks;
- stable mini-block IDs and canonical scene containers;
- synchronized screenplay elements, storyboard frames, stored Feedback targets and production shots;
- story-thread and character-arc scene references remain valid because their stable scene IDs are not replaced;
- twenty-entry undo and redo histories;
- a local pre-move recovery snapshot before arrangement changes.

No Build-only or mini-block-only story database was added.

## Accessibility and performance

- Every pointer move has a non-drag alternative.
- Movement status is announced through a polite live region.
- Cards expose descriptive accessible names and visible focus.
- Storyboard images use lazy loading and asynchronous decoding.
- Off-screen Block groups use `content-visibility` with an intrinsic size for the complete 96-card wall.
- Reduced-motion preferences disable movement transitions.
- Drag cancellation leaves canonical order unchanged.

## Reliability and privacy

The existing application-level autosave remains debounced. Build adds one local recovery snapshot immediately before a move so the writer can recover even if the subsequent autosave is interrupted.

The snapshot contains only the canonical project. Connection credentials and tokens are not project fields and are never added to `.ppf`, recovery data, reports or GitHub proposals.

## Duplication audit

- Build and the former Refine Structure Engine were duplicate editing entry points; Refine now links to Build diagnostics.
- The 24-Block and 96-mini-block views continue to share the same `PlotPickleProject`.
- Mini-block diagnostics are deduplicated by warning kind, target and message before rendering.
- No second screenplay, storyboard, Feedback, production, scene or mini-block model was introduced.

## Validation

Issue #124 adds regression coverage for:

- the Build/Refine boundary;
- pointer and keyboard movement;
- stable-ID reference synchronization;
- bounded undo/redo;
- recovery snapshots;
- lazy visuals, reduced motion and responsive wall containment;
- diagnostic deduplication;
- registration in the complete project test command.
