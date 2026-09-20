# #2289 — Library Nested Return Continuity Repair

## Purpose

Repair the Human-observed Skin V1 navigation regression where, after entering a nested Library destination, the visible Return control can fail to return through Library and then Dashboard.

Parent authority: #2226 Surface Orchestrator.

## Contract

The intended path is:

`Dashboard → Library → Library child → Library → Dashboard`

The Surface Orchestrator remains the single visible Return owner.

LibraryWorkspace remains the owner of Library child state through its existing `returnToDirectory()` function.

## Implementation

While a nested Library destination is active, mount one feature-owned local return hook inside the active child root:

- `data-skin-v1-local-return="true"`
- label `Back to Library`
- `onClick={returnToDirectory}`

Existing orchestrator CSS visually suppresses that local control. The Surface Orchestrator discovers and invokes it, so no second visible Back button is introduced.

The top-level Library → Dashboard behavior remains unchanged.

## Verification

Focused source regression plus live WebMCP journey must prove:

`Dashboard → Library → New → Library → Dashboard`

No legacy `data-library-back="directory"` authority may return.

## Non-goals

No Library redesign, no menu reorder, no browser-history navigation authority, and no Discovery/Story Bible/pre-production changes.
