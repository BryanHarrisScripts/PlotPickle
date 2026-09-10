# Developer Brief — UI Conformance: UI/UX + Skin V1 + WebMCP

Issue: #1854
Status: implementation

## Problem

Human UAT is still catching mechanical visual inconsistencies such as font drift, pill/control geometry differences, spacing and border oddities. Those defects should be detected before Bryan evaluates product behavior.

## Authority hierarchy

1. `docs/UI-UX-DESIGN-STANDARD.md` is the normative human-centered design authority: interaction hierarchy, accessibility, progressive disclosure, component reuse, states and design doctrine.
2. `app/design-tokens.css` owns global semantic design primitives shared across PlotPickle.
3. `app/skin-v1-definition.css` owns the active Skin V1 presentation mapping. When Skin V1 intentionally specializes a presentation value, the active Skin value wins for rendered Skin V1 surfaces.
4. Rendered components must consume the active semantic contract rather than introduce page-local font, radius, colour, spacing or control systems.
5. WebMCP is a read/navigation verification adapter. It observes the rendered application and reports conformance; it does not become a design authority.
6. Pi and Cline are bounded external developer workers. They may repair deterministic violations through the existing harness but do not choose or mutate Skin policy.

## Implementation direction

Extend the existing `lib/verification/webmcp-surface-visual-audit.mjs` rather than adding a new TUI/Skin engine.

The audit should inventory every governed element visible inside each bounded Skin V1 surface, classify it by semantic role, capture computed presentation properties, and compare those values against the active Skin contract.

Initial governed roles:

- surface
- panel
- control
- pill
- heading
- body/text
- status

Stable `data-skin-role` / `data-skin-control-kind` attributes may be used where a semantic family cannot be inferred safely from existing HTML/ARIA/class contracts. Native semantics remain preferred when sufficient.

Each violation must contain enough bounded evidence for deterministic repair:

- surface
- semantic role
- stable element identity
- property
- actual value
- expected value
- source token / rule

Do not include prompts, hidden reasoning, story content, credentials, environment secrets or arbitrary text-node dumps.

## Verification layers

### Layer 1 — Semantic visual conformance

Mandatory deterministic checks for active Skin values such as typography, shape/radius, control sizing, borders and state styling.

### Layer 2 — Screenshot baseline

Retain the repository-owned screenshot baseline as complementary evidence for missing media, alignment, clipping, overlap and gross geometry changes. Do not replace semantic checks with pixel comparison.

### Layer 3 — Existing repair/reporting

Visual-contract failures flow into the existing focused UAT finding/report path. Reuse `report-uat-findings.mjs`; do not add a second GitHub issue implementation.

## Boundaries

- no independent Skin JSON/YAML source of truth;
- no TUI Skin engine;
- no Pi-controlled Skin switching;
- no persistence of developer workspace layout into the Skin contract;
- no second GitHub reporter;
- no broad redesign while adding the enforcement layer;
- no self-granted repair/merge authority.

## Completion contract

The change is complete when the standard hierarchy is reconciled, the WebMCP audit inventories governed elements rather than sampling one control, exact conformance violations are emitted, focused regression coverage exists, existing screenshot evidence remains intact, and required CI is green on the exact head.