# Issue #2226 Phase 2 — Existing layout archetypes and shell profiles

Phase 2 extends the existing canonical Skin V1 Surface Grammar and Surface Registry. It does not add a second design system, change runtime navigation, alter story/PPF authority, revise Dashboard, or promote any visual baseline.

## Layout archetypes

The grammar now names only layouts already evidenced by the Phase 0 census: one-column, two-column, three-column, directory/grid, editor plus inspector/evidence, timeline/workspace, canvas/visual workspace, and settings/directory configuration.

No shell-level four-column archetype exists. Existing subordinate four-column card or metric groups remain implementation details rather than a new surface archetype.

## Shell and format profiles

The canonical grammar now declares reusable header, footer, return, body-measure, frame, selected-state and typography profiles. Every one of the 30 standard WebMCP surfaces references those profiles through its canonical Surface Registry entry.

The current standard body measure remains the existing 1180px shell maximum with a 40px desktop viewport inset. Dashboard is explicitly different for governance purposes: its locked rendered measure is preserved until Phase 3 compares the Human-preferred corpus and receives explicit Human approval for any reference change.

All non-Dashboard standard profiles require the existing upper-right return pattern below the standard header. Diagnostic surfaces can use the same placement with an origin-aware destination.

## Frames and border semantics

Structural frames use solid Skin V1 borders only: the current 2px strong role and 1px thin/inset role. Profile supplies the existing evidence for a layered inset frame.

The only non-solid exception declared by this phase is the existing disabled-control dashed state in app/skin-v1.css. It is semantic, not structural. No dotted structural exception is declared.

## Selected state

The preferred selected-state profile is the existing dark Matrix treatment already evidenced by Local Story Mode, Settings and Dashboard: accent-deep background, thin accent-bright frame and Skin V1 ink. The profile explicitly rejects stark-white selected fills for surfaces that declare it.

## Typography

Typography remains owned by the current Skin V1 UI and brand tokens. Local surface font families are not authority. Project workspaces may use project-aware titles but may not hard-code one project name as universal product text.

## Phase 2 exit

Phase 2 is complete when all 30 governed standard surfaces resolve a canonical layout, shell, frame, selected-state and typography profile; every shell resolves explicit header/footer/return/body-measure behavior; no four-column shell archetype is introduced; Dashboard measure changes remain deferred to explicit Phase 3 Human approval; and exact-head verification is green.
