# Issue #2226 — Skin V1 Surface Orchestrator

The Skin V1 JSON stack is now wired into the real application runtime.

## Runtime authority

The orchestrator consumes:

1. `app/skin-v1-definition.css` — tokens;
2. `config/skin-v1-surface-composition-reference.json` — component/composition rules;
3. `config/skin-v1-surface-anatomy-contract.json` — region meaning and placement;
4. `config/skin-v1-surface-declarations/standard-surfaces.json` plus explicit surface overrides — per-surface declarations;
5. `config/skin-v1-surface-registry.json` — canonical identity, parentage and layout/shell/frame profiles.

All 30 standard WebMCP surfaces now carry canonical runtime selectors and are marked `orchestrated: true`.

## Visible runtime wrapper

The live application renders one common environment around the active surface:

- PLOTPICKLE | CURRENT SURFACE | SKIN V1 global header;
- upper-right Return action beneath the header;
- 1180px governed active shell;
- 1px standard outer frame + 1px inset treatment on orchestrated non-Dashboard surfaces; the locked Dashboard layered reference keeps its separately governed stronger perimeter until explicitly replaced;
- square matte Skin V1 controls and selected states;
- title hierarchy normalized to the Skin V1 type scale;
- footer/status/context strip.

Existing feature owners still own their content and behavior. The orchestrator does not copy Library, Storyboard, Previs, Write, Scene Workspace or Settings into a second store.

## Representative evidence

WebMCP prepares the deterministic local Afterglow v9 working copy before catalogue capture. This lets Story Map / Storyboard / Visual Story / Scene Workspace / Previs render against one real project rather than whichever empty project happened to be active.

Scene Workspace retains its explicit anatomy override: Script Preview + Playback + Inspector, with a nested Dialogue / Action / Shot / Audio timeline.

## WebMCP fence

WebMCP now requires the live captured surface root to expose:

- `data-skin-v1-orchestrated="true"`;
- `data-skin-v1-orchestrator-active="true"`;
- the expected `data-skin-v1-surface-id`.

Candidate PNGs are captured from the complete orchestrator frame rather than the legacy surface root, so Human review sees the same environment the application renders.


## Nested return brokerage

The orchestrator is also the migration bridge for nested navigation. When an active feature owner exposes a more-specific local `Back to …` action than the registered surface parent, the orchestrator adopts that target into its single upper-right Return control and invokes the existing feature-owned handler. The original local control remains mounted for behavior/state ownership but is visually suppressed, preventing duplicate left/right Back actions.

This is especially important for LEARN, where the canonical hierarchy remains lesson → Craft Module → Path → Writer's Craft even though the orchestrator owns visible chrome.


## Route migration ledger

Skin V1 route ownership is now derived from the canonical Surface Registry rather than duplicated in runtime constants. `app/skin-v1-route-contract.ts` is consumed by both `SkinV1Runtime` and `LegacySkinOnly`, so an orchestrated direct route cannot be classified as Skin V1 by one boundary and legacy by the other.

`lib/verification/skin-v1-route-migration-ledger.mjs` projects the remaining migration debt from the same registry. The current burn-down snapshot is 11 canonical direct orchestrated routes, 24 routed census-only compatibility entries, 10 state-only census compatibility entries, and 5 declared public exceptions. `scripts/write-skin-v1-route-migration-ledger.mjs` materializes that projection at `.artifacts/visual-readiness/skin-v1-route-migration-ledger.json` for review and CI evidence.

The ledger is not a second route authority. Entries disappear only by migrating their canonical registry surface into the orchestrated runtime contract or by explicitly reclassifying a legitimate exception in the canonical registry.


Edit and Refine are the first census-only routes promoted into runtime orchestration without expanding the 30-surface WebMCP standard capture set. Edit keeps its three-column editorial owner; Refine keeps its diagnostic owner while the old local return chrome is suppressed under the canonical shell.

Feedback now owns `/feedback` as a canonical orchestrated census route backed by the existing `FeedbackWorkspace`. `/pitch-review` remains a separate contextual Pitch/Plan workspace, so the former identity conflict is resolved without collapsing Pitch into Feedback. The 30-surface WebMCP standard capture set remains unchanged.


Reports now owns `/reports` as a canonical orchestrated census route backed by the existing read-only `ReportsWorkspace`. The mutable `/production` route remains a separate legacy Build/Production surface. This removes the previous Reports/Production identity collision without changing production planning behavior or expanding the 30-surface WebMCP standard capture set.


CraftLoop, DraftLens and Resonance now sit beneath Refine in the canonical registry and are orchestrated census routes. Direct routed children use the registered parent surface's canonical `runtimeRoute`, so their single upper-right Return goes to `/diagnostics` instead of falling back to Dashboard. Their existing feature content remains mounted, while local compatibility return chrome is suppressed by the orchestrator.
