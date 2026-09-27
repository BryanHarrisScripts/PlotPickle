# Developer Brief — #2487 Story-to-Screen Live Parity Closure

## Purpose

Close the remaining proof gap for #2487 without redesigning Timeline, Sound, Rough Cut, or Screening.

The later #2489/#2490 reconciliation already landed most of #2487's product requirements on main:

- canonical surface id `production` is Human-facing **Rough Cut**;
- Dashboard menu says **Rough Cut**;
- the Rough Cut workspace banner says **ROUGH CUT**;
- the live continuity probe opens Timeline, Foley, Narration, Music, Rough Cut, and Screening from the real Dashboard menu;
- each destination waits for its governed runtime-ready selector and settled Surface Orchestrator identity/label.

The remaining issue-specific gap is explicit proof that every opened destination returns through the visible **Back to Dashboard** control and that Dashboard itself settles cleanly before the next journey.

## Change

Extend `runWebMcpContinuityProfile` so every normal-Dashboard stage journey:

1. opens Dashboard;
2. clicks the actual Dashboard menu item;
3. waits for the expected `data-dashboard-review-surface`;
4. waits for the canonical runtime-ready selector;
5. validates settled orchestrator id and Human-facing label;
6. clicks the visible **Back to Dashboard** control;
7. waits for canonical Dashboard readiness;
8. validates settled Dashboard orchestrator id/label;
9. records a separate PASS/FAIL return journey.

This applies to the existing stage loop and therefore covers the six #2487 destinations:

- Timeline;
- Foley;
- Narration;
- Music;
- Rough Cut;
- Screening.

## Boundaries

- Do not redesign any story-to-screen workspace.
- Do not rename the stable internal `production` id.
- Do not alter production/story canon data.
- Do not change provider routing.
- Do not duplicate #2489's canonical label work.
- Existing Previs/Outline/Storyboard coverage remains in the shared continuity loop.

## Verification

Focused regression must prove:

- canonical `production` label/navigation label is **Rough Cut**;
- Dashboard and review-host Human-facing labels remain correct;
- the six #2487 destinations are present in the real-browser Dashboard loop;
- the probe clicks each actual menu item and waits for the expected rendered review surface;
- the probe validates canonical ready selector, settled surface id, and settled label;
- the probe clicks **Back to Dashboard** and validates Dashboard settles;
- the probe is wired through the WebMCP QA runner rather than being source-only documentation.

## Delivery

Build and focused verification, then open a PR. Stop at the PR unless the Human separately requests testing/merge.
