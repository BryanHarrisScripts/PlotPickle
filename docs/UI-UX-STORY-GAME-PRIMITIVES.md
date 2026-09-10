# PlotPickle UI/UX Foundation — STORY Game Primitives

Status: Proposed Phase 1 foundation contract  
Related issues: #1675, #1713, #1715  
Companion documents: `docs/UI-UX-DESIGN-STANDARD.md`, `docs/UI-UX-STORY-FOUNDATION.md`, `docs/story-the-unwritten.md`

## 1. Purpose

STORY: The Unwritten is PlotPickle's native narrative game engine. Its useful inspiration from systems such as collectible/strategy card games is structural rather than derivative: a small vocabulary of understandable pieces, a visible play surface, deterministic ordered resolution, deep combinations, and a rules system that remains understandable while supporting large amounts of state.

PlotPickle must not copy the rules, terminology, economy, card identities, or protected expression of any existing trading-card game. The reusable design lesson is composability, visible state, bounded rules, and deterministic resolution.

The Phase 1 UI foundation must therefore treat STORY game primitives as native reusable presentation primitives rather than waiting to build a separate game application later.

## 2. Foundation mapping

| Strategy-game concept | PlotPickle / STORY primitive | UI responsibility | Authority boundary |
| --- | --- | --- | --- |
| Card | Story Piece presentation | Render Character, Location, Object, Conflict, Secret, Story Technique and future supported piece types as cards, rows, tokens, portraits, markers or inspector items according to task | Presentation only; representation does not grant authority |
| Deck / collection | Story Piece collection, session loadout, world collection or creator-defined allowed set | Search, filter, group, inspect, select and compose bounded sets without rendering an entire world | A collection is not canon; PPF remains durable canon authority |
| Battlefield / board | Active scene surface and contextual play zones | Show only the current scene, active/relevant pieces, characters, objectives, pressure, unresolved threads and actionable choices | STORY session state remains authoritative |
| Stack / resolution chain | Deterministic STORY event/resolution queue | Show pending/validating/resolving/accepted/rejected consequences in an understandable sequence when useful | Deterministic code owns ordering; AI never chooses mechanical priority |
| Rules text | Validated STORY rule operations | Show plain-language mechanics first, technical rule grammar behind disclosure | Rules are constrained validated compositions, never arbitrary creator code |
| Turn / phase | Scene lifecycle and action boundary | Make current scene/status and the next legal decision obvious | STORY state machine owns legal transitions |
| Permanent state | Accepted STORY session state | Clearly distinguish accepted state from proposals and projections | PPF canon admission remains a separate explicit durable-authority step |
| Player / opponent | Human and bounded Story Agent participants | Present identity, current authority within the game, legal choices and visible consequences | PlotPickle Agent Contract/trust boundaries remain authoritative |

## 3. Story Pieces become first-class shared UI primitives

Phase 1 must establish reusable Story Piece presentation primitives in the same component/state system as the rest of PlotPickle.

A Story Piece is semantic data. It may be represented as:

- a full visual card when comparison, selection or play benefits from card affordance;
- a compact row in lists and inspectors;
- a portrait for active characters;
- a token or marker in a scene/world surface;
- a relationship edge;
- a location marker;
- a timeline event;
- a rule/mechanic panel.

Every representation uses the same `--pp-*` tokens, target sizes, focus behavior, accessibility contract, five-state model, overflow rules and reduced-motion behavior as other PlotPickle components.

Do not create a separate STORY card theme or hardcoded card palette.

## 4. Collections are not canon

A strategy-game deck analogy is useful only at the collection/composition level.

In PlotPickle:

- a user may have a collection of Story Pieces;
- a world may expose an allowed collection;
- a session may use a selected loadout/working set;
- Build may create and organize these pieces;
- BUZZ may later index/discover shareable world/game metadata;
- STORY may activate a bounded subset for play.

None of these collections are themselves the canonical truth store.

PPF remains durable project/canon authority. STORY session state may propose or produce outcomes that later enter canon only through the approved admission boundary.

The UI must never label a temporary collection, session loadout or generated set as canon merely because it is playable.

## 5. The contextual board is part of the PlotPickle shell

The active STORY scene is the equivalent of a game board, but it must remain inside the shared PlotPickle shell.

Phase 1 must support reusable board/play-surface primitives that can be consumed by STORY, Build, Learn exercises and Wyrmwood without creating isolated mini-app navigation.

A STORY scene surface should be able to expose:

- current world/session;
- scene number/status;
- current objective or pressure;
- active characters;
- active/relevant location;
- relevant Story Pieces;
- available legal actions/choices;
- unresolved threads/conflicts;
- pending resolution state;
- accepted consequence summary;
- next action.

Advanced mechanics remain in an inspector or disclosure surface rather than filling the main board.

## 6. Resolution queue: the STORY equivalent of a stack

Issue #1675 already defines an ordered deterministic resolution queue with stable ordering, bounded trigger depth, cycle protection, idempotency protection, atomic transitions, checkpoints and replay.

The UI foundation must expose a reusable resolution-state presentation without turning the deterministic engine into a chat log.

Useful user-facing states include:

1. Choice made
2. Validating
3. Resolving
4. Additional consequence/trigger pending
5. Accepted
6. Rejected / illegal
7. Consequence applied
8. Checkpoint saved

Rules:

- AI may propose dialogue, framing, choices or candidate actions.
- An AI proposal is not automatically placed into authoritative state.
- Deterministic STORY code validates and orders mechanical transitions.
- The UI may summarize a resolution chain, but must preserve the ability to inspect why a consequential action resolved as it did.
- Retry must not double-apply an already accepted event.
- A long chain must be summarized/collapsed rather than growing an unbounded transcript.

## 7. Agent continuity is native, not a parallel game-agent system

STORY character agents use PlotPickle's existing agent/trust/runtime architecture.

The shared UI foundation must support:

- agent identity carried consistently across Build, STORY, Wyrmwood and BUZZ contexts;
- narrative configuration rather than model/prompt-first controls;
- visible STORY-local authority such as Observer, Actor, Director, Referee or World Keeper;
- clear distinction between an agent suggestion and accepted STORY state;
- continuity of allowed memories/knowledge without leaking hidden state;
- activation/deactivation without implying every stored character is a live running agent.

A Story Piece or world package can bind data to an approved agent execution template. It cannot grant connectors, credentials, source mutation, provider authority, PPF direct-write authority or skill-install authority.

## 8. Cross-module native consumption

The same Story Piece and scene primitives must be reusable across modules.

### Learn

- present a small Story Piece or scene exercise;
- launch directly into a bounded STORY interaction;
- return to lesson/reflection without setup ceremony.

### Plan / Build

- create/edit Story Pieces and collections;
- preview them using the real shared presentation primitives;
- `Play this setup` / `Test in STORY` without converting into duplicate data.

### STORY

- play/resolve using the same pieces;
- display deterministic state and consequences;
- preserve session checkpoints and provenance.

### Wyrmwood

- consume shared primitives where genuinely useful;
- retain its themed teaching identity;
- do not force generic STORY visual styling.

### BUZZ

- index/discover world/game metadata and safe previews;
- launch/join sessions later;
- never own authoritative STORY game state.

### Storyboard / Previs / Write

- project accepted STORY state into downstream creative outputs;
- do not silently mutate state while rendering or writing from it.

## 9. State gallery requirements

The isolated development state gallery established by Phase 1 must include STORY primitives as normal library elements.

At minimum provide deterministic fixtures for:

- Story Piece card: ideal, selected, unavailable/illegal, loading, partial, error;
- compact Story Piece row;
- active character with/without bound agent;
- scene header and objective/pressure state;
- board/play zone with sparse and dense relevant sets;
- legal action / choice control;
- pending validation;
- multi-step resolution chain;
- accepted consequence;
- rejected/illegal action;
- validator ERROR/WARNING/NOTE/PASS;
- offline/stale provider-dependent presentation;
- restored/resumed session;
- canon proposal vs canon accepted;
- long/localized titles and unbroken identifiers;
- 200% zoom;
- reduced-motion behavior;
- multiple notifications with queue/coalescing.

These fixtures should reuse real production components and tokens. They are not mock-only artwork.

## 10. Layout and CLS guardrails for play surfaces

Dynamic STORY state must not cause uncontrolled page movement.

Phase 1/2 verification should cover:

- Story Piece draw/add/remove;
- legality/validation status appearing;
- consequence summaries expanding;
- banner insertion;
- agent result/proposal arrival;
- long-title replacement;
- scene transition;
- notification activity.

Use CLS <= 0.1 as the reference ceiling for unexpected non-user-initiated shift where the metric is meaningful.

Intentional user-driven layout changes may move content. Unexpected streaming or state updates should reserve space, overlay appropriately, animate safely or update bounded regions without violently reflowing the entire workspace.

## 11. Accessibility contract for game interaction

STORY play must be complete without a mouse.

Required:

- keyboard navigation through relevant Story Pieces/actions;
- logical focus order and visible focus;
- accessible names that communicate piece/action identity;
- no hidden/private knowledge in offscreen DOM, ARIA labels, titles or tooltips;
- legal/illegal/selected/pending states not communicated by color alone;
- screen-reader understandable action result and consequence updates;
- focus return after inspector/dialog closure;
- no focus trap leakage in modal/alert-dialog flows;
- 44 x 44 normal action targets;
- 200% zoom support;
- reduced motion;
- `@axe-core/playwright` or equivalent structural assertions in representative journeys.

Automated axe checks are additive to keyboard, focus, hidden-information and human usability tests.

## 12. Scale contract: large worlds and high event counts without UI fragmentation

The UI foundation must be scale-independent even though the first playable proof is intentionally small.

The governing STORY rule remains:

> Stored is not loaded. Loaded is not active. Active is not running inference.

For UI scale this means:

- never render every world character merely because the world contains them;
- keep the active scene working set bounded;
- virtualize or window genuinely large collections where useful;
- paginate or incrementally load long event/session histories;
- collapse/summarize resolution chains and repeated event groups;
- subscribe/apply incremental state updates rather than replacing whole-world payloads;
- avoid component-local copies of authoritative world state;
- keep selection/focus stable when incremental updates arrive;
- use stable IDs/keys so updates do not remount unaffected pieces;
- separate live current-scene state from historical/archive browsing;
- treat presence/discovery scale in BUZZ separately from authoritative STORY resolution.

The UI contracts should remain viable for very large numbers of stored events, characters, worlds and participants.

However, Phase 1 does **not** claim that PlotPickle already supports 100,000 concurrent players in one authoritative real-time session. That is a later distributed synchronization/backend capacity question and must be proven separately. The Phase 1 responsibility is to avoid UI assumptions that would make such scale impossible or require another presentation rewrite.

Where future workloads involve 100,000+ user/event records, the UI should consume bounded, incremental, indexed projections rather than materializing all records at once.

## 13. Token enforcement applied to STORY primitives

STORY components are subject to the same deterministic token gate as every other PlotPickle UI surface.

The changed-file gate must reject unjustified new:

- HEX/RGB/HSL/named product colors;
- arbitrary spacing values;
- screen-specific font sizes/stacks;
- independent border-radius systems;
- independent shadows;
- duplicate semantic status colors.

Documented exceptions remain limited to authored/generated artwork, media, data visualization scales and intentional migration code.

Card art is not an excuse for hardcoded frame/chrome styling.

## 14. Phase 1 required STORY primitives

Before broad screen-by-screen redesign, the UI foundation should establish or explicitly plan these reusable primitives:

1. Story Piece presentation family
2. Story Piece collection/list/search/filter
3. Scene/play surface container
4. Active character presentation
5. Current objective/pressure/status
6. Legal choice/action control
7. Accepted-state marker
8. Agent suggestion/proposal block
9. Resolution/progress chain
10. Consequence/change summary
11. Rules/mechanics inspector
12. Game Validator finding
13. Session checkpoint/resume indicator
14. Canon proposal/admission marker
15. Scalable event/history list

These primitives belong in the same component state gallery and enforcement stack as writer-workflow components.

## 15. Verification additions

Representative Playwright/UAT should eventually prove:

- Build-created Story Piece renders identically when consumed in Build preview and STORY play where the same representation is appropriate;
- Story Piece keyboard selection/action works without a mouse;
- axe-core finds no configured serious/critical structural violations in the representative scene journey;
- validation/resolution updates do not double-submit or double-apply actions;
- consequence insertion does not cause unacceptable unexpected layout shift;
- long/localized piece names remain usable;
- large fixture collections do not mount all items eagerly when virtualization/incremental loading is required;
- long event histories remain navigable without growing the live DOM without bound;
- agent proposal remains visually and semantically distinct from accepted state;
- accepted STORY state remains distinct from PPF canon admission;
- Wyrmwood can consume shared primitives without losing theme or behavior;
- BUZZ can launch/discover without receiving STORY authority.

## 16. Definition of captured STORY foundation

STORY is considered captured in the UI foundation when:

- its Story Pieces are first-class reusable UI primitives;
- its active scene can render as a native PlotPickle contextual board;
- its deterministic resolution queue has an understandable shared presentation model;
- its agent continuity uses the existing PlotPickle agent system;
- its Player -> Creator -> Game Designer depth is progressively disclosed;
- its components participate in token, axe, state-gallery, CLS, zoom, reduced-motion and resilience verification;
- Build, Learn, STORY, Wyrmwood and BUZZ can consume the same relevant primitives without duplicate data or duplicate UI frameworks;
- the UI remains bounded and incremental as world/event scale grows;
- PPF remains canon authority and STORY remains authoritative only for its active session/state boundary;
- no separate mini-app, design system, game-agent runtime or canon store is introduced.
