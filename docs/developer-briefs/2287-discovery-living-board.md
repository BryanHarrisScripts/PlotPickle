# Developer Brief — Discovery Living Board with Agent-Classified Pins

## Purpose

Add a first-class **Discovery** destination to PlotPickle that sits upstream of formal story structure and lets a writer collect written and visual ideas, then deliberately **Pin** them into a governed living story map.

Discovery is the missing layer between free-form creative thought and the existing structured Story Card / 24-Block system.

The Human-facing navigation becomes:

### DEVELOPMENT

`Community → Writer's Craft → Discovery → Library`

### PRE-PRODUCTION

`Story Bible → Outline → Storyboard → Previs → Timeline → Production`

The current Dashboard item whose internal id is `story-bible` must no longer display the duplicate visible label `Pre-Production`. Its Human-facing label becomes **Story Bible**.

Baseline for this brief: `main@4a371d447f18fdb6f79fc76e4b076b470b1bd0b1`, immediately after #2285 / PR #2286 merged.

---

## Product decision

Discovery is **not** another Outline and must not create another 24/96 board.

The existing #2166 Story Cards Foundation Board remains the structured planning surface for:

`4 Acts → 12 Sequences → 24 Blocks → 96 Mini-Blocks`

Discovery lives before that level of commitment.

Its job is:

> Capture material freely, then show where PlotPickle systematically understands that material to fit in the emerging story.

The Human authors the material.

PlotPickle classifies and pins it.

Pin placement is a **non-canon Discovery projection**, not an AI rewrite of the story.

---

## Core experience

Discovery has two connected views over the same Discovery material:

1. **Discovery Inbox / Composer**
   - create new free-form cards;
   - review unpinned material;
   - support written and visual discoveries;
   - select **Pin** when the Human wants PlotPickle to classify the material.

2. **Living Discovery Board**
   - four vertical Act columns:
     - Act 1
     - Act 2
     - Act 3
     - Act 4
   - horizontal discovery lanes describing what kind of story contribution the material represents;
   - cards appear at the intersection of one Act and one lane.

The board is a living visual projection of the story shape, not a timeline and not a second story database.

---

## Initial Discovery lanes

Use a small explicit v1 lane set:

1. **Story / Plot**
2. **Character**
3. **Scene / Dialogue**
4. **World / Research**
5. **Theme / Motif**
6. **Visual / Mood**

Keep the lane identifiers configuration-owned / typed rather than scattering display strings through components so future lanes can be added deliberately.

Do not add production-specific Shot/Frame/Render lanes here. Those already belong downstream in Storyboard / Previs / Timeline / Production.

---

## Discovery card types

A Discovery card may represent material such as:

- general story idea;
- premise/logline fragment;
- plot event;
- character thought;
- relationship idea;
- scene idea;
- action fragment;
- dialogue fragment;
- world/research note;
- thematic question;
- motif;
- image/reference;
- location/costume/lighting/palette/composition thought;
- other bounded visual-development reference.

The card must preserve its original Human-authored content and provenance.

Do not rewrite the card merely to make classification easier.

A visual card may contain a reference to an existing project-owned or reference-library asset. Do not duplicate binary assets into a second Discovery asset store.

---

## Pin contract

### Human action

The Human creates/reviews a card and explicitly selects:

**Pin**

Pin is not drag-and-drop placement.

Pin means:

> Ask PlotPickle to determine the most defensible current Act and Discovery lane for this material.

### System action

The Pin request is intercepted by a bounded Discovery classification capability.

The classifier receives only the context needed to do the job:

- current card content/type;
- active project identity;
- existing canonical Story Bible / PPF facts needed for orientation;
- current story structure where established;
- relevant existing character/world evidence;
- relevant PlotPickle curriculum guidance;
- current Discovery-board evidence where useful to avoid context-free placement.

It returns a typed placement result such as:

- `act: 1 | 2 | 3 | 4`
- `lane: discoveryLaneId`
- concise classification reason;
- source/context references used;
- classifier/skill version;
- timestamp;
- optional bounded confidence/evidence state if the existing Agent contract supports it.

The host validates the result before storing it.

No free-form model response may directly mutate project canon.

---

## V1 placement authority — no manual repositioning

For the first version, once a card is pinned:

- the Human cannot drag it to another Act;
- the Human cannot manually change its lane;
- the Human cannot directly override the classification;
- the pinned placement is read-only;
- the board must visually communicate that placement is system-classified.

This is intentional.

The Living Discovery Board is meant to reveal PlotPickle's systematic reading of the material rather than become an arbitrary corkboard.

Do not expose hidden drag handles or alternate edit controls that bypass this rule.

For v1, treat a pinned card as an auditable snapshot. If substantially different creative material is needed, create a new Discovery card rather than silently rewriting the pinned card in place.

A later issue may add governed reconsider/reclassify workflows if Human UAT shows they are needed. Do not invent them in this issue.

---

## Agent + Skill architecture

Implement the Pin classification through PlotPickle's existing **Agent / Skill** architecture.

Do not introduce a second agent framework.

Preferred shape:

- a narrow Discovery role/capability hosted by the existing Mastra/runtime abstraction;
- a model-independent skill, for example:
  - `.agents/skills/discovery-mapper/SKILL.md`
  - registry entry in `config/agent-skills.json`;
- bounded project-context access;
- typed output contract owned by core/module code rather than by prompt prose;
- provider/runtime selection remains outside the skill.

A suitable Human-facing/internal responsibility name is **Discovery Mapper** (or equivalent concise name discovered during implementation).

Its responsibility is only:

> Given one unplaced Discovery item and the current project evidence, classify the item's best-fit Act and Discovery lane and explain the placement without rewriting story canon.

It is not a writing agent.

It does not create screenplay prose, generate missing plot events, change the Story Bible, or promote material into 24/96 structure.

### Reuse existing specialist knowledge

Where useful, reuse the existing Story Structure / Character specialist procedures and curriculum context rather than duplicating craft teaching inside the new skill.

The new skill may orchestrate/refer to existing knowledge, but its output contract remains Discovery placement only.

---

## Systematic placement rule

Use the cheapest authoritative evidence first.

### A. Existing material with a known canonical address

If a project item already has an accepted Block / Mini-Block / Scene address that deterministically implies an Act, **do not ask a model to guess its Act**.

Derive the Act from the existing canonical address.

Likewise, use deterministic object/type evidence for the lane when it is unambiguous.

Examples:

- accepted Block 03 story evidence → Act 1;
- accepted Block 14 character evidence → the Act implied by Block 14;
- existing visual reference already attached to a known story address → same Act, Visual / Mood lane.

This keeps existing-project hydration stable and inexpensive.

### B. Genuinely unplaced/new material

Use the Discovery Mapper skill when semantic interpretation is required, including a new local card such as:

- a loose piece of dialogue;
- a scene fragment with no story address;
- an image/reference with no structural placement;
- a new character thought;
- an unplaced thematic or world idea.

The classifier determines both Act and lane.

### C. Failure

If the classifier cannot run or cannot return a valid governed placement:

- do not invent a fallback pin;
- leave the card in the unpinned Inbox;
- show a clear bounded classification-unavailable/failure state;
- preserve the card exactly.

---

## Curriculum relationship

PlotPickle already contains:

- Act 1–4 character question banks;
- Inner Journey / Characters in Motion teaching;
- flexible opening, catalyst, threshold, midpoint, crisis, climax and ending checkpoints;
- 24-Block teaching;
- character choice/consequence/relationship movement;
- Story Bible and structural curriculum.

Use that material as **guidance/evidence**, not as a rigid formula.

The existing curriculum explicitly treats Act-specific questions and checkpoints as flexible rather than compulsory placement.

Therefore the Discovery Mapper must not reason as:

> Every story requires event X in Act Y, so force this card there.

It should reason as:

> Given this project's current evidence and the meaning of this card, this is the most defensible current placement.

Discovery may later surface optional Writer's Craft questions when an Act/lane is sparse, but it must not declare creative failure merely because a lane is empty.

---

## Loaded-project hydration

When a Library project is active, opening Discovery should immediately show a project-backed Living Discovery Board.

For a mature example such as **Afterglow**, the board should not begin empty.

Project material already known to PlotPickle should be projected into pins using existing evidence and addresses.

### Important boundary

"Show the story pinned" does **not** mean:

- create one card per screenplay line;
- duplicate the entire screenplay;
- copy every Story Bible field into another store;
- run an LLM over all content every time Discovery opens.

Instead, create a bounded Discovery projection from meaningful existing project objects/evidence and retain references back to their authoritative owners.

Existing canonical/project-backed pins are read-only projections.

Do not mutate their source through the Discovery board.

### Stability

Persist or deterministically derive stable pin identity so opening Afterglow repeatedly does not randomly move existing material.

Do not reclassify stable existing material on every render.

---

## New local material state

A card created by the current local Human and newly pinned into an existing story must be visually distinguishable from the story material that was already present.

V1 requires at least these source states:

- **PROJECT** — projected from existing project/canonical evidence;
- **NEW LOCAL** — newly authored locally in Discovery and classified/pinned.

Use canonical Skin V1 semantic tokens.

Do not rely on color alone.

Every NEW LOCAL card must include an explicit text/status indicator in addition to its color/treatment.

The exact hue should follow the current Skin V1 / Color Expert authority rather than introducing an isolated hard-coded palette.

The purpose is that a Human opening Afterglow can immediately see:

- the existing story shape;
- the new material they are adding;
- where PlotPickle has classified that new material.

---

## Relationship to Story Cards / Outline

Discovery and #2166 Story Cards must remain distinct.

### Discovery

Question:

> What ideas/material exist, and where do they appear to belong in the emerging story?

Resolution:

- Act + semantic lane;
- free-form;
- system-classified pins;
- non-canon Discovery projection;
- no requirement to choose a Block.

### Story Cards / Outline

Question:

> How is the story formally organized in PlotPickle's structural coordinate system?

Resolution:

- 4 Acts;
- 12 Sequences;
- 24 Blocks;
- 96 Mini-Blocks;
- stable canonical planning addresses.

Do not create a second 24/96 grid in Discovery.

Do not move the #2166 board out of Outline merely to build this feature.

Discovery should be architecturally capable of feeding a later Human-authorized promotion into Story Cards / Story Bible / Write / visual development, but **automatic promotion is not part of Pin**.

Pinning alone never changes canon.

---

## Relationship to Write / Edit / Feedback / Refine / Analytics

Discovery is upstream of those Production-writing surfaces but should understand the same creative object vocabulary.

A Discovery card may contain or reference:

- scene material;
- action material;
- dialogue material;
- feedback/revision observation;
- visual/reference material.

V1 should use shared object/reference contracts where they already exist.

Do not fork Scene, Action, Dialogue, Feedback or visual asset schemas just to make a Discovery card.

Direct "Send to Discovery" buttons from every downstream surface are optional only if they fall naturally out of an existing shared action. Do not expand this issue into a rewrite of Write/Edit/Feedback/Refine/Analytics.

The essential v1 requirement is that Discovery can represent these kinds of material and preserve source references.

---

## Active-project rule

For the first implementation, persistent project-backed Discovery requires an active Library project.

If no project is active:

- Discovery may open its shell;
- do not manufacture a hidden Untitled PPF;
- do not silently create a Library project;
- clearly direct the Human to load/create a story before persistent project pinning.

A future issue may add a pre-Library unsaved idea workspace if desired.

Do not create a second temporary story authority in this issue merely because Discovery is visually ordered before Library on the Dashboard.

---

## Navigation and surface contract

### Dashboard DEVELOPMENT order

Exactly:

1. Community
2. Writer's Craft
3. Discovery
4. Library

Discovery must be connected and keyboard navigable.

### PRE-PRODUCTION order

Exactly:

1. Story Bible
2. Outline
3. Storyboard
4. Previs
5. Timeline
6. Production

The group label remains **PRE-PRODUCTION**.

The `story-bible` item label becomes **Story Bible**.

Do not display:

`Pre-Production → Pre-Production`

again.

### Skin V1

Discovery is a registered Skin V1 surface and must consume:

- Dashboard-derived shell authority;
- current typography;
- current geometry/frame contracts;
- current status semantics;
- Surface Registry / Orchestrator;
- current keyboard/focus conventions.

Do not introduce a new visual system for sticky notes.

The note/card metaphor should be expressed using Skin V1 components/tokens.

---

## Suggested data boundary

Create one small typed Discovery domain rather than hiding state in React components.

Representative shape only:

```ts
type DiscoveryLane =
  | "story-plot"
  | "character"
  | "scene-dialogue"
  | "world-research"
  | "theme-motif"
  | "visual-mood";

type DiscoverySourceState = "project" | "new-local";

type DiscoveryPin = {
  id: string;
  projectId: string;
  sourceKind: string;
  sourceRef?: string;
  sourceState: DiscoverySourceState;
  originalContentRef: string;
  act: 1 | 2 | 3 | 4;
  lane: DiscoveryLane;
  classificationReason: string;
  classifierId: string;
  classifierVersion: string;
  pinnedAt: string;
};
```

Do not treat this sample as a requirement to duplicate full card content when an existing source reference can be retained.

The real schema should use existing PlotPickle identity/provenance conventions.

Pinned Discovery metadata is not canonical screenplay/story truth.

---

## Privacy / provider boundary

Discovery classification may contain unpublished story material.

Therefore:

- provider choice remains governed by existing Story Mode / AI runtime configuration;
- no skill hard-codes OpenAI, Ollama, LM Studio or another model/provider;
- local-compatible operation remains supported;
- only bounded project context needed for classification is supplied;
- credentials never enter the card/skill prompt/store;
- model/agent output is validated against the typed placement contract;
- no hidden reasoning is persisted;
- store concise placement reason/evidence, not chain-of-thought.

If the configured runtime cannot safely classify, Pin fails visibly and the card remains unpinned.

---

## Implementation sequence

### Phase 0 — Evidence and ownership confirmation

Before editing:

1. confirm the current Dashboard/menu registry and #2285 five-stage flow;
2. confirm #2251/#2266 Story Bible projection/route ownership;
3. confirm #2166 Story Cards ownership;
4. confirm existing Visual Reference / project Mood Board ownership;
5. confirm current Agent Skill registry / Mastra role boundary;
6. confirm existing Story Structure / Character specialist procedures that can be reused;
7. identify the smallest persistent Discovery metadata owner that does not create another story store.

Record any compatibility bridge explicitly if one is required.

### Phase 1 — Navigation correction

- add Discovery to DEVELOPMENT between Writer's Craft and Library;
- relabel the `story-bible` Dashboard item to Story Bible;
- preserve #2285 Outline → Storyboard → Previs → Timeline → Production behavior;
- add the Story Bible row ahead of Outline without changing the five-stage internal stage rail owned by #2285 unless evidence shows the rail itself should deliberately include the Bible.

Important: Story Bible is the first item in the PRE-PRODUCTION Dashboard group, but #2285's production-stage rail remains its five-stage production progression unless a separate explicit UX decision changes it.

### Phase 2 — Discovery domain + projection

- define typed card/pin/lane/source-state contracts;
- project eligible existing project evidence into stable PROJECT pins;
- derive Act deterministically wherever canonical address evidence exists;
- preserve source/provenance references;
- no new 24/96 authority.

### Phase 3 — Discovery surface

- implement Inbox/Composer;
- implement Living Discovery Board;
- four Act columns;
- six horizontal lanes;
- PROJECT vs NEW LOCAL visual/status treatment;
- read-only pinned cards;
- keyboard/focus accessibility;
- no drag/reposition controls.

### Phase 4 — Discovery Mapper skill

- add/register the bounded skill;
- connect through existing Agent/Mastra runtime;
- typed response validator;
- bounded context;
- deterministic-address short-circuit before model work;
- visible failure path;
- no canon mutation.

### Phase 5 — Pin flow

- create local card;
- select Pin;
- classify;
- validate;
- persist Discovery placement metadata;
- render NEW LOCAL pin at the resulting Act/lane intersection;
- card placement is immutable in v1.

### Phase 6 — Afterglow acceptance

Load Afterglow and prove:

- Discovery board is not empty;
- existing project material appears as stable PROJECT pins;
- pin locations derived from known structure remain stable across reopen/reload;
- Human can create a new written card and Pin it;
- Human can create/reference a visual card and Pin it;
- both new cards become NEW LOCAL pins;
- agent decides their placement;
- no manual movement control exists;
- Story Bible/Outline/source material remains unchanged merely because a pin exists.

### Phase 7 — Governance / WebMCP

- register Discovery in the canonical surface/navigation system;
- update WebMCP governed navigation/capture evidence deliberately;
- verify Dashboard DEVELOPMENT and PRE-PRODUCTION order;
- visually verify board scanability at normal desktop resolution;
- ensure NEW LOCAL state is understandable without color alone.

---

## Focused tests

Add focused coverage proving at minimum:

1. Dashboard DEVELOPMENT order is Community → Writer's Craft → Discovery → Library.
2. PRE-PRODUCTION order is Story Bible → Outline → Storyboard → Previs → Timeline → Production.
3. No visible duplicate Pre-Production / Pre-Production label remains.
4. Discovery is a registered connected Skin V1 surface.
5. Discovery requires an active project for persistent project-backed pinning and does not manufacture one.
6. Four Act columns exist.
7. The governed v1 lane set exists once.
8. Existing canonically addressed material derives Act deterministically without model classification.
9. An unplaced new local card routes through the Discovery Mapper.
10. Classifier output is schema-validated.
11. Invalid/unavailable classification leaves the card unpinned.
12. Pinning stores placement metadata/provenance but does not mutate Story Bible, screenplay or 24/96 structure.
13. Pinned cards expose no manual Act/lane edit or drag path.
14. PROJECT and NEW LOCAL states are distinct in semantics and visible text, not color alone.
15. Existing visual assets are referenced, not duplicated into a second binary store.
16. Afterglow projects stable existing pins across reload.
17. A new local Afterglow card receives a new pinned placement without moving existing pins.
18. No hidden model reasoning is persisted.
19. Provider selection remains outside the skill.
20. Existing #2166 Story Card/Outline behavior remains green.

---

## Non-goals

This issue does **not**:

- replace Library;
- create an unsaved pre-Library story database;
- move the #2166 Story Card board out of Outline;
- create another 24/96 grid;
- allow manual pin repositioning in v1;
- automatically rewrite Story Bible/canon;
- automatically promote Discovery cards into Story Cards/Write/Storyboard;
- create a new screenplay/Scene/Dialogue/Visual asset authority;
- create a new AI runtime;
- hard-code one model/provider;
- score whether a story is creatively good;
- force curriculum checkpoints as mandatory story beats;
- classify every screenplay line into a card;
- re-run semantic classification for stable existing pins on every render;
- redesign Write/Edit/Feedback/Refine/Analytics;
- redesign the #2285 five-stage pre-production stages.

---

## Relationship to existing work

Reuse and preserve:

- #51 — Characters in Motion / Act 1–4 flexible character questions;
- #2165 — Writer-to-Screen convergence;
- #2166 — Story Cards Foundation Board;
- #2167 — Learn / Write / Outline shared conceptual coordinates;
- #2168 — Afterglow 24/96 evidence mapping;
- #2178 — Character Truth + Arc Map;
- #2035 — Creative Transaction / proposal authority principles;
- #2251 — visual Story Bible projection;
- #2266 — current PRE-PRODUCTION Story Bible placement/UAT correction;
- #2285 — Outline → Storyboard → Previs → Timeline → Production flow;
- current Visual Reference Library / project Mood Board;
- current Agent Skill registry / Mastra runtime;
- current resident Story Structure / Character specialist knowledge.

This issue owns the **new Discovery orchestration layer and classification pinboard only**.

---

## Acceptance criteria

- [ ] Dashboard DEVELOPMENT reads Community → Writer's Craft → Discovery → Library.
- [ ] Dashboard PRE-PRODUCTION reads Story Bible → Outline → Storyboard → Previs → Timeline → Production.
- [ ] Story Bible no longer displays as a duplicate Pre-Production submenu label.
- [ ] Discovery is a real connected Skin V1 destination.
- [ ] Discovery exposes an Inbox/Composer plus Living Discovery Board.
- [ ] Board uses four vertical Act columns.
- [ ] Board uses governed horizontal semantic lanes.
- [ ] Written and visual Discovery cards are supported.
- [ ] Existing addressed project material becomes stable PROJECT pins without unnecessary model calls.
- [ ] New unplaced Human-authored material is classified by the Discovery Mapper Agent/Skill when Pin is selected.
- [ ] Classifier selects Act + lane through a typed validated contract.
- [ ] A failed classifier never fabricates placement.
- [ ] Pinned placement is read-only and cannot be manually dragged/reassigned in v1.
- [ ] New Human-authored pins display a clear NEW LOCAL state using text plus Skin V1 semantic treatment.
- [ ] Afterglow opens with meaningful existing material already represented on the board.
- [ ] Adding a new Afterglow card shows how the local story shape changes without mutating existing canon.
- [ ] Pinning never changes Story Bible, screenplay, Story Cards or 24/96 canon automatically.
- [ ] Discovery does not duplicate assets or story authorities.
- [ ] Curriculum guidance remains flexible/non-prescriptive.
- [ ] Provider/runtime remains configurable and skill/model independent.
- [ ] Focused regressions and production build pass.
- [ ] Development convergence reports CONVERGED for the declared issue scope.
- [ ] Exact-head Architecture Verification, BEN, CodeQL and required CI are green before merge.
- [ ] WebMCP after merge confirms navigation order, Discovery board usability and NEW LOCAL visual semantics.

---

## Build rule for the next step

When implementation is explicitly authorized:

`assess current main → branch/worktree → build the smallest safe slices above → focused tests → production build → convergence → PR → exact-head gates → fix until green → merge only when green → WebMCP on merged main`

For this issue-creation step, stop after the Developer Brief is recorded in the issue log.
\n