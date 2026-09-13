# Issue #2026 — Dashboard main menu and navigation reset

## Human authority
The September 13, 2026 Human mockup is the visual/layout authority for the main Skin V1 Dashboard navigation. It is intentionally demonstrative for status-square colour/position only; wiring truth comes from the live product contract.

## Canonical menu
Top: Community, Writer's Craft, Story Library.

STRUCTURING: Outline, Storyboard, Previs.

DRAFTING: Write, Edit, Feedback, Polish, Analytics.

INTERACTIVE LEARNING: Wyrmwood Game, The Unwritten.

MANAGEMENT: User Profile, Settings, Issue Log, Licensing.

Bottom: Log Off.

Human-facing Dashboard menu copy uses `and`, never `&`.

## Visual decision
The main Dashboard becomes a compact navigation surface centered on the PlotPickle brand, grouped one-column navigation and the existing reminder footer. Legacy Dashboard shell title, hero art, visible Score block and `*** PLOTPICKLE BBS ***` heading remain available as compatibility/runtime source but are visually retired from the canonical main-menu surface by the #2026 override layer.

This issue does not delete the art asset, Score component, runtime IDs, routes or historical architecture evidence.

## Status truth
Keep existing runtime IDs and connection logic. Every visible row retains exactly one right-aligned status square in a stable far-right column. Connected/accepted stays green, active Human review stays yellow, unavailable/unwired stays gray. The mockup does not override live status.

## Interaction guardrails
Preserve one-letter shortcuts, Arrow Up/Down, Home/End, click, Enter/Space activation where already supported, direct User Profile, connected Settings, Writer's Craft journey, Community, Issue Log, Licensing and Log Off behavior.

## Implementation
1. Reorder/rename the `DASHBOARD_MENU` while retaining stable IDs.
2. Add a narrow CSS override after the canonical Skin V1 Dashboard reference rather than forking the skin.
3. Hide obsolete main-menu chrome visually without deleting reusable components.
4. Protect new order/copy/layout/status-column and keyboard behavior with focused tests.
5. Run exact-head Architecture Verification, inspect only failed jobs, fix until green, merge and stop.
