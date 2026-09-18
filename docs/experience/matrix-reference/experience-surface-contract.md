# Matrix Experience Surface Contract

Issue: #2124  
Contract ID: `matrix-experience-surface-v1`  
Version: `1.1.0`  
Authority: engineering presentation contract

## Authority hierarchy

The Matrix implementation authority is now:

```text
Existing Matrix implementation + existing --pp-skin-* tokens
→ Dashboard locked real-app baseline as canonical visual precedent
→ other real Matrix screenshots as unlocked/candidate reference corpus
→ Experience Surface Contract
→ implemented PlotPickle surface
→ existing WebMCP / Experience Skins verification
→ real application screenshot candidate / locked baseline
```

Historical reference lifecycle remains valid:

```text
Approved Matrix reference artifact
→ Experience Surface Contract
→ implemented PlotPickle surface
→ existing WebMCP / Experience Skins verification
→ real application screenshot candidate / locked baseline
```

However, the three Phase 2 SVG boards are now `superseded-reference`. They remain useful conceptual studies but are not implementation targets and must not be reproduced pixel-for-pixel.

The Dashboard real application screenshot is the sole locked Matrix baseline and the canonical visual precedent for extending Matrix into new surfaces. Other existing real Matrix screenshots remain legitimate visual examples while they are `candidate`, but they are not frozen regression truth.

This document is the engineering truth for Matrix presentation behaviour. Real PlotPickle screenshots remain regression evidence. Generated or deterministic reference boards are never production screenshots and never become regression baselines.

No rule in this contract changes Story/PPF, provider, Agent, Creative Transaction or production-object authority.

## Contract shape

Every governed UI rule should be expressible as:

```text
Surface → Region → Component → State → Tokens → Behaviour
```

A component is incomplete when only its happy/default state is implemented. Where relevant, implementation and verification must cover default, hover, selected, keyboard-focused, disabled, empty, loading/async, error, validation and overflow/constrained-width behaviour.

## Visual precedent rule

When implementing a new Matrix surface:

1. start from the current Matrix implementation and existing `--pp-skin-*` tokens;
2. use the locked Dashboard real-app screenshot as the canonical visual precedent;
3. use other current Matrix screenshots as supporting unlocked examples;
4. apply the written behaviour and hierarchy rules in this contract;
5. do not treat the superseded SVG compositions as layout specifications;
6. capture the real application output through the existing WebMCP / Experience Skins path;
7. keep the new capture candidate until Human approval explicitly locks it.

The objective is to extend Matrix, not redesign Matrix around a mockup.

## Shared Matrix invariants

### Visual language

- Predominantly black canvas and dark stepped surfaces.
- White / light-gray primary copy with muted gray secondary copy.
- Restrained three-role Matrix green: deep, standard accent and bright/focus. Green communicates focus, active state, readiness or bounded emphasis; it is not broad decoration.
- Square or near-square geometry. The canonical radius remains `--pp-skin-radius` and is currently zero.
- Thin borders and stepped 8/16-bit shading. Do not add glass, blur, floating soft cards or ornamental frame stacks.
- One dominant work area per surface. Supporting rails, inspectors and status areas remain subordinate to it.
- Media may retain source colour, but visual-story planning surfaces may intentionally present black-and-white or low-fidelity planning imagery when the owning workflow calls for it.
- New pre-production surfaces should look like the current PlotPickle Matrix application first; domain-specific layout may increase density but must not introduce a separate visual system.

### Canonical token authority

Implementations consume the existing `--pp-skin-*` semantic contract rather than inventing local color systems. Relevant roles include:

- canvas / surfaces: `--pp-skin-canvas`, `--pp-skin-surface-*`;
- primary / soft / muted text: `--pp-skin-ink`, `--pp-skin-ink-soft`, `--pp-skin-ink-muted`;
- lines: `--pp-skin-line`, `--pp-skin-line-soft`, `--pp-skin-line-strong`;
- accent / focus: `--pp-skin-accent-deep`, `--pp-skin-accent`, `--pp-skin-accent-bright`, `--pp-skin-focus`;
- selection: `--pp-skin-selected-bg`, `--pp-skin-selected-ink`;
- disabled: `--pp-skin-disabled`;
- warning / danger roles: existing `--pp-skin-warning-*` and `--pp-skin-danger-*`;
- typography, spacing, borders, control sizing, stepped fills, shadows and motion: existing `--pp-skin-font-*`, `--pp-skin-space-*`, `--pp-skin-border-*`, `--pp-skin-control-height`, `--pp-skin-touch-target`, `--pp-skin-fill-*`, `--pp-skin-shadow-*`, and `--pp-skin-motion-*`.

No second Matrix token namespace is permitted.

### Typography and density

- Keyboard-first UI text uses the existing Matrix monospace stack.
- Brand treatment may use the existing brand stack; work-area labels, controls, metadata and status text remain compact and utilitarian.
- Spacing follows the existing four-pixel grid.
- Dense information is allowed, but grouping is achieved through alignment, spacing and line hierarchy rather than nested decorative boxes.

## Regions

### Standard Header

Purpose: establish product/surface identity and immediate context.

Behaviour:
- remains visually compact;
- does not compete with the main work area;
- may expose current project/context and status only when those values already have an owning authority;
- loading must not cause header geometry to collapse.

### Master / Context Navigation

Purpose: move among peer or parent/child surfaces without creating authority.

Behaviour:
- keyboard reachable;
- selected and keyboard-focused states are visually distinct;
- shortcut labels are adjacent to the action where useful;
- return/back is explicit when entering a nested surface;
- navigation never silently mutates Story/PPF state.

### Main Viewport

Purpose: the dominant work area.

Behaviour:
- receives the largest spatial allocation;
- scrolls intentionally when content exceeds available space;
- preserves selected/focused context during overflow;
- loading retains structural context rather than replacing the surface with an unrelated full-page state;
- empty state explains what is missing and the legitimate next action without manufacturing content.

### Inspector / Detail Region

Purpose: explain or edit the currently selected object when the owning workflow permits editing.

Behaviour:
- selection identity matches the same stable underlying object used by the main viewport;
- inspector state does not create a parallel copy of Story/Shot/Frame data;
- read-only authority remains visibly read-only;
- validation is local to the relevant control or section.

### Status Bar

Purpose: concise operational/readiness information.

Behaviour:
- status meaning is paired with text or another non-color signal;
- warning/error is bounded to the affected condition;
- absence/unavailability must not be styled as success.

## Shared components and states

### Menu / list row

- **Default:** readable on dark stepped surface.
- **Hover:** subtle surface/line change; must not look selected.
- **Selected:** clear selected treatment with text/state change beyond color alone.
- **Keyboard focused:** explicit `--pp-skin-focus` boundary distinct from selected.
- **Disabled:** readable, non-interactive, visibly unavailable.

### Primary / secondary action

- Primary action is visually strongest only within its local region.
- Disabled primary actions must not appear actionable.
- Async actions preserve width/placement and expose working state.
- Destructive/error semantics use existing danger roles rather than Matrix green.

### Tabs / view switcher

- Represent alternate projections of the same underlying context, not duplicate stores.
- Selected view and keyboard focus are independent states.
- Switching views preserves stable object selection when the destination can represent it.

### Media / Frame tile

- Shows existing artifact identity and review state truthfully.
- Candidate and kept/accepted states must be distinguishable.
- Missing media uses an explicit empty treatment; never fabricate a placeholder that looks canonical.

### Timeline lane / clip

- Placement reflects existing timing authority only.
- Untimed material remains visibly untimed/unplaced rather than receiving invented timestamps.
- Selected clip maps to the same Shot/Frame identity exposed by Visual Story.
- Playhead and focus treatment remain legible over dense lanes.

### Messages

- **Empty:** state what is absent and what legitimate action can resolve it.
- **Loading/async:** preserve structural context and identify the work in progress.
- **Error:** explicit, bounded and actionable when recovery exists.
- **Validation:** attached to the relevant field/operation; do not convert the whole surface to alarm styling.

## Behaviour contract

### Keyboard

- All primary navigation and work-area controls are keyboard reachable.
- Focus must always be visible.
- Focus is not selection.
- Return/back behaviour is deterministic.
- Existing documented shortcuts remain authoritative; this contract does not invent competing shortcuts.

### Scroll / overflow

- Vertical/horizontal overflow is intentional and discoverable.
- Active selection/focus must not become hidden without a way to bring it back into view.
- Timeline and dense board surfaces may scroll internally when this preserves surrounding context better than whole-page scrolling.

### Responsive / constrained width

- Preserve hierarchy before density: header/context, primary work area, selection, then secondary detail.
- Inspectors or secondary rails may stack below the main viewport rather than compressing the primary work area to illegibility.
- Do not hide required state labels solely to preserve a desktop arrangement.

### Human approval

- Candidate generation, AI suggestions or imported visuals must never look Human-approved unless their owning data actually records that approval.
- A request to continue work does not by itself make a conceptual design artifact a pixel-level implementation target.
- Superseded reference boards remain available for design history but do not outrank the existing Matrix application or the locked Dashboard baseline.

## Surface profiles

### Story Map

**Surface:** whole-story structural overview.  
**Primary Region:** Main Viewport.  
**Primary Components:** Act group, Sequence group, Block card, Mini-Block detail/context, structural marker.  
**Required hierarchy:** 4 Acts → 12 Sequences → 24 Blocks → 96 Mini-Blocks, using current PPF-backed structure authority.

Rules:
- retain the calendar-like whole-film scanability;
- Acts and Sequences provide spatial grouping, not new storage;
- selected Block/Mini-Block is obvious and keyboard reachable;
- Act-turn/finale markers remain structural context, not decorative badges;
- the map is the macro orientation layer and should not imitate a timeline;
- opening Visual Story carries the same selected structural address forward;
- visual chrome extends the existing Matrix Dashboard language rather than the superseded Board A SVG composition.

### Visual Story

**Surface:** black-and-white visual screenplay for the selected Scene context.  
**Primary Region:** Main Viewport.  
**Secondary Region:** Selected Shot inspector.  
**Primary Components:** Scene header/context, Beat span, Shot card, Frame strip/tile, view switcher, Shot information boundary.

Rules:
- hierarchy is Scene → Beat → Shot → Frame;
- Beat density, Shot density and Frame density are variable;
- rough/black-and-white visual planning is allowed and should dominate over prose when visual material exists;
- missing Beat/Shot/Frame relationships are shown truthfully; the surface does not manufacture them;
- selected Shot identity is shared with Scene Workspace;
- #2107 SHOW_NOW / WITHHOLD_NOW information is presented as Shot meaning, not a separate authority;
- candidate versus kept/accepted Frame state remains visible;
- moving to Scene Workspace preserves selected Scene/Shot when representable;
- Matrix controls, borders, typography and status treatment follow the existing application precedent rather than the superseded SVG boards.

### Scene Workspace

**Surface:** synchronized selected-Scene workbench.  
**Primary Regions:** screenplay source preview, intent playback, cue inspector, synchronized timeline.  
**Primary Components:** context strip, source passages, transport/playhead, Dialogue lane, Action lane, Shot lane, Audio lane, cue inspector, truthful untimed/unplaced material.

Rules:
- the first-order synchronization workflow is Dialogue / Action / Shot / Audio;
- cue identities reference real screenplay passages, Previs Shots, Sequence Director Beats or Sonic Cues rather than free-floating timeline blocks;
- only actual timing authority places material on the clock;
- untimed Dialogue/Action/Audio remains visibly unplaced rather than receiving invented timestamps;
- selected Shot identity synchronizes with Visual Story through stable identities;
- the inspector preserves owner/source/address/timing and routes back to Write or forward to Previs without creating a new authority;
- timing edits reuse the existing permitted Previs authority/change path and must not bypass #2035 for approved creative state;
- playback is an intent preview over rough/candidate/kept media and does not claim frame-accurate final playback;
- the workspace is a projection over existing creative state, not a second timeline or cue store;
- Premiere-like density may inform the work-area arrangement, but chrome and state treatment remain Matrix-native.

## Matrix Reference Artifact Contract

Reference artifacts live under `docs/experience/matrix-reference/` and must carry enough metadata to identify:

```text
artifactId
artifactType
sourcePromptId
version
generator or renderMethod
referenceInputs
approvalState
scope
allowedUsage
disallowedUsage
relatedSurfaceContractSections
relatedCandidateOrLockedBaselines
```

Allowed approval states:

```text
candidate-reference
approved-reference
superseded-reference
```

Allowed usage of an approved reference:
- inform implementation where it remains compatible with the current Matrix application;
- be cited by this Experience Surface Contract;
- guide shared component/token work;
- guide existing WebMCP expectations.

Allowed usage of a superseded reference:
- preserve design history;
- explain prior exploration;
- retain conceptual ideas that are independently supported by the written contract or current Matrix implementation.

Disallowed usage:
- Story/PPF canon;
- production screenshot;
- locked baseline;
- automatic visual approval;
- sole regression oracle;
- pixel-level implementation target after supersession;
- justification for unrelated surface rewrites.

Current superseded design studies:
- `matrix-board-a-interface-blueprint-v1-candidate` — Interface Blueprint;
- `matrix-board-b-interaction-state-v1-candidate` — Interaction & State Guide;
- `matrix-board-c-tokens-operational-v1-candidate` — Tokens & Operational Style Guide.

The artifact IDs remain stable while their current `approvalState` is `superseded-reference`.

Reference SVGs never enter the real-app baseline set.

## Baseline governance

Current Human-approved baseline rule:

```text
Dashboard real-app screenshot = locked canonical Matrix baseline
All other current Matrix surfaces = candidate/unlocked
New pre-production surfaces = candidate until explicit Human approval
```

A candidate screenshot may still be used as a supporting example of the current Matrix implementation, but only a `locked` entry is strict regression truth.

For a new or materially changed surface:

```text
Existing Matrix implementation + Dashboard locked precedent
→ implement through shared contract/tokens
→ existing WebMCP / Experience Skins verification
→ capture real PlotPickle output as candidate
→ Human review
→ optionally lock that real screenshot explicitly
```

Do not automatically lock any surface because it was generated, implemented or successfully verified. Do not unlock Dashboard without explicit Human direction.

## Verification handoff

Phase 4 may extend only the existing standard-surface catalogue/selectors/ownership metadata required to make governed surfaces navigable and inspectable by current WebMCP + Experience Skins verification.

Story Map, Visual Story and Scene Workspace should first enter the verification system as candidate/unlocked surfaces. Their real application captures, not the superseded SVGs, are the review material for any future lock decision.

Phase 4 must not create a second verifier, second visual harness, new design Agent or parallel screenshot governance system.
