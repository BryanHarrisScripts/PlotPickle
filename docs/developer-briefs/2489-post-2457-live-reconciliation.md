# 2489 — Post-#2457 live reconciliation

## Objective

Complete the post-#2457 live reconciliation after #2485 by proving the normal Dashboard/Option 1 path and correcting the remaining visible mismatches already identified.

## Confirmed items to repair

1. **Previs evidence-state colors**
   - The shared Progressive Story Map carries the five canonical states.
   - `preproduction-matrix-contract.css` currently restores the five distinct colors for Outline and Storyboard, but not Previs.
   - Previs therefore falls back to the generic monochrome Matrix variables.
   - Include the Previs review surface in the explicit five-color restoration:
     - Defined green
     - Observed blue
     - Emerging amber
     - Available red
     - Blocked violet

2. **Rough Cut canonical surface name**
   - Dashboard item id `production` is correctly Human-facing as **Rough Cut**.
   - The rendered host heading is already **ROUGH CUT**.
   - The canonical surface registry still labels that runtime surface **Production**.
   - Normalize the governed runtime identity to **Rough Cut** without changing the underlying id or production-domain data contracts.

3. **Rendered Option 1 downstream proof**
   Extend the settled-surface browser continuity path introduced by #2485 so the normal Dashboard path proves:
   - Outline -> `story-map`
   - Storyboard -> `storyboard`
   - Previs -> `previs`
   - Timeline -> `scene-timeline`
   - Foley -> `sound-foley`
   - Narration -> `sound-narration`
   - Music -> `sound-music`
   - Rough Cut -> `production`
   - Screening -> `screening`

   For each:
   - open from Dashboard;
   - wait for its real ready selector;
   - wait for the Surface Orchestrator to settle;
   - assert the active orchestrator surface id equals the intended surface;
   - assert the orchestrator label equals the canonical Human-facing label.

4. **Previs post-load proof**
   In addition to active identity:
   - shared Progressive Story Map remains visible;
   - five evidence states are rendered under the Previs surface;
   - Previs does not settle back to Outline.

## Boundaries

- Do not redesign Outline.
- Do not alter Storyboard Keep/Lock authority.
- Do not change Timeline, Sound, Rough Cut or Screening creative/canon authority.
- Do not implement Graphic Novel Animated WebP here; that remains the next separate implementation.
- Do not merge PR #2484 until this reconciliation is green on main.

## Acceptance

- [ ] Previs visibly receives the five-state color palette.
- [ ] Canonical runtime label for `production` is Rough Cut.
- [ ] Normal Dashboard browser journey proves all nine listed surfaces settle to their intended runtime owner.
- [ ] A wrong settled surface or label is a blocker.
- [ ] Existing source-contract tests remain supplemental.
- [ ] Relevant #2457/#2463/#2476 visible Previs behavior is covered by rendered proof.
- [ ] #2459 Timeline/Sound/Rough Cut/Screening entry surfaces are rendered and ownership-verified.
- [ ] Exact-head Architecture Verification is green before merge.

