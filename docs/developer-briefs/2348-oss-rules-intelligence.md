# Developer Brief — #2348 OSS Rules Intelligence

## Goal

Enrich the existing GitHub-first OSS Radar architecture review with bounded, read-only evidence from the public OSS Rules catalog. This is the OSS Radar slice of #2348; the canonical development verification routing is reviewed separately.

## Product behavior

First select the existing seven-area review queue, up to three GitHub repositories per area. Only then query OSS Rules for those repositories. Read its overview before exact repository summaries; expand project and pattern details only for a relevant exact match. Retain a pinned upstream instruction link and a short comparison to PlotPickle's existing practices. The internal report shows up to three signals and a dedicated evidence artifact records bounded metadata for checked repositories. Public digest selection remains based on GitHub evidence.

## Boundaries

Do not import, execute, install or obey third-party instructions. Do not copy full instruction bodies into reports or state. A failed or slow OSS Rules request must leave the normal GitHub report usable; the optional research has a 20-second total budget. GitHub remains the source of candidate selection and Human review owns adoption.

## Acceptance evidence

- An exact-match fixture proves overview-first lookup, relevant pattern expansion and commit-pinned upstream attribution.
- A failing external service leaves the report renderable.
- A Radar publishing fixture proves selection precedes enrichment and the artifact stores metadata only.
- Existing OSS Radar regression suites and the production build pass; independent CI checks the exact PR head.
