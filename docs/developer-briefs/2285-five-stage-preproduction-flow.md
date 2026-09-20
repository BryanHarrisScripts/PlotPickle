# #2285 — Five-stage pre-production flow

## Status

Implementation developer brief for the Human-approved visible pre-production sequence.

## Product decision

PlotPickle exposes one five-stage Human-facing pre-production flow:

`Outline → Storyboard → Previs → Timeline → Production`

This supersedes the mistaken top-level interpretation of the older #2092 Outline / Breakdown / Storyboard / Previs / Production Plan architecture. The older model remains useful as internal progressive-authoring semantics, but it is not the visible five-screen route sequence.

The visible name **Timeline** replaces the long **Scene Workspace** label. Internal scene-workspace / scene-timeline identifiers may remain where changing them would create unnecessary migration risk.

## Objective

Make the flow readable in two directions.

Vertically, Dashboard PRE-PRODUCTION exposes five connected stage destinations in the approved order.

Horizontally, every one of those stages exposes the same five-stage rail so the Human can move across the developing story without returning to Dashboard.

The selected canonical project and Block / Mini-Block address must survive stage changes. Existing Scene / Shot identity remains attached wherever the target projection supports it.

## Existing authority to reuse

This issue is a surface/navigation convergence task, not a new story or production architecture.

Reuse:

- Outline / Story Map as the current 24 Block / 96 Mini-Block structural projection;
- Storyboard as the existing candidate/kept visual and shot-intent authority;
- Previs as the existing Production Shot, camera, motion and timing authority;
- #2171 Scene Workspace / Scene Timeline projection as the implementation behind the visible Timeline stage;
- #2173 provider-neutral Production Convergence, Director Specification readiness and existing approved production-intent contracts;
- current PPF / Foundation Project as canonical project truth;
- Skin V1 Surface Registry / Surface Orchestrator / Dashboard design authority.

Do not introduce a new project store, Scene store, Shot store, timeline store, approval store, provider selector, prompt store or compiler.

The legacy mutable `/production` surface remains legacy/compatibility. This issue must not silently redefine it as the new canonical Production stage.

## Vertical five-stage navigation

Dashboard PRE-PRODUCTION adds two connected rows:

- Timeline;
- Production.

The five workflow rows appear in this exact order:

1. Outline
2. Storyboard
3. Previs
4. Timeline
5. Production

Existing adjacent reference utilities, such as Story Bible, remain separate from the five-stage workflow and do not become a sixth stage.

## Horizontal five-stage movement

Inside each stage, show one shared rail:

`Outline → Storyboard → Previs → Timeline → Production`

The rail:

- exposes all five destinations at once;
- marks the current stage;
- uses existing Skin V1 controls/tokens;
- preserves the current Block / Mini-Block;
- does not create a second router or navigation authority;
- does not require returning to Dashboard between stages.

## One layer deep

The implementation must show real story/production evidence rather than five empty landing pages.

### Outline

Retain the existing Block / Mini-Block story structure and written-source projection.

### Storyboard

Retain the existing four Mini-Block visual anchors and real candidate/kept visual evidence.

Existing Visual Story code may continue as a nested Storyboard projection. It is not a sixth top-level stage.

### Previs

Retain visual coverage, Production Shots, motion/camera/timing evidence and truthful missing/stale states.

### Timeline

Expose the existing #2171 synchronized scene workbench as a first-class stage.

The visible title is **Timeline**.

The current projection remains responsible for real:

- screenplay/source context;
- playback/preview;
- Dialogue;
- Action;
- Shot;
- Audio;
- cue inspection;
- playhead/timing evidence.

Missing Scene or timing evidence stays explicitly missing. Timeline must never manufacture cues simply to fill the screen.

### Production

Expose one real downstream provider-neutral production-readiness projection for the selected Block / Mini-Block.

At minimum show:

- Storyboard coverage state;
- Previs/timing eligibility;
- current Production Shots;
- stale/review-required state;
- approved-shot/readiness state;
- provider-neutral handoff/readiness explanation.

This first depth is an inspection/readiness view over current authorities. It is not a replacement for #2173 and must not fake a successful Director Specification when required approval/evidence is absent.

## Visual / naming convergence

Human-facing copy and WebMCP navigation evidence should say **Timeline**, while stable internal selectors such as `data-scene-workspace` and the canonical id `scene-timeline` may remain for compatibility.

Production may enter the Surface Registry as a governed census-only stage in this slice so the frozen 30-surface WebMCP baseline set is not expanded accidentally. Timeline remains part of the standard WebMCP catalogue and should be reachable through its new Dashboard row.

## Verification

Required focused evidence:

- Dashboard menu contains all five workflow stages in order and Timeline/Production are connected.
- Dashboard review host can open Timeline and Production.
- every five-stage screen renders the shared horizontal rail;
- Block / Mini-Block address is preserved during stage changes;
- Timeline reuses `VisualStoryWorkspace` / existing scene-timeline authority with `initialView="timeline"`;
- Production reuses `derivePrevisProjection` and displays truthful evidence/readiness;
- visible Scene Workspace / Scene Timeline stage naming converges to Timeline without renaming stable internal selectors;
- legacy `/production` remains untouched as legacy;
- WebMCP Timeline navigation resolves through the Dashboard Timeline row;
- standard WebMCP surface count remains 30.

Run the nearest focused regression, focused UAT contracts, production build, convergence, Architecture Verification, BEN, CodeQL and required exact-head CI. Merge only the exact green head.

## Acceptance

The Human can start at the current story address and see the project become progressively more production-specific through:

**Outline → Storyboard → Previs → Timeline → Production**

The same five choices are visible vertically on Dashboard and horizontally inside the workflow, and both Timeline and Production show real existing evidence at least one layer deep.
