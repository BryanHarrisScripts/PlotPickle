# Issue #1809 — Skin V1 Community shared presentation contract

## Problem
Dashboard is the canonical Skin V1 reference, but Community still carries a legacy local palette and a root grayscale filter. That means the active Skin V1 palette cannot flow through consistently: Matrix green accents are neutralized and Community can drift from Dashboard.

## Direction
Dashboard remains the canonical screenshot reference, while `app/skin-v1-definition.css` remains the reusable source of truth for colour, shape, typography, spacing, shading and state tokens. Other surfaces must consume that contract rather than import Dashboard-specific layout CSS.

## Scope
This pass fixes Community as the first non-Dashboard surface and adds a regression guardrail so the same drift is caught in future.

## Acceptance
- Community root no longer applies `grayscale(1) saturate(0)` to the whole surface.
- Community semantic colours map to `--pp-skin-*` Matrix-green / monochrome tokens.
- Community module CSS no longer owns its teal/gold/green legacy palette.
- Community controls use Skin V1 square geometry and shared state colours.
- Room artwork remains independently filterable through the shared media token.
- Existing Community behaviour, rooms, messages, agents and routing are unchanged.
- Dashboard remains the sole canonical screenshot reference.
- Regression test covers Community module CSS, not only the global compatibility skin.
- PR Gate and Product Gate must be green before merge.
