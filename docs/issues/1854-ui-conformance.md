# Issue #1854 — UI conformance enforcement

## Decision

PlotPickle will automate mechanical visual consistency by connecting the existing UI/UX standard, global design tokens, active Skin V1 presentation contract, WebMCP rendered-style inspection, screenshot baselines and bounded Pi/Cline repair workflow.

Human UAT should focus on product behavior and creative outcomes rather than manually discovering font, pill, border, spacing or control-style drift.

## Ownership

- UI/UX standard: normative design and interaction intent.
- `app/design-tokens.css`: global semantic primitives.
- `app/skin-v1-definition.css`: active Skin V1 presentation specialization.
- WebMCP visual audit: read-only rendered conformance observer.
- Screenshot baselines: complementary geometry/media regression evidence.
- Pi/Cline: bounded external repair workers only.
- Existing UAT reporter: sole GitHub issue reporting path for automated UAT findings.

## Non-goals

This does not create a new Skin engine, a TUI product surface, a second token authority, a second GitHub issue tool, or agent-controlled design state.
