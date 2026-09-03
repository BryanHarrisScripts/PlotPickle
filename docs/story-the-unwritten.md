# Story: The Unwritten

## PlotPickle Story-Game Engine Architecture

Status: Architecture proposal

Story: The Unwritten is PlotPickle's reusable story-game system: a framework in which people learn how stories work, assemble story elements as playable pieces, create their own worlds and characters, bind bounded AI agents to those creations, and eventually define entirely new AI-driven games that still run under PlotPickle's authority model.

The central idea is simple:

> PlotPickle supplies the grammar, state, rules, memory, agents and safety boundaries. Players supply the worlds, characters, combinations and choices. The story is unwritten until play makes it true.

This is not intended to imitate the rules, terminology, economy or collectible model of any existing trading-card game. The useful design principle is deeper: give players a small vocabulary of understandable pieces, make the combinations extraordinarily deep, and allow the community to discover interactions the original designers did not explicitly author.

---

## 1. Product relationship

PlotPickle remains the overall architecture.

Story: The Unwritten becomes the reusable story-game system.

Wyrmwood remains the structured learning game and first teaching world/campaign.

BUZZ remains the community, discovery, presence and multiplayer social layer.

User-created worlds become additional playable universes built from the same story grammar.

In product terms:

```text
PlotPickle
  |
  +-- LEARN ---------------- teaches story concepts
  |
  +-- PLAN / BUILD ---------- creates story-world material
  |
  +-- BUZZ ----------------- community, discovery, presence, invitations
  |      |
  |      +-- discover worlds and games
  |      +-- meet creators, players and agents
  |      +-- join rooms / communities
  |      +-- invite people or agents
  |      +-- launch into a playable STORY session
  |
  +-- Story: The Unwritten - reusable story-game engine and play surface
  |      |
  |      +-- Wyrmwood ------- teaching campaign / proving ground
  |      +-- First-party worlds
  |      +-- User worlds
  |      +-- User-created games
  |
  +-- Agents ---------------- characters, guides, directors, evaluators
  +-- Skills ---------------- bounded procedures available to agents
  +-- AI Runtime ------------ local/cloud provider-independent inference
```

Wyrmwood should not be discarded. It already proves several of the most important architectural ideas: deterministic game state, AI-directed situations, AI evaluation, curriculum linkage, progression, persistent history and a clear division between generative intelligence and game authority.

The migration principle is:

> Reuse first. Extract shared contracts only when Story: The Unwritten becomes a proven second consumer. Do not rewrite Wyrmwood merely to make the architecture look cleaner.

---

## 2. The foundational object: a Story Piece

A card is the visual and interactive representation of a Story Piece.

The engine must not depend on cardboard-game assumptions. A Story Piece may be displayed as a card, token, board element, character portrait, timeline event, relationship edge or world rule depending on the interface.

The initial Story Piece vocabulary should remain intentionally small:

1. Character
2. Desire
3. Need
4. Location
5. Relationship
6. Object
7. Conflict
8. Secret
9. Event
10. World Rule
11. Story Technique
12. Agent Binding

A beginner should be able to understand these without reading a rulebook.

A Character wants something.
A Relationship connects characters.
A Location constrains what can happen.
An Object has history and position.
A Secret creates uneven knowledge.
A Conflict creates pressure.
An Event changes state.
A World Rule defines what is possible.
A Story Technique represents a learned storytelling move.
An Agent Binding allows a bounded PlotPickle agent to inhabit or operate through a Story Piece.

The power comes from combinations rather than from hundreds of primitive types.

---

## 3. The six Story Schools

Story Pieces may optionally belong to one or more Story Schools. These are not factions or mandatory deck colors. They are a simple mental model for different forces in storytelling and can connect directly to LEARN.

### Character

Desire, need, psychology, relationships, transformation and point of view.

### Plot

Goals, causality, escalation, reversals, setup, payoff and resolution.

### World

Place, history, culture, systems, lore, physical rules and social rules.

### Conflict

Opposition, risk, pressure, dilemmas, consequences and antagonism.

### Theme

Meaning, values, moral questions, symbolism and recurring ideas.

### Style

Voice, genre, tone, visual language, rhythm and presentation.

The schools can become a teaching layer, a construction aid and eventually a balancing tool. A player might discover that a world rich in World + Style has atmosphere but lacks Character pressure; PlotPickle can teach that weakness through play rather than through a lecture.

---

## 4. Core player journey

Story: The Unwritten supports three increasing levels of authorship.

### Player

"I make choices inside a story."

The player uses existing Story Pieces and agents, experiences consequences and learns narrative cause and effect.

### Creator

"I make pieces and a world other people can play inside."

The creator makes characters, locations, objects, conflicts, secrets, rules, visual assets and bounded agents.

### Game Designer

"I define how stories behave in my world."

The designer composes validated rules, costs, triggers, victory conditions, scene constraints and agent roles to create a new playable AI-driven game without replacing PlotPickle's underlying authority boundaries.

This progression is fundamental. PlotPickle is not only teaching people to write a story. It is teaching them how story systems work well enough that they can eventually create their own games.

---

## 5. The primary gameplay loop

The universal loop is:

```text
Learn -> Build -> Play -> Consequence -> Reflect -> Expand
```

### Learn

PlotPickle introduces a storytelling concept through LEARN, Sage, Wyrmwood or contextual coaching.

### Build

The player selects or creates Story Pieces and assembles a playable situation, world or deck-like collection.

### Play

The player makes a choice, plays a piece, speaks for a character, invokes a technique, moves an object, reveals information or changes a relationship.

### Consequence

The deterministic engine validates the move and updates authoritative state. Agents may interpret or dramatize the outcome, but they do not rewrite authoritative state outside permitted engine transitions.

### Reflect

PlotPickle can explain which concepts were used successfully and why the consequence followed.

### Expand

The player earns, discovers or creates additional possibilities: new pieces, new relationships, new agents, new rules or an expanded world.

The player should feel that they are playing first and learning second, even though the system continuously teaches narrative structure underneath.

---

## 6. Scenes are turns; state is the truth

Story: The Unwritten should treat a scene as the primary unit of meaningful play.

A scene has:

- participants;
- location;
- active goals;
- known information;
- relevant objects;
- active conflicts;
- world rules;
- unresolved story threads;
- available Story Pieces;
- narrative budget / pressure;
- beginning state;
- accepted actions;
- resulting state.

The engine should be state-first rather than prose-first.

Prose, dialogue, images, storyboards and cinematic outputs are projections of story state. They are not the source of truth.

This protects continuity and makes the same underlying game playable as text, cards, a storyboard, a graphic novel, an animated scene or eventually a multiplayer experience.

---

## 7. Narrative budget

A scene should have a bounded Narrative Budget so that story actions carry weight.

A low-cost action might ask a question, move nearby, reveal an already-known fact or use an established object normally.

A higher-cost action might introduce a major character, reveal a central secret, permanently alter a relationship, destroy an important location, reverse a major objective or violate an established expectation in a justified way.

This teaches pacing and prevents "everything happens at once" storytelling.

The budget is not intended to mathematically judge artistic quality. It is a rules mechanism for controlling structural magnitude and making consequences legible.

---

## 8. Cause, effect and continuity

The engine must track more than score.

At minimum, authoritative story state should be capable of representing:

- character location and availability;
- goals and current objectives;
- relationship values and history;
- objects and ownership/custody;
- injuries or meaningful conditions;
- secrets and who knows them;
- promises, questions and unresolved threads;
- established world facts;
- active world rules;
- scene history;
- consequences waiting to resolve;
- character emotional or arc state where explicitly modeled;
- provenance for user-authored versus generated facts.

This allows PlotPickle to answer questions such as:

"Can this character know that yet?"

"Where did this object come from?"

"Was this betrayal actually established?"

"What promise has not paid off?"

"Does this action violate the world's magic system?"

"What changed because of the previous scene?"

This continuity model is one of PlotPickle's strongest advantages over a generic chat-based role-playing experience.

---

## 9. Deterministic authority versus AI creativity

This division is non-negotiable.

### The deterministic engine owns

- legal state transitions;
- resource changes;
- rule validation;
- turn/scene status;
- canonical object/location ownership;
- accepted world-rule constraints;
- progression;
- game rewards;
- visibility/knowledge boundaries;
- deterministic triggers;
- provenance;
- permissions and capability checks.

### Agents may own or assist with

- interpretation;
- dialogue;
- character performance;
- adversarial choices within their authority;
- scene proposals;
- descriptions;
- coaching;
- evaluation against curriculum concepts;
- visual prompts;
- optional dramatic framing;
- suggestions for new Story Pieces.

An agent may propose that a bridge collapses. The engine decides whether that transition is allowed and records the accepted consequence.

An evaluator may judge that a player used dramatic irony effectively. The deterministic engine decides the resulting XP, progression or other mechanical reward.

This is the same architectural principle already demonstrated successfully in Wyrmwood and should become a defining Story: The Unwritten rule.

---

## 10. Agents as playable inhabitants

PlotPickle already has an agent architecture. Story: The Unwritten should reuse it rather than invent a parallel "game AI" system.

An agent may act as:

- character;
- rival;
- narrator;
- world keeper;
- rules referee;
- curriculum guide;
- game director;
- continuity observer;
- faction or organization;
- creature or environmental intelligence;
- collaborator controlled partly by a human.

A Story Piece can reference an Agent Binding rather than embedding a full independent agent runtime.

Conceptually:

```text
Character Story Piece
  -> identity and visible game data
  -> goals and relationships
  -> Agent Binding
       -> PlotPickle agent identity
       -> allowed skills
       -> allowed tools
       -> memory scope
       -> world knowledge scope
       -> action authority
       -> autonomy mode
```

The agent remains governed by PlotPickle's existing harness, trust model and runtime abstraction.

A game card must never grant an agent a permission that PlotPickle has not already authorized.

---

## 11. User-created agents

Users should be able to create their own character agents without needing to understand model APIs, prompts or orchestration.

The creation flow should describe the character in story terms:

- Name
- Role
- What do they want?
- What do they fear?
- What do they know?
- What must they not know yet?
- Who do they care about?
- What are they willing to do?
- What will they refuse to do?
- How do they speak?
- What abilities do they have in this world?
- Which Story Pieces or skills may they use?
- How autonomous should they be?

PlotPickle translates those choices into a bounded agent definition.

Advanced creators may later expose more controls, but the default experience should remain narrative rather than technical.

Useful initial authority levels:

Observer — may react or advise but cannot alter authoritative game state.

Actor — may propose actions for its bound character within legal game moves.

Director — may introduce bounded complications or select from engine-authorized possibilities.

Referee — may evaluate or explain rules but cannot change them.

World Keeper — may maintain approved canon and answer world-state questions, but may not silently invent durable canon unless the engine accepts the addition.

None of these roles may modify source code, install skills, grant permissions, change provider credentials or elevate their own authority.

---

## 12. User-created cards / Story Pieces

A user should be able to create a new Story Piece directly from normal language and then refine its mechanical meaning.

Example:

"Create a character named Elara. She is a retired cartographer who can see roads that no longer exist, but every time she follows one she forgets somewhere she has already been."

PlotPickle can propose:

Type: Character
Schools: Character + World
Ability: Reveal a hidden route under qualifying conditions.
Cost/Consequence: Mark one known location as forgotten by Elara.
Knowledge rule: Elara cannot intentionally navigate to a forgotten location without external help.
Agent Binding: optional Elara character agent.

The user can accept, change or reject the mechanics.

Generative output does not become authoritative simply because the model produced it. User confirmation or an engine-authorized creation workflow admits the piece into the world.

---

## 13. Suggested Story Piece contract

The exact TypeScript should be designed during implementation, but the conceptual contract is:

```text
StoryPiece
  id
  schemaVersion
  type
  title
  description
  owner / creator provenance
  worldId
  schools[]
  tags[]
  visibility
  state
  rules[]
  triggers[]
  costs[]
  consequences[]
  relationships[]
  assetRefs[]
  agentBinding?
  curriculumRefs[]
  createdAt
  updatedAt
```

Rules and triggers should use validated engine operations rather than arbitrary executable user code.

This is essential for portability, determinism, multiplayer trust and safe community sharing.

---

## 14. Rules as composition, not arbitrary code

Eventually users should be able to create their own games, but "create a rule" must not mean "execute arbitrary JavaScript."

Rules should be composed from a constrained vocabulary such as:

```text
WHEN <trigger>
IF <condition>
COST <resource/state change>
DO <authorized effect>
THEN <consequence/trigger>
```

Example:

```text
WHEN a character casts Memory Magic
IF the character knows at least one Memory
COST forget one known Memory
DO resolve the spell effect
THEN record the forgotten Memory in character history
```

AI can help translate natural language into the rule grammar, but the engine validates and stores the final rule.

This is the basis for users creating their own AI games without writing executable code.

---

## 15. Worlds as portable game packages

A Story World should be a portable package of content and rules.

Conceptually:

```text
StoryWorld
  identity
  description
  visual language
  canon
  Story Pieces
  world rules
  agents
  skill references
  starting states
  game modes
  curriculum links
  asset references
  creator provenance
  compatibility version
```

A world might define:

"Magic consumes memories."

"No one can cross running water after sunset."

"The royal family cannot knowingly lie."

"Every resurrection creates a second unresolved debt."

Those statements should be enforceable world rules, not merely lore paragraphs.

Once the world exists, another player should be able to tell a different story inside it while the same rules continue to hold.

---

## 16. Game modes

Story: The Unwritten is the engine, not one fixed game.

Initial modes can remain extremely small.

### Five-Scene Story

Build and resolve a coherent story in five scenes.

Purpose: simplest proof that Story Pieces, state, consequences and reflection are fun.

### Wyrmwood Trials

Use learned concepts to solve generated story problems against directed rivals.

Purpose: structured curriculum practice.

### World Session

Enter a creator's world with a starting situation and let human and agent characters act under its rules.

Purpose: open-ended storytelling with continuity.

### Duel / Challenge

Two players or a player and agent pursue opposed narrative objectives under the same world state.

Purpose: introduce strategic competition without requiring combat.

### Creator Game

A creator defines setup, allowed pieces, rule modules and victory/end conditions.

Purpose: enable the community to invent AI-driven games PlotPickle did not explicitly ship.

Only the first one or two modes should be attempted initially.

---

## 17. Wyrmwood's role

Wyrmwood should become the canonical example of how a Story: The Unwritten game can be built.

Today it already contains:

- curriculum-derived trials;
- an AI director, Master Oaken-Vague;
- multiple rivals;
- an AI curriculum evaluator;
- deterministic scoring;
- Spotlight;
- XP;
- Brine Coins;
- ranks;
- persistent turn history;
- a clear scene-like loop.

The desired direction is not a big-bang rewrite.

Instead:

1. Define Story: The Unwritten contracts around actual needs.
2. Build the smallest new playable mode using them.
3. Identify duplicated concepts between the new engine and Wyrmwood.
4. Extract only genuinely shared contracts/operations.
5. Add a Wyrmwood adapter where reuse is valuable.
6. Preserve Wyrmwood-specific flavor, scoring, rivals and curriculum behavior.

Wyrmwood remains the school.

Story: The Unwritten becomes the language that can eventually describe Wyrmwood and many other games.

---

## 18. Existing PlotPickle agents map naturally into the engine

Existing roles should be reused wherever they already fit.

Sage Brinewick can remain the conversational guide and teacher.

Master Oaken-Vague can remain Wyrmwood's director and provide a reference implementation for a bounded Game Director agent.

The Wyrmwood Curriculum Evaluator provides a reference implementation for a separate evaluator that does not control deterministic rewards.

Continuity/story analysis capabilities can validate state, setup/payoff and established facts.

Visual continuity/art-direction agents can render the accepted state as character art, world boards, cards, storyboards or previs without becoming the source of truth.

Character agents can inhabit user-created Character pieces.

BUZZ can expose the same approved public agents socially without creating a second agent identity system.

---

## 19. BUZZ and STORY UI relationship

BUZZ should not become the entire STORY interface.

The clean product boundary is:

> BUZZ is the lobby, community and agent-presence layer. STORY is the actual game table.

### BUZZ owns

- discovery of public worlds, campaigns and user-created games;
- community rooms and conversation;
- player and creator presence;
- public agent presence;
- invitations and session formation;
- discussion around a world before and after play;
- sharing Story Pieces, characters and game packages;
- launching a player into a STORY session.

### STORY owns

- the active playable world;
- Story Pieces/cards currently available or in play;
- active human and agent characters;
- locations and movement/state;
- relationships;
- objects and custody;
- resources and narrative budget;
- conflicts and unresolved threads;
- scene/turn state;
- legal actions;
- world rules;
- consequences;
- knowledge visibility;
- session history;
- game-specific victory, loss or ending conditions.

A user flow can therefore be:

```text
Great Hall / BUZZ
  -> discover "The Last Colony"
  -> enter its community room
  -> meet its creator, players and public character agents
  -> choose Play / Join Session
  -> STORY opens the dedicated game workspace
  -> the same approved character identities become active bounded game agents
  -> the deterministic STORY engine governs legal state changes
  -> accepted session outcomes become world/session history
  -> players can return to BUZZ to discuss, share or start another session
```

This separation prevents the game from becoming merely a chat room while preserving BUZZ as the social front door.

### Same agent, different context

A character can exist socially in BUZZ and actively inside STORY without becoming two unrelated agents.

For example, a user-created Captain Mara agent could:

- appear publicly in the world's BUZZ room using approved public identity and lore;
- answer non-secret questions within its social context;
- join a game session when selected;
- receive narrower session-specific knowledge inside STORY;
- act only through legal Story actions;
- retain only memory that the world/session canon policy admits.

BUZZ presence does not grant STORY authority.

STORY participation does not grant broader BUZZ, connector, tool or host authority.

The existing PlotPickle agent identity, trust, Context Engine and runtime boundaries remain authoritative across both surfaces.

### STORY workspace

The dedicated STORY workspace should make the game state visible rather than hide everything inside prose.

A first version can contain:

```text
+---------------------------------------------------------------+
| WORLD / SESSION | scene | pressure | objective | rules status |
+----------------+----------------------------------------------+
| WORLD          |                                              |
| locations      |              ACTIVE SCENE                    |
| active rules   |                                              |
| unresolved     |   characters / locations / current conflict |
| threads        |                                              |
|                |   playable Story Pieces / choices            |
+----------------+----------------------------------------------+
| CHARACTERS     |   CONSEQUENCE / NARRATIVE / AGENT ACTION     |
| human + agents |                                              |
+----------------+----------------------------------------------+
| HAND / PIECES / ACTIONS | history | inspect | create piece    |
+---------------------------------------------------------------+
```

The exact visual language can evolve. The architectural point is that STORY provides a stateful playable surface, while BUZZ provides the surrounding social environment.

### Wyrmwood UI

Wyrmwood may keep its distinctive themed interface.

Long term, it can consume the same STORY engine beneath its own presentation rather than being forced into the generic STORY layout.

That makes Wyrmwood a first-party game built with the engine rather than the engine itself.

---

## 20. Learning should be embedded, not bolted on

Every meaningful engine action can carry curriculum metadata.

A player establishes an object early and uses it later. The engine records a setup/payoff relationship. Sage can explain why it worked.

A player reveals a fact to the audience but not the protagonist. PlotPickle can identify dramatic irony.

A player changes a relationship through a costly action. PlotPickle can connect the result to character arc and consequence.

This creates a bridge in both directions:

```text
LEARN -> PLAY
PLAY -> LEARN
```

The game therefore becomes another expression of the curriculum rather than a separate entertainment feature.

---

## 21. Knowledge is part of game state

One of the most important engine concepts is knowledge ownership.

The system should distinguish:

- world truth;
- audience knowledge;
- player knowledge where relevant;
- individual character knowledge;
- agent-accessible knowledge;
- hidden creator/referee knowledge.

A character agent must not automatically receive the entire project context merely because PlotPickle has access to it.

If Elena does not know Victor is a spy, Elena's agent should not be given that fact as actionable character knowledge.

This is both a storytelling requirement and an agent-isolation requirement.

---

## 22. Memory and canon admission

Generated suggestions are not automatically canon.

Story: The Unwritten should follow the same evidence-learning principle used elsewhere in PlotPickle:

- agents may observe;
- agents may infer;
- agents may propose;
- the engine records provisional state separately where needed;
- only authorized transitions become durable world truth.

This prevents a character agent, narrator or model hallucination from silently rewriting the world.

A world can distinguish:

Established Canon
Accepted Session State
Character Belief
Rumor
Hypothesis
Generated Proposal
Rejected/Retconned Material

That distinction becomes increasingly important as worlds persist across many sessions and creators.

---

## 23. Visual layer

Cards are a useful interface because they make abstract story concepts tangible.

A Character card might show portrait, name, role, visible desire, relationship indicators, active condition, ability, cost/consequence and an agent-active indicator.

A Location card might show environment art, current occupants, discovered exits, active world rules and unresolved objects or clues.

A Secret card may be face-down or selectively visible according to knowledge state.

A Relationship can appear as an edge between cards rather than requiring its own physical card in every interface.

The engine must remain UI-independent so the same state can power a board, timeline, chat scene, storyboard or cinematic workflow.

---

## 24. Community-created content

Community sharing should eventually support:

- individual Story Pieces;
- character agents;
- starter collections;
- worlds;
- campaigns;
- game modes;
- rule modules;
- visual packs;
- teaching challenges.

Community content must carry provenance and compatibility metadata.

Imported content does not gain additional runtime authority because another creator gave it an agent or skill reference.

The recipient's PlotPickle installation remains the authority on which tools, skills, providers and capabilities are actually available.

BUZZ is the natural discovery and discussion surface for this content; STORY is the execution surface.

---

## 25. What not to build first

Do not begin with:

- booster packs;
- artificial rarity;
- speculative trading markets;
- blockchain/NFT mechanics;
- a currency economy beyond existing game progression needs;
- hundreds of card types;
- competitive balance across thousands of pieces;
- arbitrary creator scripting;
- a parallel agent runtime;
- a giant Wyrmwood rewrite;
- multiplayer networking before the single-player engine is fun;
- AI-generated content silently admitted as canon.

The first proof is much smaller:

> Can a player assemble a handful of Story Pieces, make meaningful choices across five scenes, experience coherent consequences, learn why those choices worked, and want to play again with a different combination?

If yes, the foundation is strong.

---

## 26. Minimum viable engine

The first implementation should prove only the shared mechanics necessary for one small playable experience.

Recommended MVP capabilities:

1. Create/load a Story World.
2. Create/select a small collection of Story Pieces.
3. Support Character, Location, Object, Conflict, Secret and Story Technique.
4. Bind at least one existing PlotPickle agent to a Character.
5. Allow a user to create one bounded character agent through story-language controls.
6. Start a five-scene game.
7. Validate actions against current state and world rules.
8. Track character/location/object/knowledge/relationship state.
9. Resolve deterministic consequences.
10. Allow agents to propose or dramatize actions without controlling authority.
11. Persist session history.
12. Produce a short teaching reflection after each scene or at game end.
13. Re-enter the same world and preserve accepted canon.
14. Launch the game from a BUZZ world/community context when available, while keeping direct local launch possible.

Everything else is expansion.

---

## 27. Suggested implementation ownership

Follow PlotPickle's existing architecture rather than creating a new foundation root.

A likely first implementation shape is:

```text
core/
  contracts/
    # Only contracts proven to be truly cross-module.

modules/
  story-the-unwritten/
    contracts.ts
    engine.ts
    rules/
    world/
    pieces/
    agents/
    ui/

modules/
  wyrmwood/
    # Remains independent initially.
    # Adopts shared contracts only when proven useful.

lib/agents/
  # Existing agent/runtime integrations and bounded role implementations.

lib/buzz/
  # Existing discovery, community and agent-presence integrations.

config/
  # Existing trust, skills and capability registries remain authoritative.
```

Do not create a second agent framework inside `modules/story-the-unwritten`.

Do not create a second social/community system inside STORY.

The module may define game-facing bindings and adapters, but execution should route through PlotPickle's existing agent/runtime boundaries and social discovery should route through BUZZ where appropriate.

Do not promote speculative abstractions into `core/` before there are real cross-module consumers.

---

## 28. Proposed engine invariants

The following should become architectural invariants:

1. State is authoritative; generated prose is a projection of state.
2. AI proposes and interprets; deterministic code authorizes mechanical state transitions.
3. A Story Piece cannot grant runtime permissions.
4. A user-created agent is bounded by the same host trust rules as every other PlotPickle agent.
5. Character knowledge is narrower than world knowledge unless explicitly granted.
6. Generated material is not durable canon until admitted through an authorized transition.
7. Rules are validated compositions, not arbitrary executable user code.
8. Provider choice remains independent of game logic.
9. A world remains playable without requiring one specific model vendor.
10. Wyrmwood is preserved and reused, not rewritten merely for architectural purity.
11. Learning metadata may enrich play but must not make a scene feel like a quiz unless the game mode intentionally does so.
12. User-authored story/world content is never silently rewritten by repair, evaluation or agent infrastructure.
13. BUZZ owns social discovery/presence; STORY owns authoritative active game state.
14. BUZZ presence never implies game authority, and STORY participation never expands host authority.
15. The same approved agent identity may appear across BUZZ and STORY with context-specific knowledge and capabilities.

---

## 29. Example: a world that creates its own game

A creator makes a world called Ashfall.

World Rule:

Every use of magic consumes one personal memory.

Character:

Mara Vale, an apprentice who wants enough power to save her brother.

Agent Binding:

Mara is inhabited by a bounded character agent. It knows Mara's history, current memories, relationships and scene-visible facts. It does not know hidden world truth.

Story Piece:

"Mother's Last Song" — Memory.

Story Piece:

"Open the Cinder Gate" — Story Technique / Action requiring magic.

During play, the player asks Mara to open the Cinder Gate.

The agent can propose how Mara does it and how she reacts emotionally.

The engine checks the world rule.

The action requires one Memory to be paid.

The player chooses Mother's Last Song.

The engine marks that memory forgotten by Mara and resolves the gate action.

Mara's agent is no longer given that memory as available character knowledge.

Later, another character sings the song.

Mara may experience confusion, recognition pressure or a relationship consequence, but the agent cannot simply remember the removed fact unless a legal story event restores it.

Outside the active session, Mara may also have an approved public presence in Ashfall's BUZZ community. That public presence does not receive hidden game state or gain authority to change Ashfall canon.

This interaction demonstrates the whole architecture:

- creator-authored world rule;
- card-like Story Pieces;
- persistent character state;
- bounded agent knowledge;
- deterministic cost;
- AI performance;
- consequence;
- continuity;
- BUZZ social presence;
- STORY game authority;
- emergent story.

The system did not write the story in advance.

The rules made the story possible.

---

## 30. Why this belongs in PlotPickle

PlotPickle already treats storytelling as a connected system rather than a blank page.

LEARN teaches concepts.
PLAN structures intent.
Story workflows track characters, worlds, continuity and visual development.
Agents can hold specialized roles.
Skills provide bounded procedures.
The AI runtime abstracts providers.
Wyrmwood proves that AI creativity can coexist with deterministic game authority.
BUZZ provides community, discovery and agent presence.

Story: The Unwritten connects these capabilities through play.

It turns PlotPickle from a system that can help someone make a story into a system where someone can create the rules, inhabitants and building blocks of a story world and then discover what happens when those pieces interact.

That is the foundation:

> Magic asks what deck you built.
>
> Story: The Unwritten asks what world you built — and what happened when you let it live.

---

## 31. First implementation decision

Do not begin by changing Wyrmwood.

Build one deliberately small Story: The Unwritten vertical slice beside it.

The first target should be:

> A five-scene single-player story using a handful of Story Pieces, one user-created character, one bounded character agent, deterministic state/consequences, and a short LEARN-connected reflection.

The first UI should be a dedicated STORY workspace, not a BUZZ chat room. BUZZ can launch into the session and provide the surrounding social/discovery experience.

Once that is playable, compare the resulting engine to Wyrmwood's proven contracts and extract the shared layer that actually exists.

This sequence minimizes architectural speculation while preserving the long-term goal of a common PlotPickle story-game engine that users can use to create their own AI games.

---

## 32. Fit within the PlotPickle architecture and the structural lesson from Magic

Story: The Unwritten fits inside the existing PlotPickle architecture. It should not become a parallel technology stack or a second operating system beside PlotPickle.

The architecture relationship is:

```text
PlotPickle = the operating system and authority model
STORY = the universal playable-story grammar and game engine
Wyrmwood = a first-party teaching game/world built with that engine
BUZZ = the community, discovery and multiplayer-presence surface around it
User Worlds = creator-built games and universes running through the same engine
```

### Experience Layer

STORY becomes a first-class user-facing workspace alongside LEARN, Creative Room, Character Visual Identity and the Story Workbench.

This is the actual game table. It presents Story Pieces, characters, locations, agents, relationships, current conflicts, secrets, world rules, available actions, resources and current scene state.

The existing PlotPickle experience layer therefore does not need to be replaced. STORY becomes another governed experience surfaced through it.

### Governed Orchestration Harness

The PlotPickle harness becomes STORY's rules authority.

It owns or routes:

- scene and session lifecycle;
- deterministic action validation;
- authority checks;
- policy and consent;
- budget enforcement;
- capability routing;
- revision and provenance;
- bounded autonomous agent participation;
- deterministic repair and validation where appropriate.

This prevents AI creativity from becoming game authority.

A model can propose an outcome. The governed engine decides whether that outcome is legal, affordable, visible, permitted and canonically admissible.

### Agent and Skill Mesh

STORY reuses the existing Multi-Agent Creative Runtime rather than inventing a separate game-agent framework.

Existing or future PlotPickle agents can become:

- playable character agents;
- rival agents;
- world keepers;
- directors;
- referees;
- curriculum guides;
- continuity observers;
- visual specialists;
- factions or environmental intelligences.

Skills continue to describe bounded procedures. Neither a Story Piece nor a creator-authored game can grant an agent authority beyond the PlotPickle harness.

### Story / Canon / Evidence Core

This layer is particularly well matched to STORY.

PPF remains the durable canon authority.

The Story Graph can represent causality, relationships and evolving story structure.

The Context Engine can determine which facts each agent is permitted to receive.

Observed references, generated candidates and accepted evidence retain their existing distinction.

Generated gameplay narration is therefore not automatically truth. Accepted STORY state transitions become authoritative session state, and only approved routes may influence durable PPF canon.

This is what lets STORY maintain real continuity instead of behaving like an unconstrained role-playing chatbot.

### Model-Agnostic Multimodal Inference

STORY remains independent of any one model or provider.

Character performance, direction, evaluation, visual generation and other generative tasks may use local LLMs, OpenAI-compatible providers, Ollama, llama.cpp, vision models, ComfyUI, image providers or cloud models according to PlotPickle's existing runtime policies.

The game rules do not change when the inference provider changes.

A STORY world should therefore remain portable across local and cloud configurations.

### Collaboration / External Evidence

BUZZ occupies the social layer around STORY.

BUZZ handles discovery, rooms, community, public agent presence, invitations, creator/player interaction and launching into sessions.

STORY handles the authoritative active game state after play begins.

A character may appear socially in BUZZ and then enter STORY as a bounded game agent, but the two contexts may expose different knowledge and capabilities.

BUZZ presence never grants game authority.

### Validation / Operations

STORY should use the same deterministic validation philosophy as the rest of PlotPickle.

Validation can eventually cover:

- Story Piece contracts;
- rule grammar;
- world package compatibility;
- agent bindings;
- permissions;
- serialization and restoration;
- deterministic state transitions;
- creator-built game definitions;
- production builds and focused UAT.

STORY therefore becomes another consumer of PlotPickle's existing verification architecture rather than another source of special-case validation machinery.

### Structural relationship to Magic

The useful comparison to Magic is structural, not cosmetic.

STORY should not copy Magic's card rules, terminology, factions, resource system, collectible economy, set design or intellectual property.

The architectural lesson is that a relatively stable universal rules system can support an enormous number of player-created combinations.

The structural mapping is:

```text
Magic universal rules engine
  -> STORY Rules Kernel

Magic cards with standardized properties and effects
  -> Story Pieces with standardized state, rules, triggers, costs and consequences

Magic deck construction
  -> STORY world / game / piece construction

Magic turns and phases
  -> STORY scenes and scene phases

Magic zones
  -> STORY state contexts such as active scene, world, inventory, hidden knowledge,
     available pieces, unresolved threads and resolved history

Magic effect resolution
  -> validated STORY rule operations

Magic rules judge / rules authority
  -> deterministic PlotPickle STORY engine under the governed harness

Magic card combinations and emergent strategy
  -> combinations of Story Pieces, agents, relationships, world rules and consequences

Magic expansions built on stable rules
  -> first-party and user-created worlds, games and rule packages built on STORY grammar
```

The key difference is that STORY can move beyond deck construction into game construction.

A creator may define a detective game in which evidence and knowledge determine legal actions, a political world in which autonomous faction agents negotiate and betray, a fantasy system in which magic consumes memories, or a survival game in which an environmental agent changes conditions.

Those games can look and feel very different while sharing the same underlying Story Piece grammar, rule validation, agent bindings, state model, trust boundaries and provider-independent inference architecture.

### What should change in the PlotPickle architecture diagram

The architecture itself does not require another foundational layer.

When the diagram is next revised, STORY should become visible in two places:

1. STORY Workspace in the Experience Layer as the dedicated playable surface.
2. STORY Rules Kernel / Story Piece State Machine as a governed capability beneath that surface, operating through the existing orchestration, canon, agent and validation boundaries.

BUZZ remains in the Collaboration / External Evidence layer rather than being absorbed into STORY.

Wyrmwood remains a product/game implemented with the engine rather than becoming the engine itself.

The test for architectural health is therefore simple:

> If implementing STORY requires bypassing the harness, creating a second agent system, creating a second canon store, hard-coding an AI provider, or turning BUZZ into the game engine, the implementation is going in the wrong direction.

STORY should succeed by composing PlotPickle's existing architecture.

That is why it is feasible now: most of the difficult infrastructure already exists. The remaining work is to define and prove the reusable game grammar that connects those capabilities into a playable creator system.

---

## 33. STORY Game Validator: legal is not the same as playable

Creator freedom introduces a second validation problem beyond whether a Story World is syntactically and mechanically legal.

A creator can build a game that the engine is capable of executing but that is effectively impossible, contradictory, inert or overwhelmingly complex to play. For example, a world may contain unreachable victory conditions, conflicting ending rules, a cost that can never be paid, an agent with no legal actions, a required Story Piece that can never enter play, or a trigger network that technically terminates but creates an unusable amount of mechanical churn.

STORY should therefore distinguish at least two questions:

1. Is this game definition legal for the STORY engine?
2. Is this configuration plausibly playable from its declared starting state?

The first is a contract/rule-engine question. The second is the responsibility of a deterministic STORY Game Validator.

Before a creator launches, shares or publishes a game, the validator should be able to inspect the complete game definition and report structural findings such as:

- unreachable victory, loss or ending conditions;
- contradictory or mutually exclusive required conditions;
- circular rule dependencies;
- excessive trigger depth or operation count;
- impossible or permanently unavailable costs;
- required resources with no production/source path;
- orphaned Story Pieces that can never become relevant or enter legal play;
- required Story Pieces that are missing from all valid starting/deployment paths;
- agents with no legal actions in the declared starting state;
- characters, locations or objects referenced by rules that do not exist;
- secrets or knowledge requirements that no legal action can reveal;
- dead-end states from which no participant can advance the game;
- victory conditions that are reachable only by violating another mandatory rule;
- excessive autonomous-agent fan-out or scene complexity beyond configured budgets;
- incompatible package/schema versions;
- imported references whose required capabilities are unavailable under host policy.

Validation should produce severity rather than one undifferentiated pass/fail result.

A useful model is:

```text
ERROR   -> structurally invalid or impossible to execute safely; block launch/publish
WARNING -> executable but likely broken, unreachable, contradictory or highly confusing
NOTE    -> unusual design that is legal but worth surfacing to the creator
PASS    -> no deterministic structural problem found
```

The validator should not attempt to mathematically decide whether a game is artistically good, emotionally compelling or fun. Those are not deterministic properties.

AI may assist after deterministic validation by explaining findings in ordinary language, suggesting repairs, simulating representative play patterns or identifying likely design friction. However, AI commentary must remain advisory. It cannot turn an invalid game into a valid one, suppress deterministic errors or silently rewrite creator-authored rules.

For example:

```text
Validator finding:
ERROR: "Escape the Citadel" requires three Gate Keys, but only two Gate Key sources exist in all reachable states.

AI explanation:
"Your players can collect at most two of the three keys required to win. You could add another key source, reduce the requirement to two, or create a rule that lets an existing key be duplicated."
```

This gives a non-programmer the benefits of a game-engine engineer without requiring them to understand dependency graphs or state-machine analysis.

### Preflight and publication

The first implementation should use the validator as a preflight before starting a Creator Game once custom rules are supported.

Later, publication/share flows should require a deterministic validation report and compatibility check before a world/game is advertised as playable through BUZZ.

Warnings may be permitted when the creator explicitly accepts them. Errors should block publication and normal play until corrected.

First-party games such as Wyrmwood should also be validatable by the same underlying machinery where their contracts overlap with STORY. The validator must not become a user-only code path.

### Relationship to runtime safeguards

Preflight validation does not replace runtime safeguards.

A game can pass static analysis and still produce an unexpected state because humans and autonomous agents combine legal actions in ways the creator did not anticipate. Therefore the runtime must still enforce bounded resolution queues, operation budgets, cycle detection, legal transitions, authority checks and deterministic failure behavior.

The relationship is:

```text
Creator definition
  -> STORY Game Validator
       -> structural legality
       -> reachability/dependency checks
       -> complexity/budget checks
       -> compatibility/authority checks
  -> approved playable definition
  -> STORY runtime safeguards
  -> actual play
```

This validator is an important part of the Magic-like creator architecture: a stable engine should allow enormous combinatorial freedom, but PlotPickle should help ensure that creator-built combinations still form a coherent executable game.

The governing principle is:

> STORY should maximize creator freedom while making broken game structures visible before the player has to discover them the hard way.