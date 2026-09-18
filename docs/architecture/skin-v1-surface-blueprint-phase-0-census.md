# Issue #2226 Phase 0 — Human review ledger and current-state census

This document is evidence, not a second surface authority. Canonical identity remains in config/skin-v1-surface-registry.json; structural rules remain in config/skin-v1-surface-grammar.json.

## Census snapshot

At Phase 0 start the canonical registry contains 76 surfaces: 30 standard WebMCP capture surfaces, 41 census-only surfaces, and 5 public exceptions.

The visual baseline manifest contains exactly the 30 standard surfaces. Dashboard is the only locked baseline. No baseline is replaced in Phase 0.

Canonical family counts at this point are: dashboard 1, community 15, writers-craft 10, library 8, story 6, storyboard 3, profile 1, settings 10, management 4, production 3, review 10, public 5.

## Current root navigation order

The current Skin V1 Dashboard menu order is preserved as evidence:

1. Community
2. Writer's Craft
3. Library
4. Outline
5. Storyboard
6. Previs
7. Write
8. Edit
9. Feedback
10. Refine
11. Analytics
12. Wyrmwood Game
13. The Unwritten
14. Identity
15. Manage
16. Bug Report
17. Notices
18. Log Off
19. Shut Down Node

Not every row is currently wired through the Dashboard host. Phase 1 must encode identity/order without pretending an unwired row is reachable.

Manage currently orders its children as General, Story Mode, Node Info, Agents.

Story Mode currently orders Local Story Mode, Cloud Story Mode, Hybrid Story Mode.

Library currently orders New, Import, Load, Examples, Presets, Avery, Archive.

The standard pre-production evidence also includes direct route captures for Write, Storyboard, Previs and PageFlow. Their deterministic evidence identity must preserve their canonical parent/return relationship even when capture enters by direct route.

## Scene Workspace identity resolution

Scene Workspace is not a new root product destination. Current evidence resolves it as a nested Storyboard / Visual Story timeline workspace:

- canonical id: scene-timeline;
- canonical parent: storyboard;
- current capture enters Storyboard and then activates the Visual Story timeline view;
- implementation lives under the storyboard visual workspace.

Therefore Phase 4 must style it as a nested timeline/workspace profile inside the Storyboard/Visual Story authority, not as an independent shell or design system.

## Current shell and measure evidence

Current Skin V1 tokens and shell CSS provide:

- shell maximum: --pp-skin-shell-max: 1180px;
- standard desktop viewport inset: calc(100vw - 40px), equivalent to 20px left/right at full-width operation;
- spacing base unit: 4px;
- square geometry: 0px radius;
- standard header minimum height: 42px;
- standard return action alignment: right, below the standard header;
- structural border vocabulary already exposes thin/strong roles.

The Human review nevertheless found rendered width/gutter drift between Dashboard, Community, Cloud Story Mode, Library and other surfaces. Phase 0 therefore records the source token values but does not claim that all rendered surfaces currently obey them. Phase 3 must compare rendered evidence before any Dashboard baseline replacement.

## Header/footer/sub-header variants found

Existing current patterns include:

- standard Human-facing Skin V1 header / BBS banner;
- settings and story-mode nested banners with upper-right return;
- workspace-local eyebrow/sub-header treatments, including the stronger restrained green left-edge pattern seen in Issue Log;
- older/noncanonical headers still present in Storyboard and Previs;
- surfaces with missing/incomplete shell regions, especially Library children, PageFlow, Story Map, Visual Story and Write.

Footer/status treatment is not yet uniform. Phase 2 must define explicit profiles before Phase 4–6 normalization.

## Existing layout archetypes evidenced by the current product

Phase 0 does not invent layouts. The current product already demonstrates these primary patterns:

- one-column content / action surface;
- two-column surface or dominant-content + secondary column;
- three-column workspace;
- directory/grid browsing;
- editor + inspector/evidence;
- timeline/workspace;
- canvas/visual workspace;
- settings/directory configuration.

Four-column grids do exist inside current pages for subordinate metric/readiness/card groups, including PageFlow metrics and Story Mode readiness. Phase 0 did not find evidence that a governed standard surface uses four equal columns as its primary shell-level layout. Therefore no four-column surface archetype is proposed at this stage.

## Proposed existing-pattern map for the 30 standard captures

This map is deliberately provisional evidence for Phase 2; it is not a second registry.

| Surface | Navigation identity | Existing-pattern archetype | Shell evidence / Phase 2 target |
| --- | --- | --- | --- |
| dashboard | Home / Dashboard | directory | locked reference; measure decision deferred |
| community | Dashboard / Community | one-column workspace | standard shell candidate |
| writers-craft | Dashboard / Writer's Craft | directory | standard shell candidate |
| library | Dashboard / Library | directory/grid | shared Library shell |
| library-new | Dashboard / Library / New | one-column action | shared Library shell |
| library-import | Dashboard / Library / Import | one-column action | shared Library shell |
| library-load | Dashboard / Library / Load | directory/grid | preserve multi-card grid |
| library-examples | Dashboard / Library / Examples | directory/grid | shared Library shell |
| library-presets | Dashboard / Library / Presets | directory/grid | shared Library shell |
| library-avery | Dashboard / Library / Avery | one-column/history | shared Library shell |
| library-archive | Dashboard / Library / Archive | directory/grid | shared Library shell |
| story-map | Dashboard / Outline | canvas/visual workspace | production shell + canonical selection |
| scene-timeline | Dashboard / Storyboard / Scene Workspace | timeline/workspace | nested Storyboard shell |
| visual-story | Dashboard / Storyboard / Visual Story | canvas/visual workspace | nested Storyboard shell |
| profile | Dashboard / Identity | two-column / layered frame | reusable layered frame evidence |
| settings | Dashboard / Manage | directory | standard shell |
| general | Dashboard / Manage / General | one-column configuration | standard settings shell |
| story-mode | Dashboard / Manage / Story Mode | directory | standard settings shell |
| local-ai | Dashboard / Manage / Story Mode / Local | settings/directory configuration | preferred selected-state evidence |
| cloud-story-mode | Dashboard / Manage / Story Mode / Cloud | settings/directory configuration | width comparison evidence |
| hybrid-story-mode | Dashboard / Manage / Story Mode / Hybrid | settings/directory configuration | normalize bright sub-header |
| node | Dashboard / Manage / Node Info | one-column configuration | standard settings shell |
| agents | Dashboard / Manage / Agents | settings/directory configuration | premium matte evidence |
| issue-log | Dashboard / Bug Report | one-column workspace | preferred sub-header evidence |
| licensing | Dashboard / Notices | one-column workspace | standard shell candidate |
| shutdown-node | Dashboard / Shut Down Node | one-column action | centered action shell |
| write | Dashboard / Write (direct capture route supported) | editor + inspector/evidence | production shell |
| storyboard | Dashboard / Storyboard | canvas/visual workspace | production shell |
| previs | Dashboard / Previs | canvas/visual workspace | production shell |
| pageflow | Dashboard / Refine / PageFlow (direct capture route supported) | editor + inspector/evidence | diagnostic shell |

## Preferred existing evidence to codify later

- Selected state: Local Story Mode capability/directory treatment, dark/green base with stronger light-green frame/outer trim.
- Layered frame: Profile outer frame + inset frame + inset column/pill framing.
- Matte finish: Agents and the stronger current settings/supporting surfaces.
- Sub-header: Issue Log's restrained green left-edge/eyebrow treatment.
- Return placement: Local Story Mode upper-right return behavior.
- Typography: current Skin V1 token roles; no local font-family authority.

## Human normalization ledger

The authoritative Human observations remain preserved verbatim in the Issue #2226 developer brief. The normalization targets are:

- Dashboard: rendered measure must be deliberately reviewed before any locked-reference change.
- Agents, Cloud Story Mode, Community, Issue Log, Local Story Mode, Profile and Settings: preserve good behavior and reuse their strongest existing shell/frame patterns.
- General: remove unexplained dead space by mapping to an existing one- or two-column pattern.
- Hybrid Story Mode: reduce overly bright sub-header treatment.
- Library family: one coordinated shell/gutter/header/footer/return/typography/border pass; Load remains grid/card browsing.
- Licensing/Notices: common matte shell; only link existing canonical docs.
- PageFlow: standard shell/gutters/upper-right origin-aware return; preserve read-only PPF authority.
- Previs and Storyboard: retire old-style header while preserving PPF/visual authority.
- Story Map: standard shell plus canonical dark/green selected state; remove stark white selection.
- Story Mode directory: standard header/return and structural framing.
- Visual Story: standard shell/footer/return and project-aware title.
- Write: standard shell/gutters while preserving Block-native editor authority.
- Writer's Craft: normalize frame/gutter and selected-state treatment without redesigning curriculum.
- Shutdown Node: normalize header and center/scale the existing action.
- Scene Workspace: treat as nested Storyboard/Visual Story timeline workspace, as resolved above.

## Phase 0 exit decision

Phase 0 is complete when tests prove the 76-surface census and 30-surface standard set are unchanged; Dashboard remains the only locked baseline; current root/settings/library ordering is recorded; Scene Workspace is resolved as a nested Storyboard timeline/workspace; no shell-level four-column archetype is invented; the Human review is preserved in-repository; and no visual CSS or baseline file is changed by the Phase 0 PR.
