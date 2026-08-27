# Storyboard re-adoption boundary for #1424

Phase 8 reuses the existing Storyboard implementation without restoring its legacy project object as creative authority.

The first bounded slice establishes a canonical entry gate:

`profile-owned PPF -> #1423 visual readiness -> Storyboard target availability`

The existing `app/visual-storyboard.tsx`, `VisualFrame`, `VisualMediaVersion`, approved character references, frame/version concepts and editorial candidate behavior remain preserved for adaptation behind this gate.

This slice deliberately does not:
- write visual canon;
- read or write `plotpickle.project.v1`;
- generate image/video candidates;
- migrate legacy frame data into PPF;
- mark observed Afterglow artwork as accepted;
- fabricate scene/frame readiness from Foundations-only evidence.

Next adaptation slices should reuse the existing Storyboard frame/editorial components against stable PPF target IDs, carry shared asset/provenance identity forward, and keep target-specific readiness/staleness authoritative from the canonical story rather than from view-local state.
