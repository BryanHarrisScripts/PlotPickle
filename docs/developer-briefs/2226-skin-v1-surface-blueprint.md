# Issue #2226 — Skin V1 Surface Blueprint

Status at implementation start: developer brief approved by the Human; Phase 0 authorized on 2026-09-18.

Source issue: #2226
Parent/convergence issue: #2159

## Developer Brief

### Purpose

Turn the September 18 Human visual review of PlotPickle’s current candidate screenshots into one machine-readable, enforceable surface system.

This issue is a focused child/convergence issue under #2159. It must **extend the existing** Skin V1 Surface Registry, Surface Grammar, WebMCP/Visual Director and UI Continuity architecture. It must not create a second design system, second surface inventory, second screenshot authority or new agent.

The problem exposed by the Human review is no longer “a few screens need CSS polish.” PlotPickle already captures **30 standard WebMCP surfaces**, with additional census-only surfaces registered elsewhere, but the product still permits each service to improvise its own width, gutters, header/footer treatment, return placement, border style, frame depth, selected state, typography and content composition.

The next governing layer is:

> **navigation-ordered surface identity + existing-layout archetypes + explicit shell/format profiles + deterministically named visual evidence + automated continuity enforcement**

The Human should be able to sort the generated PNG evidence and walk PlotPickle in the same order a user walks the application.

---

## Existing authority to preserve

Use and extend:

- `config/skin-v1-surface-registry.json` — canonical surface identity/inventory;
- `config/skin-v1-surface-grammar.json` — canonical Skin V1 structural grammar;
- `tests/visual-baselines/skin-v1/manifest.json` — current visual evidence mapping, eventually derived/projected rather than independently authored;
- `lib/verification/webmcp-surface-capture-registry.mjs`;
- Visual Director / UI Continuity;
- Dashboard as the **only currently locked** visual baseline until the Human deliberately approves a replacement;
- current Skin V1 token system and current Matrix experience contract.

Do not revive the stale `matte-black-teal-orange` vocabulary as authority. The current UI Continuity compatibility file still contains that historical label and #2159 already owns its retirement.

Related authority/issues:
- #2159 — one Surface Registry + Surface Grammar + UI Continuity governance;
- #2030 — durable WebMCP visual reference registry;
- #1883 — Dashboard as active visual authority;
- #2224/#2225 — peer-corpus structural Visual Director and broken-media/dead-space checks.

---

# Human visual direction captured in this review

## 1. Overall Skin V1 direction

The preferred direction emerging from the Human review is a restrained, premium PlotPickle treatment built from existing design ingredients:

- matte-black / stepped dark surfaces rather than flat disconnected black panels;
- restrained Matrix green used as eyebrow, accent, readiness/focus and selected-state trim;
- white primarily for readable text, **not large stark selected backgrounds**;
- square geometry;
- consistent 1px and 2px structural border vocabulary;
- consistent outer frame + optional inset frame treatment where the current product already demonstrates it;
- consistent left/right gutters and body measure;
- consistent standard header;
- consistent footer/status/sub-footer treatment where the current shell already uses one;
- right-aligned Return / Back action in the standard location;
- standard typography roles from Skin V1 tokens, not local font families;
- standard selected-state grammar rather than each service inventing a new green/white treatment;
- consistent submenu/sub-header grammar, including the stronger green left-edge/eyebrow treatment already visible in some current surfaces.

“Premium” must be translated into explicit tokens/geometry in the grammar. It must not remain an aesthetic adjective that an agent can interpret freely.

## 2. Border vocabulary

The review found inconsistent:
- solid white/neutral borders;
- dotted white borders;
- one-pixel green selection borders;
- stronger layered green selections;
- bright white selected surfaces.

Required direction:

- standard structural frames use the declared Skin V1 solid border tokens;
- 1px and 2px meanings must be explicit and reusable;
- dotted/dashed borders are allowed only when they already represent a real semantic state such as draft/placeholder and that exception is declared;
- a dotted border must never appear merely because one service implemented its own local styling;
- selected-state framing should converge on the strongest existing current treatment rather than large white fills.

## 3. Selected-state grammar

The Human specifically preferred the current Local AI-style selected state: dark/green base with a lighter green frame and a stronger outer edge/trim.

Use the current implementation as evidence and codify the actual token/geometry values after inspection.

Story Map’s bright white selection is too stark and harms readability. Writer’s Craft and other surfaces use weaker/inconsistent one-pixel selections. These should converge to one declared selection profile unless a documented interaction exception exists.

## 4. Gutters / content measure

The review repeatedly found missing or drifting left/right gutters.

Dashboard is currently unusually narrow relative to several newer surfaces. Community and Cloud Story Mode expose different body widths under otherwise similar headers.

Do **not** simply widen Dashboard in code as part of schema work. First:
1. measure the existing governed surfaces;
2. classify the current width families;
3. identify the current Human-preferred examples;
4. propose the canonical shell/body measure;
5. require explicit Human approval before replacing the locked Dashboard reference.

Once approved, Dashboard can be revised deliberately and the other surfaces should follow the declared measure instead of individually guessing width.

---

# Surface review notes to preserve

These are Human observations from the candidate PNG review and must be retained as evidence/normalization targets.

### Dashboard
- Canonical reference is currently very slim/narrow compared with newer surfaces.
- Likely needs a deliberate wider content measure, but only after the full surface/layout census and explicit Human approval.

### Agents
- Functionally acceptable.
- Matte-black/polished treatment is stronger than some surrounding surfaces.
- Treat as useful existing premium-finish evidence, not as a separate design language.

### Cloud Story Mode
- Acceptable.
- Useful comparison point for width/shell continuity.

### Community
- Acceptable content.
- Body width differs noticeably from Cloud Story Mode even though header language is similar.
- Normalize through declared measure, not local CSS.

### General
- Current composition reads as roughly three-quarters content plus unexplained empty space.
- Must resolve to an intentional existing layout archetype: one-column or two-column based on current product evidence.
- Fill/remove the unexplained gap beneath the footer/sub-footer region.

### Hybrid Story Mode
- Structure mostly acceptable.
- Sub-header green is much brighter than the preferred restrained matte-black + green accent treatment.
- Normalize to standard header/sub-header profile.

### Issue Log
- Largely acceptable.
- Current left-edge green/sub-header treatment is useful evidence for the desired premium Skin V1 sub-header pattern.

### Library family — shared defect
Applies to Library Directory plus Archive, Avery, Examples, Import, Load, New and Presets unless a surface-specific note says otherwise.

Repeated findings:
- missing/inconsistent standard header;
- missing/inconsistent footer/status framing;
- missing left/right gutters;
- Return/Back to Library placed on the left instead of standard upper-right;
- local typography/framing makes the family feel detached from PlotPickle;
- body measure differs from Dashboard/current shell.

Specific:
- Library Directory content is basically sound but visually detached because shell/gutter treatment differs.
- Library Load should use the existing multi-column/grid browsing grammar rather than turning one story into one giant full-width Open Story action. If the current product already has a three-column library/card pattern, preserve that pattern even when only one item exists.
- Library New exposes a dotted white border where the rest of the product uses solid structural framing; treat as nonconforming unless an explicit semantic state proves otherwise.

### Licensing / Notices
- Functionally acceptable.
- Could adopt the premium matte finish.
- Existing content may gain useful links to existing repository documentation (for example 24 Blocks documentation, third-party material, brand/contribution documentation) **only where a current canonical GitHub/doc target already exists**. Do not invent dead links.

### Local AI / Local Story Mode
- Functionally acceptable.
- Return to Story Mode in the upper-right is the desired placement example.
- Current selected Capability treatment is preferred evidence for the standard selection profile.
- Can adopt the common premium shell finish without redesigning behavior.

### PageFlow
- Missing/inconsistent header, footer and gutters.
- Return to Outline/source should be upper-right and preserve actual origin where supported.
- Block/Mini context can be visually tightened.
- Apply common shell/premium treatment without changing its read-only PPF authority.

### Previs
- Main concern is old-style/noncanonical header.
- Must use the current standard shell/header while preserving current PPF authority and layout behavior.

### Profile
- Functionally acceptable.
- Human specifically likes the current layered framing: outer frame, inset frame, then inset column/pill frames.
- Treat this as useful existing evidence for a reusable frame profile if the census shows it fits multiple current surfaces.

### Scene Timeline / Scene Workspace
- Candidate is not self-explanatory and visually reads like an isolated block.
- Phase 0 must resolve its actual product role, parent surface and intended shell before any styling change.
- Do not style it blindly.

### Settings
- Functionally acceptable.
- Needs the common premium matte finish and consistent solid-border/frame vocabulary.

### Shutdown Node
- Current header treatment is inconsistent.
- Main Shutdown Node composition appears offset/undersized.
- Normalize shell and center/scale the existing action using a current layout archetype; do not invent a new one.

### Storyboard
- Current header is noncanonical/old-style.
- Preserve current PPF/Visual Story/Scene Workspace authority.
- Project-aware title should describe the loaded project; for Afterglow evidence this may render as “Visual Afterglow Screenplay” (or the exact approved dynamic title pattern), not a generic disconnected “Visual Screenplay.”
- Everything else is moving in the intended editorial direction.

### Story Map
- Needs common premium matte/green frame treatment.
- Missing/inconsistent standard header/footer and standard upper-right return behavior.
- Bright white selected Block state is too stark and reduces readability.
- Converge selected state to the canonical dark/green selection profile.
- Existing large-control behavior may remain where intentional; layout/selection must be declared rather than inferred.

### Story Mode directory
- Missing/inconsistent standard header and Return/Back treatment.
- Large white framing should converge to standard structural border/fill treatment.

### Visual Story
- Missing/inconsistent standard shell/footer/return path.
- Generic “Visual Screenplay” naming should become project-aware using the approved title pattern.
- Scenes/Shots/Scene Workspace composition currently feels visually awkward; first classify it against an existing layout archetype before repair.

### Write
- Missing/inconsistent standard header/footer/gutters.
- Needs common premium matte/green treatment.
- Preserve Block-native PPF authority and editor-first behavior.

### Writer’s Craft
- Generally usable.
- Oversized/bright white frame and gutter width differ from neighboring surfaces.
- Selected-state border treatment is weaker/inconsistent with the preferred layered green treatment.
- Normalize via grammar rather than redesigning curriculum.

---

# Navigation-ordered surface identity and PNG naming

## Goal

A sorted evidence directory should tell the same story as navigating PlotPickle.

Current names such as:
- `agents-candidate.png`
- `community-candidate.png`
- `library-load-candidate.png`
- `storyboard-candidate.png`

are stable IDs but do not show navigation hierarchy/order.

Add navigation identity to the canonical Surface Registry and **derive** visual-evidence filenames from it.

### Required registry concepts

Each governed surface should be able to declare or deterministically derive:

- stable `id`;
- display label;
- family;
- parent surface;
- route / navigation activation;
- navigation path (menu → submenu → nested submenu → surface);
- numeric/sort order for each path segment;
- layout archetype/profile;
- shell profile;
- header/sub-header/footer profile;
- return target/placement;
- gutter/body-measure profile;
- frame profile;
- selected-state profile;
- typography profile;
- root/ready selectors;
- capture policy/governance state;
- explicit exceptions;
- derived candidate/baseline evidence paths.

### Naming pattern

Use a deterministic sortable pattern derived from the registry, conceptually:

`<nn>-<menu>__<nn>-<submenu>__<nn>-<surface>__candidate.png`

Examples are illustrative only until Phase 0 inventories the **actual current navigation order**:

- `01-home__01-dashboard__candidate.png`
- `02-manage__01-general__candidate.png`
- `02-manage__02-story-mode__01-local__candidate.png`
- `02-manage__02-story-mode__02-cloud__candidate.png`
- `02-manage__02-story-mode__03-hybrid__candidate.png`
- `03-library__01-directory__candidate.png`
- `03-library__02-new__candidate.png`
- `04-produce__02-storyboard__candidate.png`

Do not hand-maintain filename order separately from navigation order.

The same registry identity should derive candidate path, approved baseline path and report identity.

Migration must preserve discoverability of existing evidence; do not silently orphan old PNGs.

---

# Layout archetypes: derive from what already exists

Do **not** invent new layouts for this issue.

Phase 0 must inspect the currently governed/census surfaces and group only patterns that PlotPickle already uses successfully.

Expected likely families include, subject to census proof:

- one-column;
- two-column;
- three-column;
- four-column **only if an existing governed surface already demonstrates a genuine surface-level four-column layout**;
- directory/grid;
- editor + inspector/evidence;
- timeline/workspace;
- canvas/visual workspace;
- settings/directory configuration.

Column count alone is not enough. A layout profile may also define:
- relative column ratios;
- minimum/maximum column widths;
- collapse behavior;
- body measure;
- standard gaps;
- whether a dominant workspace is required;
- whether an inspector is subordinate;
- mobile/narrow behavior if already supported.

Prefer adding `layoutArchetypes` / profiles to the existing Surface Grammar and referencing them from the existing Surface Registry. A separate JSON is acceptable only if it is explicitly owned/projected by the Surface Grammar and does not become another authority.

---

# Shell / format profiles

Separate **shell** from **content layout**.

A one-column General surface and a two-column Write surface may use different content layouts but the same PlotPickle shell.

The standard shell/profile system should describe, using current components/tokens:

- standard header;
- optional sub-header/eyebrow;
- footer/status/sub-footer where applicable;
- left/right gutters;
- canonical body measure;
- upper-right Return action;
- matte-black surface/fill profile;
- outer frame;
- optional inset frame;
- standard 1px/2px solid border roles;
- canonical typography roles;
- canonical selected state.

No surface may declare “premium” directly. It must reference explicit profiles/tokens.

---

# Automated continuity enforcement

Upgrade the **existing** UI Continuity / Visual Director stack. Do not add another agent.

Once the registry/grammar is explicit, verification should be able to report findings such as:

- declared two-column surface rendered three unequal columns;
- standard-shell surface is missing its header or footer/status strip;
- Return control rendered left instead of upper-right;
- Library child omitted standard gutters;
- structural border is dotted but no semantic dotted-border exception exists;
- selected state uses a white fill instead of the declared selection profile;
- local font family does not match the typography profile;
- rendered body measure is outside the declared layout/shell profile;
- PNG filename/path does not match the registry navigation identity;
- parent/return route does not match the declared navigation hierarchy;
- duplicate shell/header/footer appears;
- project-aware visual title does not use the current project identity where required.

Deterministic violations should become blockers once the relevant profile is approved. Ambiguous aesthetic decisions remain Human-reviewed.

---

# Phased implementation plan

## Phase 0 — Human review ledger + current-state census

No visual rewrite yet.

- Add the canonical developer brief.
- Preserve all Human observations above in repository documentation/tests/issue evidence.
- Inventory the current Surface Registry, 30 standard WebMCP captures and all additional census-only surfaces.
- Record the actual current navigation tree and order.
- Record current header/footer/sub-header variants.
- Measure current content widths/gutters.
- Inventory current one/two/three/four-column and specialist layouts.
- Include a four-column archetype only if the current product proves one already exists.
- Identify existing examples for preferred selection, frame, matte finish and typography profiles.
- Resolve Scene Timeline/Scene Workspace product identity before styling.
- Produce a proposed archetype/profile map for Human review.
- No baseline replacement in this phase.

Exit: every currently existing governed surface can be mapped to a current navigation path and a proposed existing layout/shell profile without inventing a new screen type.

## Phase 1 — Registry schema + deterministic evidence naming

- Extend the existing canonical Surface Registry with navigation path/order and format-profile references.
- Add schema/validation for hierarchy and sort order.
- Derive candidate/baseline/report evidence names from registry identity.
- Migrate existing PNG path mapping without losing historical evidence.
- Make the visual-baseline manifest a deterministic projection where practical rather than a second manually divergent inventory.
- Add tests proving filename order and navigation order cannot drift.

Exit: sorting generated PNG filenames walks the current PlotPickle navigation tree.

## Phase 2 — Existing layout archetypes + shell profiles

- Add only census-proven layout archetypes.
- Add standard shell/header/footer/return/gutter/body-measure profiles.
- Add frame/border profile(s) using current 1px/2px token vocabulary.
- Add canonical selected-state profile from existing approved/preferred current implementation.
- Add typography profile(s) using existing Skin V1 tokens.
- Add explicit semantic exceptions, including any legitimate dotted/dashed border use.

Exit: every standard captured surface declares a layout and shell/format profile.

## Phase 3 — Canonical reference decision

- Compare Dashboard, Agents, Issue Log, Profile, Cloud Story Mode, Local AI and other Human-preferred current examples as evidence.
- Propose the canonical body width/gutter and premium matte/frame treatment using **existing** product patterns.
- Revise Dashboard only after explicit Human approval.
- Do not auto-lock a new Dashboard.
- Once Human-approved, deliberately replace the locked Dashboard baseline and make it the updated reference.

Exit: one Human-approved canonical shell/measure exists.

## Phase 4 — UAT/pre-production surface family normalization

Normalize against the approved grammar without changing story/canon authority:

- Story Map;
- Storyboard;
- Previs;
- Visual Story;
- Scene Workspace/Timeline after its role is resolved;
- Write;
- PageFlow where appropriate.

Priorities include:
- canonical header/footer/gutters;
- upper-right return;
- project-aware titles;
- canonical selected state;
- removal of old-style headers;
- consistent matte/frame treatment;
- preservation of PPF, Block/Mini and existing workflow authority.

Exit: pre-production/editorial family has zero declared structural continuity blockers.

## Phase 5 — Library family normalization

One coordinated family pass:

- Library directory;
- New;
- Import;
- Load;
- Examples;
- Presets;
- Avery;
- Archive.

Normalize:
- header/footer;
- gutters/body measure;
- upper-right Back to Library;
- typography;
- solid border/frame vocabulary;
- grid/column behavior;
- consistent Library family shell.

Do not create eight separate design systems or one-off fixes.

Exit: Library family has zero declared structural continuity blockers.

## Phase 6 — Settings / utility / supporting surface normalization

Normalize current existing surfaces such as:

- Agents;
- Cloud Story Mode;
- Community where applicable;
- General;
- Hybrid Story Mode;
- Issue Log;
- Licensing/Notices;
- Local Story Mode;
- Profile;
- Settings;
- Shutdown Node;
- Story Mode;
- Writer’s Craft.

Preserve already-good behavior and use these surfaces as evidence where they already implement the preferred pattern.

Exit: standard captured utility/settings/support family has zero declared structural continuity blockers.

## Phase 7 — UI Continuity / Visual Director enforcement

- Make rendered verification consume declared layout/shell/format profiles.
- Block deterministic wrong-side return, missing required shell regions, invalid border semantics, undeclared local typography, material gutter/body-measure drift and selected-state violations.
- Validate screenshot naming/navigation identity.
- Keep Dashboard + peer-corpus analysis.
- Keep visual screenshots as evidence, not sole authority.
- Mechanical auto-repair may be proposed only within #2159’s bounded repair rules; no ambiguous autonomous redesign.

Exit: the kind of inconsistencies found manually in this review are found automatically before Human UAT.

## Phase 8 — final evidence regeneration and Human approval

- Regenerate the complete standard candidate set in navigation order.
- Present it in sortable navigation sequence.
- Human reviews the family flow rather than a random alphabetical surface list.
- Promote baselines only by explicit Human decision.
- Architecture Verification / WebMCP / Visual Director must be green at exact head before merge.

---

# Acceptance criteria

1. Existing Surface Registry and Surface Grammar remain the sole canonical authorities; no parallel design/surface system is introduced.
2. Every currently governed standard surface has a deterministic navigation hierarchy/order.
3. Candidate/baseline evidence naming is derived from that identity and sorts into product-navigation order.
4. The current 30 standard surfaces, plus existing census-only surfaces as applicable, are mapped without inventing new product surfaces.
5. Layout archetypes are derived only from layouts PlotPickle already has; four-column exists only if census evidence proves it.
6. Every standard surface declares an approved/current layout profile and shell/format profile.
7. Standard header/footer/return/gutter/body-measure rules are explicit and machine-testable.
8. Return/Back placement is upper-right for the standard profile unless a documented current exception exists.
9. Structural dotted/dashed borders require a declared semantic exception; otherwise standard solid 1px/2px Skin V1 borders are used.
10. Typography uses declared Skin V1 roles/tokens; local font drift is detectable.
11. Selected-state treatment is explicit, readable and consistent; stark white selection cannot silently reappear on surfaces declaring the canonical selected profile.
12. Dashboard width/reference changes require explicit Human approval before locked-baseline replacement.
13. Project-aware surfaces can declare dynamic title rules without hard-coding Afterglow as universal product text.
14. Library family converges through one shared family contract.
15. Story Map / Storyboard / Previs / Visual Story / Write / PageFlow preserve current PPF/story authority while converging visually.
16. Scene Timeline/Workspace identity is resolved before visual repair.
17. UI Continuity/Visual Director can deterministically catch missing shell regions, wrong return placement, width/gutter drift, invalid structural borders, typography drift, selected-state drift and navigation/evidence naming mismatch.
18. Screenshots remain secondary evidence and are never auto-approved.
19. No new story store, router, canon authority, provider authority, visual agent or design system is introduced.
20. Exact-head Architecture Verification, WebMCP and Visual Director are green before each implementation PR merges.

---

# Non-goals

- no new surfaces just to satisfy an archetype matrix;
- no invented four-column layout if PlotPickle does not already use one;
- no giant one-shot CSS rewrite;
- no automatic Dashboard baseline replacement;
- no pixel-identical requirement across functionally different surfaces;
- no replacement of current PPF/story/project authority;
- no new navigation system;
- no second screenshot registry;
- no new UI agent;
- no subjective “premium” heuristic without explicit tokens/geometry;
- no unrelated feature work.

---

# Sequencing rule

This issue is the next visual-governance implementation package after the Human candidate review.

Build one phase/family at a time. Test, fix and merge only when the relevant exact-head gates are green.

**Stop after creating this issue/developer brief. Do not begin Phase 0 implementation until the Human explicitly says to proceed.**

