# Developer Brief — Fold Review into Develop and Pitch

Issue: #2444

## Human-approved Dashboard taxonomy

Remove the REVIEW group.

### DEVELOP
1. MindMap
2. WorldMap
3. Write
4. Edit
5. Refine

### PITCH
1. Package
2. Deck
3. Feedback
4. Reports

## Preserve

Refine, Feedback and Reports retain their existing:
- item IDs
- shortcuts
- descriptions
- activation behavior
- destination surfaces
- status/lifecycle semantics

Package and Deck retain their current gray/unavailable behavior.

Everything outside these group assignments remains unchanged.

## Implementation

Use `DASHBOARD_MENU` in `app/skin-v1/dashboard-menu-registry.ts` as the sole taxonomy authority.

Move Refine after Edit and assign it to DEVELOP.

Keep Package and Deck first in PITCH, then move Feedback and Reports after them and assign both to PITCH.

No item may remain assigned to REVIEW.

Do not add special renderer logic; the Dashboard's existing group rendering must naturally stop rendering REVIEW when no item owns that group.

## Verification

Focused tests must assert:
- exact DEVELOP order
- exact PITCH order
- no REVIEW group assignment
- unchanged IDs/shortcuts/descriptions
- unchanged disabled set for Package/Deck
- unchanged review/locked status sets

Then run exact-head Architecture Verification, inspect only failures, fix until green, merge and stop.
