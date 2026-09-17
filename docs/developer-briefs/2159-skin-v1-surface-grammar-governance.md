# #2159 — Skin V1 Surface Grammar and complete UI continuity governance

## Decision

Treat the current visual inconsistency as a governance defect, not as a list of unrelated CSS bugs.

The Human review of the current WebMCP composite showed structural drift that should have been mechanically prevented: return controls move sides, standard frames and borders appear inconsistently, headings occupy different hierarchy/positions, content measures vary, trim and green treatment drift, and meaningful nested Community states are not all represented in the standard visual evidence set.

The governing rule for this work is:

> One Surface Registry + one Surface Grammar + one upgraded UI Continuity Agent + CI blockers for structural drift.

Dashboard remains the canonical Skin V1 / Matrix visual reference. Screenshot comparison remains useful regression evidence, but deterministic geometry, token and structure contracts become the primary consistency mechanism.

## Existing authorities to reuse

Do not create another design system, navigation model, verifier or Agent.

Current reusable authorities are:

- `app/skin-v1-definition.css` — canonical reusable Skin V1 palette, typography, 4px spacing, square geometry, control sizing and shell sizing tokens;
- `app/skin-v1-bbs-surfaces.css` — the Human-approved #2032 header and return-action presentation rules;
- `app/skin-v1-standard-surface-shell.css` — the existing subordinate-shell width and return-action chrome;
- `tests/visual-baselines/skin-v1/manifest.json` — screenshot governance and Dashboard's locked baseline;
- `lib/verification/webmcp-surface-capture-registry.mjs` — current 26-surface standard visual capture inventory;
- `lib/verification/skin-v1-visual-director.mjs` — rendered visual comparison against Dashboard;
- `scripts/ui-continuity-agent.mjs` and `lib/verification/ui-continuity-audit.mjs` — existing UI Continuity Agent and deterministic audit;
- `config/ui-continuity-agent-registry.json` — current broad route census, retained only as a compatibility source until Phase 1 moves the agent to the canonical registry;
- `app/_components/plotpickle-system/screen-registry.json` — older Experience V2 screen-maturity registry. It is not the current Skin V1 visual registry and must not become a second current visual authority.

## Why current verification allowed the drift

### UI Continuity is checking the wrong level

The existing UI Continuity Agent is useful for navigation reachability, active area/destination, shared-shell presence, project/status context, overlap, theme and return-path existence. Its registry still names `matte-black-teal-orange`, however, and the audit does not currently measure the exact Skin V1 page grammar visible in Human review.

It therefore cannot deterministically reject:

- a return button on the wrong side;
- a missing or extra standard action frame;
- a page that is materially narrower/wider than its peers;
- a title/header placed at a different vertical or hierarchy level;
- inconsistent trim/border vocabulary;
- structural padding outside the Skin V1 spacing rhythm;
- nested surfaces that were never registered for visual governance.

### Visual Director is intentionally permissive

The current Visual Director already detects useful rendered evidence, but palette, spacing rhythm, hierarchy, width and control-density drift are mostly advisories. That permits Architecture Verification to be green while a Human can still see that adjacent screens do not belong to one product.

### Screen inventories are fragmented

There are currently separate inventories for:

1. WebMCP standard visual capture;
2. UI Continuity routes;
3. an older Experience V2 screen-maturity system.

#2159 creates the current Skin V1 visual Surface Registry and then migrates verification consumers onto it. Compatibility sources may exist during the migration, but they must be checked against the canonical registry so they cannot silently diverge.

## Canonical Surface Grammar

The first machine-readable grammar lives at:

`config/skin-v1-surface-grammar.json`

It records the accepted Skin V1 structural vocabulary already present in CSS and Human-approved work:

- Dashboard is the reference surface;
- one standard Human-facing header: `PLOTPICKLE | SURFACE | SKIN V1`;
- header minimum height: 42px;
- subordinate return/action chrome sits below the standard header and aligns to the right (`flex-end`);
- standard shell maximum measure uses `--pp-skin-shell-max` (currently 1180px) with the existing 40px desktop viewport inset;
- structural spacing follows the 4px `--pp-skin-space-*` grid;
- square geometry uses `--pp-skin-radius` (0px);
- standard borders use `--pp-skin-border-thin` / `--pp-skin-border-strong`;
- standard controls use `--pp-skin-control-height` (34px), with `--pp-skin-touch-target` (44px) where the interaction requires the larger target;
- visual colour comes from `--pp-skin-*` tokens rather than local surface palettes;
- public/startup exceptions and explicitly documented surface-class exceptions remain possible, but exceptions must be declared rather than accidental.

The grammar is structural. It does not require every page to contain the same internal content layout.

## Canonical Surface Registry

The first canonical census lives at:

`config/skin-v1-surface-registry.json`

Phase 0 records:

- every current WebMCP standard surface;
- every current UI Continuity route or a deliberate alias to its current canonical surface;
- known nested Community states that Human users can meaningfully navigate, including public rooms, Story Rooms Directory, Direct Messages, Private Story Room, Connected Studios, My Presence and Community Agents;
- parent/family/surface-class metadata;
- whether the surface is standard-capture, census-only or public-exception;
- current governance state (`reference`, `candidate`, `census`, or `exception`).

Census-only means "known and must not be forgotten". It does not invent a selector or deterministic navigation path before the product already exposes one.

## Surface classes

The initial grammar uses a small class vocabulary:

- `reference` — Dashboard canonical reference;
- `directory` — menu/directory surfaces whose primary job is destination selection;
- `workspace` — substantive working surfaces;
- `nested` — meaningful child surface/state under a parent workspace/directory;
- `public-exception` — startup/public/legal screens outside the authenticated Skin V1 application grammar.

Class-specific content may differ. Standard structural grammar does not.

## Community census boundary

Community is not one screenshot. The current implementation exposes multiple meaningful states from the Community workspace, including:

- Great Hall;
- Story Council;
- Wyrmwood Ring;
- Marquee;
- Story Rooms Directory;
- Direct Messages;
- Private Story Room;
- Connected Studios;
- My Presence inside Connected Studios;
- Community Agents.

Phase 0 registers these as known nested surfaces. Phase 4 will resolve deterministic selectors/navigation and promote the states that should receive standard capture evidence. Dynamic content such as an individual DM thread can be represented by a stable surface class/state rather than by pretending every message is a separate screen.

## Migration plan

### Phase 0 — contract and census

- add this developer brief;
- add the machine-readable Surface Grammar;
- add the canonical Surface Registry and known Community children;
- add focused tests that prove the current WebMCP and UI Continuity inventories cannot silently contain an unmapped surface;
- explicitly classify the old bronze/jade Experience V2 registry as legacy visual-maturity data, not current Skin V1 authority.

No production UI changes in Phase 0.

### Phase 1 — one registry consumed by verification

- make UI Continuity consume the canonical registry;
- make WebMCP/Visual Director consume a deterministic standard-capture projection from the same registry;
- retire `config/ui-continuity-agent-registry.json` as an authority;
- preserve current navigation/capture behavior while changing ownership.

### Phase 2 — rendered structural evidence

Add deterministic measurements for:

- standard header rectangle/role;
- return-control rectangle, side and container;
- title rectangle/hierarchy;
- root and content measure;
- border/trim treatment;
- structural padding and control-height rhythm;
- resolved Skin V1 token/palette evidence.

### Phase 3 — blocker policy

Promote deterministic structural violations to Experience Skins errors for surfaces whose governance state is enforced. Do not turn the entire repository red before a family has been normalized; promotion is family-by-family and explicit.

### Phase 4 — complete Surface Census

Discover all meaningful reachable states, resolve deterministic navigation/capture contracts and fail when a meaningful registered destination is missing from the canonical census.

### Phase 5 — family normalization

Normalize in this order:

1. Dashboard reference;
2. Library and all Library children;
3. Settings/Manage and all children;
4. Community and all Community children;
5. Story Map / Visual Story / Scene Timeline and production surfaces;
6. remaining specialist/contextual surfaces.

A family advances only after structural blockers are zero.

### Phase 6 — bounded deterministic repair

The existing UI Continuity Agent may repair only mechanical, unambiguous drift: token substitution, spacing-token substitution, canonical return/header component use, standard border variables and canonical class shell/measure. Ambiguous UX remains Human-controlled.

## CI rule

A future enforced surface must not pass Experience Skins with any of these undeclared deviations:

- wrong return-control side/placement;
- missing or duplicate standard header frame;
- materially wrong canonical content measure;
- noncanonical structural trim/border;
- structural padding off the 4px rhythm;
- local structural colour where a Skin V1 token exists;
- page-title hierarchy outside its class contract;
- meaningful reachable surface missing from the canonical census.

Screenshot pixel comparison remains secondary regression evidence because font/platform rasterization can vary even when geometry and tokens are correct.

## Authority boundaries

This work does not change:

- story/canon authority;
- project state;
- routing semantics;
- provider/model/Agent authority;
- Community/BUZZ data authority;
- Human baseline approval.

The UI Continuity Agent remains one existing Agent. No second visual-verification stack is introduced.

## Phase 0 exit criteria

- the developer brief exists;
- the Surface Grammar is machine-readable and anchored to existing Skin V1 tokens/Human-approved header rules;
- the canonical Surface Registry includes the current 26 WebMCP standard surfaces, current UI Continuity routes/aliases and known nested Community surfaces;
- focused tests prove compatibility inventories cannot silently add an unmapped surface;
- no production behavior or visual layout changes in this phase;
- exact-head Architecture Verification is green before merge.
