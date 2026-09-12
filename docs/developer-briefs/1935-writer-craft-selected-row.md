# #1935 — Writer's Craft selected-row visual repair

## Problem

After #1934 repaired the Writer's Craft WebMCP selector, the live menu contract reached the submenu and exposed the next Layer 1 defect: the selected `Screenwriting Foundations` row inherited the generic selected-control state.

The generic Skin V1 rule intentionally uses `--pp-skin-selected-bg` / `--pp-skin-selected-ink`, which is appropriate for ordinary controls but not for the dark BBS navigation treatment enforced by `inspectMenu()`.

The Writer's Craft selected row therefore rendered with the wrong background and without the intended visible accent border.

## Root cause

Writer's Craft rows use the shared `pp-skin-v1-menu-item pp-skin-v1-dashboard-row pp-skin-v1-submenu-item` classes, but unlike Dashboard and Settings, the Writer's Craft semantic surface had no surface-scoped selected-row override.

The verifier is correct. It expects selected navigation rows to use:

- `--pp-skin-accent-deep` for the background;
- `--pp-skin-accent-bright` for the border.

## Repair

Add one surface-scoped selected-row rule for:

`section[aria-label="Writer's Craft menu"]`

The rule uses a real `--pp-skin-border-thin` solid accent border plus the dark accent background and normal Skin ink.

Do not change the global selected tokens. They remain the generic control contract.

## Boundaries

No change to:

- Writer's Craft keyboard navigation;
- shortcut `1` entry;
- collection order or labels;
- preview/unwired state;
- LEARN curriculum content;
- Agent behavior;
- WebMCP thresholds.

## Verification

Focused regression proves the surface-scoped token contract and also proves the global selected-control token remains unchanged. PR Gate and Product Gate must be green on the exact head. Final acceptance is the next local live WebMCP run from merged `main` continuing beyond Writer's Craft selected-row conformance.
