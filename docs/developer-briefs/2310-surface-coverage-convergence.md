# #2310 — Surface Coverage Convergence

## Decision

Surface Census separates the complete PlotPickle migration inventory from the surfaces exposed by the current Matrix navigation.

A screen may remain valid and directly renderable while it is **in transit / inventory-only**. Direct URL loadability does not make it part of the current user experience.

## Lifecycle

- **Active / governed** — exposed by current Matrix navigation and governed.
- **Active / missing governance** — exposed by current Matrix navigation but not governed.
- **In transit / inventory-only** — retained during migration but not exposed by current Matrix navigation.
- **Public exception** — intentionally outside Matrix.
- **Alias / handoff** — compatibility route to another canonical destination.
- **Retired** — explicitly removed from product inventory.

When navigation reconnects an in-transit surface, it becomes governance-applicable immediately.

## Frozen Standard boundary

The historical WebMCP Standard catalogue remains 30 surfaces. #2310 does not rewrite older acceptance history.

Surface Census supplies the current-navigation governance layer. The connected additions are Discover, Story / Story Bible, Production, and Package.

## Package

Package is canonical census-only inventory at `/pitch-review?scope=pitch&return=dashboard`. It enters the Matrix runtime boundary and suppresses its local legacy navigation while the Surface Orchestrator is active.

## Matrix naming

User-facing shared chrome says **Matrix**. Internal `skin-v1` identifiers remain implementation details.

## Probe isolation

Each census inventory probe uses a fresh browser page within the authenticated context, preventing redirect state from one inventory route from interrupting the next.

## Post-merge acceptance

The Human reruns WebMCP FULL QA. Expected semantics:

- Standard governed surfaces: 30
- active missing governance: 0
- current-navigation failures: 0
- inventory reconciliation: 100%
- current-navigation reconciliation: 100%
- governance coverage: 100%
- in-transit inventory remains explicitly reported
