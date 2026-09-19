# #2249 — Skin V1 navigation continuity regression repair

## Human UAT

September 19, 2026 manual testing exposed four related continuity failures after the #2161/#2226 integrations:

- Notices / Licensing opens but the orchestrated Back to Dashboard action does not close the owning Dashboard host state.
- Storyboard can enter Visual Story, but the nested Visual Story projection has no real Storyboard-owned return transition.
- Previs can enter BUILD Evidence, but the existing BUILD authority arrives with an older visual treatment and loses the Human's immediate source context.
- Writer's Craft / All Curriculum can open a presentation lesson, but the lesson root stops matching the registered Writer's Craft surface, so Skin V1 hides the local return banner without providing a usable delegated return.

The Human also called out a green-looking Previs submenu regression. Inspection confirms Previs selected states already use the canonical `canonical-dark-accent` Skin V1 token rather than a rogue local colour. This issue therefore removes the genuine hard-coded teal/green legacy palette from the BUILD surface reached from Previs and preserves the governed Previs selected-state contract.

## Ownership

This repair does not introduce a navigation framework or creative authority.

- Dashboard nested-panel state stays in `DashboardBbsReviewHost`.
- Storyboard owns whether its nested Visual Story projection is open.
- Visual Story remains a projection over existing Scene/Beat/Shot/Frame authorities.
- `FoundationsBuildWorkspace` remains the one Foundations BUILD authority.
- Writer's Craft / All Curriculum retains `PPFProject.learning.completedLessonIds` as progress authority.
- Surface Registry / Surface Orchestrator remain global Skin V1 chrome and return owners.

## Repair contract

1. A global `plotpickle:return-dashboard` closes every Dashboard-owned nested panel, including Licensing and Issue Log.
2. Visual Story is mounted only when explicitly opened (or when a Visual Story deep-link requests Scene/Shot/Timeline context).
3. Visual Story exposes a real `Back to Storyboard` state transition. In the orchestrated Dashboard flow the local control remains the hidden delegate behind the single Skin V1 Return control; on the standalone Storyboard route it remains available as the local nested return.
4. WebMCP reaches Visual Story and Scene Workspace through the same explicit Open Visual Story interaction a Human uses.
5. BUILD Evidence records whether it was opened from Outline, Storyboard or Previs and returns to that source while preserving the current Block/Mini-Block.
6. The existing BUILD workspace keeps all provider, PPF, generation, acceptance and provenance behavior, but its hard-coded legacy teal/green styling is replaced by Skin V1 tokens and the standard shell dimensions.
7. All Curriculum lesson detail keeps the exact registered Writer's Craft root identity and lets the orchestrator delegate Back to All Curriculum to the existing `setOpenEntry(null)` transition.
8. No standard capture is added; the frozen set remains 30 surfaces.

## Verification

Focused #2249 coverage proves the owner-state closures, explicit Visual Story lifecycle, contextual BUILD return, stable lesson identity, tokenized BUILD presentation and unchanged standard capture count. Existing #2161, #1918/#1994 and #2226 contracts remain authoritative and exact-head Architecture Verification plus CodeQL are the merge gates.
