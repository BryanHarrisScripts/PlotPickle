# Issue #2226 Phase 1 — Navigation identity and evidence naming

Phase 1 makes navigation identity, evidence ordering and evidence filenames derive from the canonical Skin V1 Surface Registry. It does not change product visuals, shell measure, surface profiles or Human-approved baselines.

## Canonical identity

Every one of the 30 standard WebMCP surfaces now declares a navigationPath in config/skin-v1-surface-registry.json. Each segment contains the current navigation order, a stable slug and the Human-facing navigation label.

The path is evidence identity, not a second runtime router. Existing selectors and activation mechanics remain in the WebMCP compatibility capture registry until their separate migration is justified.

Important resolved identities include:

- Dashboard: 00-dashboard.
- Community: 01-community.
- Writer's Craft: 02-writers-craft.
- Library and its seven destinations: 03-library, then 01-new through 07-archive.
- Outline / Story Map: 04-outline__01-story-map.
- Storyboard: 05-storyboard; Visual Story is child 01 and Scene Workspace is child 02.
- Previs: 06-previs.
- Write: 07-write.
- Refine / PageFlow: 10-refine__03-pageflow.
- Identity: 14-identity.
- Manage: 15-manage, with General, Story Mode, Node Info and Agents in current submenu order.
- Story Mode: Local 01, Cloud 02, Hybrid 03.
- Bug Report: 16-bug-report.
- Notices: 17-notices.
- Shut Down Node: 19-shutdown-node.

The gaps are intentional. They preserve the actual current Dashboard directory positions rather than renumbering evidence around only the surfaces captured by WebMCP.

## Derived evidence names

The canonical registry owns the naming algorithm:

candidate root: .artifacts/visual-readiness
baseline root: tests/visual-baselines/skin-v1
order width: two digits
segment separator: double underscore
candidate suffix: __candidate.png
baseline suffix: .png

Examples:

00-dashboard__candidate.png
03-library__03-load__candidate.png
05-storyboard__02-scene-workspace__candidate.png
15-manage__02-story-mode__02-cloud__candidate.png

The WebMCP canonical projection derives these paths at runtime. The standard catalogue, Visual Director and startup UAT consume the canonical projection, so screenshot/report order and filename order cannot be maintained independently.

## Historical evidence migration

Each standard surface retains legacyEvidence aliases for its pre-#2226 candidate and baseline path.

The old Dashboard baseline remains at tests/visual-baselines/skin-v1/dashboard.png. Phase 1 adds tests/visual-baselines/skin-v1/00-dashboard.png as the same Git blob/content so the currently locked reference can operate under the new naming contract without deleting or obscuring the historical filename.

Candidate screenshots are generated artifacts rather than repository history. Their legacy names remain recorded in the canonical registry for traceability.

## Guardrail

scripts/lock-skin-visual-baseline.mjs now refuses baseline changes when the manifest surface set or any candidate/baseline path drifts from the canonical navigation identity.

This means:

Surface Registry navigation path -> canonical evidence stem -> WebMCP order -> candidate/baseline path -> Human baseline tooling.

No visual CSS, Surface Grammar profile, shell measure or locked-reference approval changes in Phase 1.
