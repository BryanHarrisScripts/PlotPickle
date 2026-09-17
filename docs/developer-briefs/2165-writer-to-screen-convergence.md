# #2165 — Writer-to-Screen Convergence

## Status

Product / architecture developer brief. This document captures the broader direction revealed by the September Human UAT and design discussion. It deliberately does **not** expand #2164 into a full production-system rewrite.

## Quadruple review

This brief was assembled only after reconciling four views of the same product problem.

### Review 1 — Human writer UAT

The Human entered PlotPickle as a writer, loaded Afterglow, moved through Library → Outline → Block/Mini-Block → Storyboard → Visual Story / Timeline → Previs, and repeatedly asked the same underlying questions:

- what have I actually written here?
- what does this Block/Mini-Block mean?
- what should I do next?
- when does written story become Scene / Beat / Shot / Frame?
- what is Storyboard for versus Previs?
- what is the final visual-production destination?

The Human also established the preferred Story Map orientation: one horizontal row per Act, moving left-to-right through that Act's sequences and turning point/finale.

### Review 2 — prior PlotPickle product decisions

The direction must preserve decisions already made across prior PlotPickle work:

- the canonical structural address space is 4 Acts → 12 Sequences → 24 Blocks → 96 Mini-Blocks;
- technical 2,400 RenderClip addresses are production plumbing, not creative Shot quotas;
- all workspaces operate over one canonical project / PPF rather than copying the story into module-specific stores;
- Afterglow is the canonical worked example for the 24/96 structure;
- AI/Agent output is proposal/evidence until Human approval;
- Learn teaches the same story structure the writer later uses;
- Storyboard, Previs and later production work must preserve source/story provenance rather than replacing it.

### Review 3 — current repository architecture

The current codebase already contains the boundaries this design should reuse:

- PPF / canonical project remains creative truth;
- PlotPickle CONTRACT preserves provider-neutral visual intent;
- PlotPickle COMPILER translates reviewed intent for an already-selected provider without redefining canon;
- the current pre-production provider-instruction compiler consumes a provider-neutral Director Specification and explicitly does not select providers, route jobs, call models, persist prompt prose, or promote generated instructions into creative state;
- Sequence Evidence already separates creative Shots from the 2,400 technical render addresses and verifies address/revision/provenance without claiming creative authority;
- Human approval remains the promotion boundary.

The new workflow therefore composes existing authorities; it does not introduce another canon store, provider router, evidence system or compiler owner.

### Review 4 — deterministic acceptance / CI

The writer-facing product promise must become testable. CI should verify story-to-screen continuity, identity, provenance and completeness without pretending to grade artistic quality and without requiring paid/cloud generation.

Afterglow can provide stable, known story addresses for this contract.

---

## Product thesis

**The written Block is the creative center. Everything downstream is a progressively richer projection of that same story address.**

The Human described this as a gravitational effect: as the work progresses, story structure, written pages, characters, references, visual choices, camera intent, sound, timing and production instructions are progressively pulled toward the same Block/Mini-Block/Scene identities until the final production object is assembled.

This is an explanatory metaphor, not a new authority or store.

The desired product chain is:

```text
LEARN
  ↓
WRITE
  ↓
OUTLINE
  ↓
STORYBOARD
  ↓
PREVIS
  ↓
SCENE WORKSPACE
  ↓
PRODUCTION
```

These are not seven independent copies of the story. They are seven views/degrees of completion over one canonical project.

---

## 1. Writing becomes block-native

### Human writing unit

A writer should be able to work in a named Block as a comprehensible screenplay chunk.

The Human's Afterglow workflow suggests a practical Block can often occupy roughly five-to-seven screenplay pages, but this is a **writing heuristic**, not a fixed schema requirement. Runtime, genre, pacing and dramatic density may vary.

Each writer-facing Block should expose:

- Act;
- Sequence;
- Block number;
- Block title/subtitle;
- dramatic purpose / expected movement;
- four Mini-Block positions;
- the real screenplay text associated with the selected Block/Mini-Block;
- page/source range when available;
- character/location/story references derived from real project evidence;
- status/progress without inventing missing writing.

### Deterministic writing surface

Writing should use the same structural language as Learn and Outline.

The writer should not learn one vocabulary in Writer's Craft, outline in another, and write in a third. A Block taught in Learn should look structurally familiar when the writer enters Outline and Write.

A useful default mental model is:

```text
BLOCK 01 — <Human-readable subtitle>
What must happen in this Block?

Mini-Block 1 — Promise
Mini-Block 2 — Progress
Mini-Block 3 — Pressure
Mini-Block 4 — Payoff

Written Story
<real screenplay material at the selected address>
```

The labels can remain configurable by story framework where already supported, but the address/provenance model does not change.

---

## 2. Outline is the structural reading of the writing

Outline answers:

> **What happens here, and why does it matter?**

It should not feel like a competing authoring system. It is the structural projection of what the writer is building.

For a selected Block/Mini-Block, Outline should present:

- the structural address;
- the Block subtitle/title;
- dramatic purpose and progression;
- the real written source material;
- the four Mini-Block positions;
- source gaps explicitly when material does not yet exist;
- a clear forward handoff to Storyboard / Previs.

The Story Map remains four horizontal Act rows:

```text
ACT 1 → Sequence 01 → Sequence 02 → Sequence 03 → turning point
ACT 2 → Sequence 04 → Sequence 05 → Sequence 06 → turning point
ACT 3 → Sequence 07 → Sequence 08 → Sequence 09 → turning point
ACT 4 → Sequence 10 → Sequence 11 → Sequence 12 → finale
```

---

## 3. Storyboard is the visual identity of the writing

Storyboard answers:

> **What does this story material look like?**

For a selected Block/Mini-Block and its real Scene/Beat material, Storyboard can progressively attach:

- character identity references;
- two or three representative character poses/expressions where useful;
- wardrobe / prop / location references;
- visual palette;
- lighting direction;
- tone;
- composition / framing;
- key visual moments;
- candidate images;
- accepted images;
- continuity/lock references.

These assets are not decorative extras. Once accepted, they become governed reference evidence consumed downstream.

The writer should be able to prompt in natural creative language while PlotPickle preserves the structured references and constraints behind that prompt.

---

## 4. Previs turns visual identity into movement

Previs answers:

> **How does it move and play?**

Previs begins with understandable visual coverage for the selected Block's four Mini-Blocks, then adds motion intent:

- character blocking;
- pose/action changes;
- camera framing and movement;
- duration / rough timing;
- pacing;
- transitions;
- emotional energy;
- lighting/tone changes;
- rough motion or low-resolution media when available.

Previs is a decision surface. It does not need final production quality.

---

## 5. Scene Workspace synchronizes the production language

Scene Workspace answers:

> **How do all the pieces line up over time?**

The target interaction model is a scene-level workbench with:

- screenplay / source preview;
- playback preview;
- inspector for the selected cue/object;
- synchronized timeline lanes.

Initial lanes:

- Dialogue;
- Action;
- Shot;
- Audio.

Later lanes may include Lighting, FX, Transition and Camera Motion when they carry useful editable intent.

A writer should be able to see a moment such as:

```text
Dialogue   | character speaks --------------------|
Action     |             turns sharply -----------|
Shot       |             medium → close-up -------|
Audio      | footsteps begin ---------------------|
```

This is where `Scene → Beat → Shot → Frame` becomes understandable in the product.

### Relationship to Block/Mini-Block

Block/Mini-Block and Scene/Beat/Shot/Frame are **related address systems, not a forced 1:1 hierarchy**.

- Block/Mini-Block = stable structural location in the whole story;
- Scene/Beat = variable-density authored story material related to one or more structural addresses;
- Shot/Frame = variable-density visual realization of that authored material;
- RenderClip = deterministic technical production address, not a creative Shot.

The UI must always preserve source references so the writer can move from a timeline cue back to the screenplay material that caused it.

---

## 6. Production compiles approved intent

Production answers:

> **Generate/render the approved result.**

The existing provider-neutral boundaries remain intact.

Accepted story and visual evidence can be compiled into a Director Specification / provider instruction bundle containing, where available:

- Scene purpose/objective/opposition/action/turn/outcome;
- character and asset references;
- narrative purpose of each Shot;
- continuity locks;
- framing/camera;
- blocking;
- timing;
- audio intent;
- transitions;
- provider capability treatments.

Provider-facing prompt prose remains disposable. The compiled output cannot select its own provider, promote itself into canon, or silently change the story.

---

## 7. Agentic one-click projection

The writer should not be forced to manually author every downstream production layer.

A writer who wants to remain focused on screenplay writing should eventually be able to request:

> **Visualize this Block**

or at a larger scope:

> **Build a visual production pass from my story.**

PlotPickle may then run bounded specialist work that proposes:

```text
Written Block
    ↓
Outline interpretation
    ↓
Storyboard references/candidates
    ↓
Previs movement/timing candidates
    ↓
Scene Workspace synchronization candidates
    ↓
Production candidate
```

At every stage:

- source story remains authoritative;
- generated material is candidate/proposal evidence;
- exact source and dependency refs are retained;
- accepted material can be locked/promoted only through existing Human authority;
- the writer can reject/regenerate a downstream layer or return upstream and rewrite the source;
- downstream stale evidence must be detectable when upstream accepted creative state changes.

This is the product-level expression of PlotPickle's existing execution, ledger, contract, compiler, binder, lock and evidence principles.

---

## 8. Afterglow becomes a story-to-screen acceptance fixture

**Afterglow: Reflections of Sentience** should serve two roles:

1. a Human-readable worked example inside PlotPickle;
2. a deterministic acceptance story for the script-to-screen pipeline.

### Fixture shape

Select one or more known Afterglow Blocks and freeze only the evidence required for deterministic verification:

- project/story identity;
- Act / Sequence / Block / Mini-Block addresses;
- Block title/subtitle;
- source passage IDs/hashes and expected source range;
- expected real Scene associations where already canonical;
- approved visual-reference IDs where available;
- known Storyboard/Previs evidence where available.

The fixture should avoid manufacturing downstream data merely to make the test complete.

### CI contract

A normal PR CI run should not require cloud spend or subjective visual judgement.

For an Afterglow fixture Block, deterministic CI can verify:

1. **Writing identity** — correct title/subtitle and source refs resolve at the expected Block/Mini-Block address.
2. **Outline fidelity** — Outline reads the same source evidence and structural address.
3. **Storyboard provenance** — any visual candidate/accepted reference remains tied to the correct story address/source revision.
4. **Previs provenance** — motion/timing/camera intent references the expected Storyboard/story evidence and does not substitute technical RenderClip count for creative Shots.
5. **Scene Workspace synchronization contract** — Dialogue/Action/Shot/Audio cues reference real Scene/Beat/Shot/source identities and preserve timing/order invariants.
6. **Production compilation** — a provider-neutral Director Specification compiles into disposable instructions without provider selection or canon promotion.
7. **Revision/staleness** — a changed accepted upstream story revision invalidates affected downstream certification while unaffected evidence remains valid where dependency rules permit.
8. **No manufactured completion** — absent Storyboard/Previs/Shot evidence is reported as absent rather than fabricated.

### Human / visual UAT

Separate from deterministic CI, a Human/WebMCP story-to-screen UAT can open the same Afterglow Block through:

`WRITE → OUTLINE → STORYBOARD → PREVIS → SCENE WORKSPACE → PRODUCTION`

and confirm that the same story remains recognizable, navigable and editable at each stage.

Provider-backed generation belongs in an explicitly authorized UAT/Responsibility Run, not ordinary PR CI.

---

## 9. Convergent mathematics, not creative grading

The shared deterministic address graph makes PlotPickle's measurable evidence stronger.

The system can increasingly measure facts such as:

- source coverage by Block/Mini-Block;
- structural completion;
- written-to-outline alignment;
- visual coverage;
- accepted versus candidate visual coverage;
- Previs coverage;
- timing/address coverage;
- provenance continuity;
- revision drift/staleness;
- synchronization completeness;
- render-address output coverage.

Those signals may support PlotPickle Score or later structural metrics, but **they do not become a machine judgement of whether the story is artistically good**.

The mathematical advantage comes from all stages sharing stable identities, dependencies and provenance.

---

## 10. Product surface principle

The gravitational/convergent model should be visible in the UI.

A writer should feel that the same Block is accumulating useful layers rather than being handed from one unrelated application to another.

Where practical, stage surfaces should preserve a common context strip such as:

```text
AFTERGLOW
ACT 1 · SEQUENCE 01 · BLOCK 01
<Human-readable Block subtitle>
MINI-BLOCK 2 · PROGRESS
```

and then change the work area beneath it:

```text
WRITE            screenplay pages
OUTLINE          what happens / why
STORYBOARD       what it looks like
PREVIS           how it moves
SCENE WORKSPACE  how cues synchronize
PRODUCTION       what is generated/rendered
```

This does not require every surface to have identical controls. It requires the writer to retain orientation, story identity and source continuity.

---

## 11. Implementation phases

### Phase A — Block-native writing contract

Formalize the writer-facing Block unit without changing canonical 24/96 identity:

- title/subtitle;
- source-text/page-span metadata where available;
- four Mini-Block projections;
- shared Learn/Write/Outline vocabulary;
- no fixed five-page enforcement.

### Phase B — Afterglow deterministic fixture

Create reviewed fixture(s) for one or more known Blocks and exact expected source/story refs.

### Phase C — Storyboard convergence

Attach visual references, character/location continuity, palette/lighting/tone and key-frame evidence to existing story addresses.

### Phase D — Previs convergence

Attach movement, camera, blocking and timing evidence to the same dependencies.

### Phase E — Scene Workspace

Create the synchronized screenplay/playback/inspector/timeline surface using real Scene/Beat/Shot/Audio evidence.

### Phase F — Production compilation

Connect approved Scene Workspace / Director Specification state to current provider-neutral compilation and existing routing.

### Phase G — Story-to-screen CI / UAT

Add Afterglow deterministic contract checks plus Human/WebMCP navigation/evidence checks.

### Phase H — Agentic projection

Allow bounded one-click downstream proposal generation from accepted written story material, with Human promotion at each authority boundary.

---

## 12. Non-goals / hard boundaries

- no exact five-page Block mandate;
- no forced one-Scene-per-Mini-Block mapping;
- no fixed creative Shot count derived from the 2,400 technical slots;
- no second PPF/project store;
- no generated filler to satisfy CI;
- no provider/model self-selection in the compiler layer;
- no automatic acceptance of Agent/model output;
- no subjective CI verdict on story quality;
- no requirement that a writer use the visual pipeline at all;
- no new top-level Dashboard clutter merely to expose internal pipeline stages;
- no replacement of existing PlotPickle CONTRACT / COMPILER / BINDER / LOCKS / Sequence Evidence authorities.

---

## 13. Acceptance story

The final product should support this Human experience:

> I write a named Block of my screenplay in a structure I understand. PlotPickle shows me where it sits in the whole story and what I actually wrote. If I want, PlotPickle can then propose what that Block looks like, how it moves, how the scene's dialogue/action/shots/audio synchronize, and what a production candidate looks like. I can accept, reject, revise or regenerate at every layer, return to the writing whenever I see a problem, and every downstream artifact remains traceable to the story I wrote.

That is the writer-to-screen contract #2165 exists to protect.
