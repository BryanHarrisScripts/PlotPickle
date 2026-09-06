# PlotPickle UI/UX Foundation — STORY: The Unwritten Integration

Status: Proposed companion foundation contract  
Related issues: #1675, #1713, #1715  
Governing documents: `docs/UI-UX-DESIGN-STANDARD.md` and `docs/story-the-unwritten.md`

## 1. Purpose

STORY: The Unwritten is not a late feature to bolt onto the UI after the reset. It is an existing PlotPickle architectural consumer and must be supported by the new UI/UX foundation from the beginning.

This document defines how the human-centered UI standard and the STORY architecture fit together without creating a second shell, a parallel design system, a duplicate agent runtime, or a competing authority model.

The central rule is:

> PlotPickle remains the operating system. STORY remains the reusable playable-story engine. The new UI foundation must make STORY feel native to PlotPickle while preserving STORY's deterministic state, agent, canon, scale and authority boundaries.

## 2. Product relationship

The UI foundation must preserve this product relationship:

```text
PlotPickle shell / project context
  |
  +-- Learn ---------------------- teaches story concepts
  |
  +-- Plan / Build --------------- creates story material and Story Pieces
  |
  +-- STORY: The Unwritten ------- plays / resolves story state
  |      |
  |      +-- Five-Scene Story
  |      +-- Wyrmwood-backed teaching experiences
  |      +-- first-party worlds
  |      +-- user-created worlds and games
  |
  +-- Storyboard / Previs -------- projects accepted state visually
  |
  +-- Write / Edit / Refine ------ projects accepted state into authored output
  |
  +-- BUZZ ----------------------- discovery, presence, community, invitations
  |      |
  |      +-- discover STORY worlds
  |      +-- launch/join STORY sessions
  |
  +-- Agents / Skills ------------ shared governed execution system
  |
  +-- PPF / project canon -------- durable accepted project authority
```

STORY does not replace PlotPickle's writer workflows. It connects them.

## 3. STORY is foundational, not another equal-weight navigation item

STORY may have a first-class route/workspace identity, but the UI reset must not solve this by adding a fifteenth equal-weight navigation choice.

STORY should appear contextually when the user's current task requires play, simulation, consequence, world interaction or game creation.

Examples:

- Learn may launch a short STORY exercise.
- Build may create or edit Story Pieces and then offer `Play this setup`.
- A project may offer `Continue STORY session` from its current-state summary.
- Wyrmwood may enter a themed STORY-powered experience without exposing generic engine terminology.
- BUZZ may offer `Play` or `Join session` from a world/community context.
- STORY may hand accepted consequences back to the project's normal downstream creative workflow.

The user should not need to understand whether a capability belongs internally to STORY, Wyrmwood, PPF, the Context Engine or the Agent runtime.

## 4. Human mental model

The UI should communicate STORY in ordinary story language.

The primary mental model is:

```text
Learn -> Create -> Play -> See what changed -> Continue
```

Advanced creator mental model:

```text
Create world -> Create pieces -> Define bounded rules -> Validate -> Playtest -> Refine -> Share
```

Do not expose engine vocabulary before the user needs it.

Default user-facing language should favor:

- Character
- Location
- Object
- Conflict
- Secret
- Relationship
- Goal
- Scene
- Choice
- Consequence
- Rule
- World
- Story Piece when the abstraction is useful

Technical terms such as resolution queue, hydration tier, provenance, agent runtime instance, schema version or canon admission belong behind progressive disclosure.

## 5. Progressive disclosure inside STORY

The UI standard's four disclosure levels apply directly to STORY.

### Level 1 — Player

Show only what is needed to understand and act in the current scene:

- current world/session;
- current scene and objective;
- active characters;
- relevant location;
- relevant Story Pieces/actions;
- one primary action or choice boundary;
- visible consequences from the previous accepted action;
- clear next step.

### Level 2 — Context and mechanics

Reveal on request:

- relationships;
- unresolved threads;
- relevant rules;
- costs and consequences;
- scene history;
- why an action is or is not legal;
- agent suggestion detail.

### Level 3 — Creator

Reveal for users building or tuning a playable world:

- Story Piece editing;
- rule composition;
- Game Validator findings;
- agent narrative controls;
- world constraints;
- starting conditions;
- end conditions;
- visibility/knowledge rules.

### Level 4 — Technical / administrative

Keep behind advanced settings or diagnostics:

- provider/model details;
- schema/compatibility metadata;
- resolution diagnostics;
- raw event queues;
- hydration/activation diagnostics;
- developer traces;
- migration/repair tools.

A normal player should be able to complete a STORY session without entering Levels 3 or 4.

## 6. Scene-first workspace contract

STORY treats the scene as the primary unit of meaningful play. The UI should therefore make the active scene the dominant work surface.

Recommended anatomy:

1. Shared PlotPickle shell
   - active project/world;
   - grouped navigation;
   - session continuity;
   - utilities.

2. STORY workspace header
   - world/session name;
   - scene number/status;
   - concise objective or current pressure;
   - one primary action when applicable.

3. Main scene surface
   - current situation;
   - active characters;
   - relevant Story Pieces/actions;
   - accepted state that matters now.

4. Contextual inspector
   - mechanics;
   - relationships;
   - rules;
   - hidden/advanced details where authorized;
   - agent explanation.

5. Consequence/status layer
   - what changed;
   - whether the action was accepted;
   - what remains unresolved;
   - what can happen next.

The interface should never degrade into a generic chat transcript with hidden game state.

## 7. State is authoritative; prose and visuals are projections

The UI must preserve one of STORY's central architectural invariants:

> Accepted state is truth. Dialogue, prose, images, cards, storyboards and cinematic outputs are projections of that state.

Therefore:

- generated prose must not silently become accepted state;
- agent suggestions must be visually distinct from accepted state;
- proposed world facts must remain proposed until admitted;
- consequences must identify what actually changed;
- save/resume must restore deterministic session state, not merely a chat history;
- Storyboard, Previs, Write and other output surfaces should consume accepted state rather than re-inventing canon independently.

## 8. Deterministic authority versus AI creativity in the UI

The user must be able to tell the difference between:

- what an AI proposed;
- what STORY allowed;
- what the user chose;
- what became authoritative session state;
- what was later admitted into durable project canon.

Use consistent visual/status language for these boundaries.

Recommended semantic states:

- Suggested
- Pending choice
- Validating
- Accepted
- Rejected / illegal
- Consequence applied
- Canon proposal
- Canon accepted

Do not rely on colour alone.

The UI must never imply that an agent has final mechanical authority when deterministic STORY code owns the transition.

## 9. Story Piece presentation

A Story Piece is a semantic object, not necessarily a card.

The UI may present a Story Piece as:

- card;
- compact row;
- character portrait;
- token;
- relationship edge;
- timeline event;
- location marker;
- rule panel;
- inspector item.

Choose the representation that best supports the current task.

Do not force every Story Piece into card walls merely because cards are visually attractive.

All Story Piece representations must reuse PlotPickle tokens, action hierarchy, target sizing, accessibility and five-state contracts.

## 10. Player, Creator and Game Designer modes

STORY has three increasing levels of authorship. The UI must keep these distinct to avoid overwhelming beginners.

### Player

Goal: make meaningful choices and understand consequences.

Default experience:

- minimal controls;
- current scene first;
- mechanics available but not dominant;
- no raw rule authoring;
- no provider configuration;
- no architecture terminology.

### Creator

Goal: create worlds, characters, pieces and playable situations.

Expose:

- Story Piece creation/editing;
- narrative agent controls;
- world setup;
- rules through constrained composition;
- deterministic validator findings;
- preview/playtest.

### Game Designer

Goal: define reusable playable systems.

Expose advanced validated mechanics progressively:

- rule triggers;
- costs;
- consequences;
- end conditions;
- game modes;
- complexity warnings;
- compatibility/version information where required.

Do not expose Game Designer complexity merely because a Player entered STORY.

## 11. Game Validator UX

The deterministic Game Validator is a core creator safety and usability system.

Use the severity model:

- ERROR — cannot launch/publish normally until resolved;
- WARNING — playable but potentially problematic;
- NOTE — useful observation;
- PASS — validated condition.

Rules:

- show findings in plain story language first;
- technical detail belongs behind disclosure;
- each ERROR/WARNING should provide a local recovery path when possible;
- AI may explain or suggest repairs, but must not hide deterministic findings;
- never silently mutate creator rules to make validation pass;
- validation should preserve the user's draft and current selection.

## 12. STORY agent UX

STORY reuses PlotPickle's existing governed agent architecture.

The UI should let users configure character agents in narrative terms:

- name;
- role;
- wants;
- fears;
- knowledge;
- unknowns;
- relationships;
- refusals;
- voice;
- world abilities;
- autonomy level.

Do not lead with prompts, tools, connectors, model IDs or orchestration settings.

Agent authority must be visible when it affects gameplay:

- Observer
- Actor
- Director
- Referee
- World Keeper

These labels describe STORY behavior only. They do not grant host permissions.

## 13. Sparse-world UX and working-set discipline

STORY is designed so large worlds do not require every character or relationship to be loaded.

The UI must follow the same rule:

> Stored is not loaded. Loaded is not active. Active is not running inference.

Therefore:

- show the scene-relevant working set by default;
- search/filter into larger world collections rather than rendering everything;
- do not mount thousands of hidden character components;
- do not imply dormant characters are active agents;
- hydrate details only when needed;
- preserve clear loading/partial/error states for deferred data;
- allow large worlds to feel navigable without exposing their full scale at once.

## 14. STORY resilience and interruption

STORY must obey the main UI/UX operational contract.

Required:

- deterministic save/checkpoint feedback;
- recoverable resume after interruption;
- no double-application of an accepted action after Retry;
- visible pending state during consequential resolution;
- contextual Retry after recoverable provider/network failure;
- player choices preserved if an agent/provider operation fails;
- stale/offline state distinguished from confirmed state;
- long operations cancellable only when cancellation is mechanically safe;
- restored sessions clearly identify where play resumes.

## 15. Five-state coverage for STORY surfaces

All data-driven STORY surfaces support applicable states.

### Ideal

Active session/world/pieces available and current action obvious.

### Empty

No world/session/piece yet; explain what belongs there and offer one useful first action.

### Loading

Preserve scene layout and show meaningful loading/progress rather than a blank game table.

### Partial

A sparse world, one-character scene or partially configured creator game remains usable.

### Error

Explain what failed, preserve deterministic state, show whether accepted actions are safe, and provide local recovery.

Additional STORY-specific operational states such as validating, resolving, offline, stale, resumed and canon-pending must compose with these five base states rather than replace them.

## 16. Navigation relationships

The new grouped shell should support these relationships without creating duplicated navigation:

### Learn -> STORY

- `Try this` or equivalent contextual launch;
- return path back to lesson/reflection;
- no separate setup ceremony for a small teaching exercise.

### Plan / Build -> STORY

- create Story Pieces and world material;
- `Play this setup` / `Test in STORY` contextual action;
- preserve project/object selection on handoff.

### STORY -> Storyboard / Previs / Write

- allow accepted scene/session state to become creative source material;
- distinguish projection/export from canonical mutation;
- preserve provenance.

### Wyrmwood -> STORY

- Wyrmwood remains a themed first-party product;
- use shared STORY mechanics only where proven;
- do not force Wyrmwood into a generic STORY skin.

### BUZZ -> STORY

- BUZZ discovers, invites and launches;
- STORY owns authoritative active game state;
- direct local STORY launch remains available;
- BUZZ is not required to play.

## 17. Initial P0 UI implementation order

The P0 UI reset should account for STORY before broad screen-by-screen redesign.

Recommended order:

1. Shared shell, token enforcement, accessibility and state primitives.
2. Shared project/world/session context model.
3. Shared action, notification, inspector, dialog, list/card/table and draft/resume primitives.
4. Grouped navigation that has a natural contextual home for STORY without adding another equal-weight slot.
5. STORY scene/workspace primitives:
   - scene header;
   - current objective/pressure;
   - Story Piece/action collection;
   - consequence summary;
   - active-character presentation;
   - mechanics inspector;
   - validator finding;
   - session status/resume.
6. Core writer-flow migration with STORY handoff points preserved.
7. Wyrmwood and BUZZ integration through adapters/launch surfaces.
8. Packaged UAT across writer and STORY paths.

## 18. Shared component implications

The foundation should prefer reusable primitives that serve both writer workflows and STORY:

- Project/World Context Bar
- Workspace Header
- Primary/Secondary/Tertiary/Destructive actions
- Inspector
- List / Table / Card / Item Row
- Status / Progress
- Toast / Banner / Dialog
- Empty / Skeleton / Error state
- Draft/Resume indicator
- Agent suggestion block
- Accepted-state marker
- Change/Consequence summary
- Rule/Validator finding
- Search/filter/grouping

STORY-specific components should be created only where STORY has a genuinely distinct interaction need.

## 19. Accessibility and cognitive ergonomics

STORY must not become visually dense merely because game state is deep.

Required:

- one clear current scene/task;
- one primary action per decision boundary;
- progressive disclosure of mechanics;
- 44 x 44 normal hit targets;
- keyboard-complete scene interaction;
- visible focus and logical order;
- screen-reader names for Story Piece actions and icon controls;
- no hidden-information leakage through accessible names, DOM text or tooltips;
- 200% zoom support;
- reduced-motion support;
- no colour-only representation of legal/illegal, hidden/known or accepted/proposed state;
- long world/character/story names must not break the scene surface.

## 20. Verification contract

STORY UI work must use the same P0 enforcement stack as the rest of PlotPickle.

At minimum verify:

- token compliance;
- axe-core structural accessibility when integrated;
- keyboard-only player journey;
- one-primary-action hierarchy;
- five base states;
- validation findings and recovery;
- accepted/proposed state distinction;
- duplicate-submit/idempotency behavior;
- session save/resume;
- long-content and 200% zoom;
- reduced motion;
- notification limits;
- layout-shift guardrails;
- direct local STORY launch;
- BUZZ launch does not transfer authority;
- Wyrmwood regression remains green;
- packaged Windows path when the STORY workspace is in the release surface.

## 21. Non-goals

This UI integration must not:

- rewrite the deterministic STORY engine;
- create a second game-agent runtime;
- create a second canon store;
- turn BUZZ into the game interface;
- force Wyrmwood into a generic visual skin;
- make every Story Piece a card;
- expose all world state at once;
- hydrate all world characters for navigation convenience;
- add arbitrary executable creator rules;
- expose technical provider configuration to ordinary players;
- fork a separate STORY design system.

## 22. Definition of success

STORY is successfully integrated into the UI foundation when a new user can move naturally from learning or creating into playing, understand the current scene, make one meaningful choice, see exactly what changed, resume after interruption, and continue into normal PlotPickle creation without learning the internal architecture.

A creator can progressively reveal deeper world/rule/agent controls without imposing those controls on a normal player.

The same shared shell, tokens, accessibility, state, notification, resilience and verification systems govern STORY, Wyrmwood, BUZZ and the writer workflows.

PlotPickle should feel like one product with several modes of working, not a collection of separate applications connected by navigation links.
