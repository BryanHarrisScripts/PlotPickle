# #1965 — Settings ordering and Profile readiness breathing room

Parent: #1962  
Blocks: #1918 Phase 5

## Why

Real-machine review after #1918 Phase 4 found two small presentation problems before continuing the LEARN rollout:

1. Options & Settings leads with Workspace even though the Human is primarily entering the surface to inspect the active systems. Unwired rows also repeat `[NOT CONNECTED]` after the description despite already having a truthful status square.
2. User Profile reserves a narrow third desktop column for readiness links, compressing the Human identity/character presentation. The component already uses a better full-width readiness layout below 980px.

## Build

### Settings

- `SYSTEMS` is first.
- Its first three destinations are exactly `Node Info`, `Local Story Mode`, `Cloud Story Mode`.
- Existing keyboard shortcuts, arrow-key navigation, connected/unwired attributes and status squares remain authoritative.
- `[NOT CONNECTED]` is removed only from the visible row copy. This slice does not connect any additional destination.
- `WORKSPACE` follows Systems and keeps its existing destinations.

### Profile

- Keep the five existing readiness signals and Settings handoffs: BUZZ Identity, Community BBS, Local Model, ComfyUI and Cloud Compute.
- Promote the existing roomier two-column identity-summary geometry to desktop.
- Move the readiness rail across the full width below the identity portrait/copy.
- Keep readiness actions visually flat/text-like rather than pill-like while preserving keyboard focus and the canonical Skin V1 control height.
- On narrow mobile widths, retain the existing one-column identity summary and two-column readiness wrapping.

## Non-goals

- No runtime/provider readiness logic changes.
- No connection-state semantic changes.
- No Community work.
- No Writer's Craft / LEARN navigation cutover.
- No story startup, branding/favicon or dashboard-footer work.
- No #1918 Phase 5 curriculum expansion.

## Verification

The existing `experience.pre-phase2-1954` baseline already owns Settings/Profile Skin V1 geometry. #1965 extends that same focused baseline rather than creating a parallel visual authority.

Acceptance requires:

- deterministic source assertions for Settings order and removal of redundant row copy;
- deterministic source/CSS assertions for Profile readiness geometry and actionable labels;
- #1965 real-diff development convergence;
- exact-head seven-layer Architecture Verification;
- live WebMCP/UI conformance and Visual Director evidence from Layer 1.
