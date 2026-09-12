# #1932 — Writer's Craft WebMCP selector repair

## Problem

The live WebMCP startup audit reached the Writer's Craft submenu and then timed out waiting for a selector that treated `data-skin-menu="writer-craft"` as a descendant of the labelled Writer's Craft section.

The production markup is already correct: the same section owns both `aria-label="Writer's Craft menu"` and `data-skin-menu="writer-craft"`. The verifier had drifted from that contract.

## Repair

Change only the verifier locator from the descendant form:

`section[aria-label="Writer's Craft menu"] [data-skin-menu='writer-craft']`

to the same-element form:

`section[aria-label="Writer's Craft menu"][data-skin-menu='writer-craft']`

No LEARN content, Writer's Craft menu structure, keyboard shortcut, styling, or lesson availability changes are part of this repair.

## Why this is Layer 2

This is an Experience Contract failure, not a visual failure. The rendered submenu exists and the Skin V1 conformance pass is already green; automation was targeting the wrong semantic relationship.

## Guardrail

Focused regression coverage must prove:

- the production section still owns both identities;
- the verifier uses the compound same-element selector;
- the stale descendant selector is absent;
- shortcut `1` and `inspectMenu(page, "writer-craft", failures)` remain intact.

Do not weaken Playwright timeouts or add positional selection to conceal contract drift.

## Verification

PR Gate and Product Gate must be green on the exact PR head. The final acceptance proof is a local WebMCP startup rerun from merged `main`.
