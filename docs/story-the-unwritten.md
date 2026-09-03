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