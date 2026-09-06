import { reduceStoryActionWithRules } from "../actions.mjs";
import { createFiveSceneCreatorStarterCollection } from "../creator/starter-world.mjs";
import { createStoryMechanicalState } from "../resolution.mjs";
import {
  createFiveSceneStoryRuntime,
  transitionFiveSceneStoryRuntime,
} from "../session-machine.mjs";

export const STORY_WORKSPACE_ID = "story:workspace:lantern-workshop";
export const STORY_WORKSPACE_SESSION_ID = "story:session:lantern-workshop";

const WORLD_ID = "story:world:lantern-workshop";
const GAME_ID = "story:game:lantern-workshop";
const KEEPER_ID = `${WORLD_ID}:piece:keeper`;
const KEY_ID = `${WORLD_ID}:piece:key`;
const CROSSROADS_ID = `${WORLD_ID}:piece:crossroads`;
const GATE_ID = `${WORLD_ID}:piece:sealed-gate`;
const SECRET_ID = `${WORLD_ID}:piece:gate-name`;
const TECHNIQUE_ID = `${WORLD_ID}:piece:choice-consequence`;
const GATE_OPEN_REF = `${WORLD_ID}:state:gate-open`;
const APPROACH_REF = `${WORLD_ID}:state:approach`;
const SECRET_KEPT_REF = `${WORLD_ID}:state:secret-kept`;
const ENDING_REF = `${WORLD_ID}:state:ending`;
const GATE_THREAD_REF = `${WORLD_ID}:thread:sealed-gate`;
const RETURN_THREAD_REF = `${WORLD_ID}:thread:return-later`;
const GATE_NAME_KNOWLEDGE_REF = `${WORLD_ID}:knowledge:gate-name`;

const scene = (id, title, locationId, objective, pressure, choices) => Object.freeze({
  id,
  title,
  locationId,
  participantIds: Object.freeze([KEEPER_ID]),
  objectiveRefs: Object.freeze([objective]),
  activeConflictIds: Object.freeze([GATE_ID]),
  unresolvedThreadRefs: Object.freeze([GATE_THREAD_REF]),
  narrativeBudget: 4,
  pressure,
  choices: Object.freeze(choices.map((choice) => Object.freeze(choice))),
});

export const STORY_WORKSPACE_SCENES = Object.freeze([
  scene(
    `${WORLD_ID}:scene:1`,
    "The Crossroads",
    CROSSROADS_ID,
    `${WORLD_ID}:objective:choose-approach`,
    "The lantern is fading. Decide how the Keeper approaches the sealed road.",
    [
      { id: "study-lantern", label: "Study the lantern", mechanic: "Sets a careful approach", consequence: "Later choices remember that the Keeper looked before acting.", operation: { kind: "set-value", ref: APPROACH_REF, value: "careful" } },
      { id: "test-gate", label: "Test the gate", mechanic: "Sets a direct approach", consequence: "The Keeper commits to action before certainty.", operation: { kind: "set-value", ref: APPROACH_REF, value: "direct" } },
    ],
  ),
  scene(
    `${WORLD_ID}:scene:2`,
    "The Name in Stone",
    CROSSROADS_ID,
    `${WORLD_ID}:objective:handle-secret`,
    "A name appears in the stone. Knowledge can be carried or refused.",
    [
      { id: "learn-name", label: "Remember the gate's name", mechanic: "Grants character knowledge", consequence: "The Keeper may act with that fact later.", operation: { kind: "grant-knowledge", characterId: KEEPER_ID, knowledgeRef: GATE_NAME_KNOWLEDGE_REF } },
      { id: "refuse-name", label: "Leave the name unread", mechanic: "Records a refusal", consequence: "The fact remains outside the Keeper's actionable knowledge.", operation: { kind: "set-value", ref: SECRET_KEPT_REF, value: true } },
    ],
  ),
  scene(
    `${WORLD_ID}:scene:3`,
    "The Brass Key",
    `${WORLD_ID}:location:key-stone`,
    `${WORLD_ID}:objective:decide-key`,
    "The key can make one path legal and close another.",
    [
      { id: "take-key", label: "Take the brass key", mechanic: "Transfers object custody", consequence: "Opening the gate becomes a legal action.", operation: { kind: "transfer-object", objectId: KEY_ID, custodianRef: KEEPER_ID } },
      { id: "leave-key", label: "Leave the key on the stone", mechanic: "Preserves object custody", consequence: "The Keeper reaches the gate without the required object.", operation: { kind: "set-value", ref: `${WORLD_ID}:state:key-left-behind`, value: true } },
    ],
  ),
  scene(
    `${WORLD_ID}:scene:4`,
    "The Sealed Gate",
    `${WORLD_ID}:location:gate`,
    `${WORLD_ID}:objective:resolve-gate`,
    "The earlier object choice now constrains what the Keeper can do.",
    [
      { id: "open-gate", label: "Open the gate", mechanic: "Requires custody of the Brass Key", consequence: "The sealed-gate thread resolves and the road becomes available.", requiresKey: true, operation: { kind: "set-value", ref: GATE_OPEN_REF, value: true } },
      { id: "wait-at-gate", label: "Wait at the gate", mechanic: "Opens a future thread", consequence: "The story preserves an unresolved return instead of faking access.", operation: { kind: "open-thread", threadRef: RETURN_THREAD_REF } },
    ],
  ),
  scene(
    `${WORLD_ID}:scene:5`,
    "The Unwritten Road",
    `${WORLD_ID}:location:beyond-gate`,
    `${WORLD_ID}:objective:choose-ending`,
    "The ending records what the player actually earned, not what prose wishes were true.",
    [
      { id: "cross-threshold", label: "Cross the threshold", mechanic: "Moves the Keeper and records the ending", consequence: "The Keeper carries the accepted state into the ending.", operation: { kind: "move-character", characterId: KEEPER_ID, locationId: `${WORLD_ID}:location:beyond-gate` }, ending: "crossed" },
      { id: "turn-back", label: "Turn back", mechanic: "Records an open ending", consequence: "The unresolved road remains available for another session.", operation: { kind: "open-thread", threadRef: RETURN_THREAD_REF }, ending: "returned" },
    ],
  ),
]);

function starterCollection() {
  return createFiveSceneCreatorStarterCollection({
    worldId: WORLD_ID,
    gameDefinitionId: GAME_ID,
    ppfProjectRef: "ppf:local-story-workspace",
    creatorRef: "profile:local-story-player",
    createdAt: "2026-09-06T00:00:00.000Z",
    checkedRevisionRef: "story:workspace:lantern-workshop@1",
  });
}

function initialRuntime(collection) {
  const ready = createFiveSceneStoryRuntime({
    sessionId: STORY_WORKSPACE_SESSION_ID,
    gameDefinitionId: collection.gameDefinition.id,
    worldId: collection.world.id,
    worldRevisionRef: `${collection.world.id}@1`,
    ppfProjectRef: collection.world.ppfProjectRef,
    resolutionLimits: collection.gameDefinition.resolutionLimits,
    sceneDefinitions: STORY_WORKSPACE_SCENES,
  });
  const started = transitionFiveSceneStoryRuntime(ready, "start-session");
  if (!started.ok) throw new Error(started.failure?.message || "STORY workspace session could not start");
  return started.runtime;
}

function initialState(collection) {
  return createStoryMechanicalState({
    ...collection.initialState,
    objectCustody: { ...collection.initialState.objectCustody, [KEY_ID]: `${WORLD_ID}:location:key-stone` },
    openThreads: [GATE_THREAD_REF],
  });
}

export function createStoryWorkspaceGame() {
  const collection = starterCollection();
  return Object.freeze({
    id: STORY_WORKSPACE_ID,
    collection,
    runtime: initialRuntime(collection),
    state: initialState(collection),
    history: Object.freeze([]),
  });
}

export function activeStoryWorkspaceScene(game) {
  const activeId = game?.runtime?.session?.currentSceneId;
  if (!activeId) return null;
  return STORY_WORKSPACE_SCENES.find((candidate) => candidate.id === activeId) ?? null;
}

export function legalStoryWorkspaceChoices(game) {
  const active = activeStoryWorkspaceScene(game);
  if (!active) return [];
  return active.choices.map((choice) => ({
    ...choice,
    legal: choice.requiresKey !== true || game.state.objectCustody[KEY_ID] === KEEPER_ID,
    blockedReason: choice.requiresKey === true && game.state.objectCustody[KEY_ID] !== KEEPER_ID
      ? "The Keeper does not have the Brass Key."
      : null,
  }));
}

export function applyStoryWorkspaceChoice(game, choiceId, { proposedAt = new Date().toISOString() } = {}) {
  const active = activeStoryWorkspaceScene(game);
  if (!active) throw new Error("The STORY workspace session is already complete");
  const choice = legalStoryWorkspaceChoices(game).find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Unknown STORY workspace choice: ${String(choiceId)}`);
  if (!choice.legal) throw new Error(choice.blockedReason || "That STORY action is not legal in the current state");

  const turn = game.history.length + 1;
  const result = reduceStoryActionWithRules({
    runtime: game.runtime,
    state: game.state,
    action: {
      id: `${STORY_WORKSPACE_SESSION_ID}:action:${turn}:${choice.id}`,
      sessionId: game.runtime.session.id,
      sceneId: active.id,
      actorRef: KEEPER_ID,
      pieceId: KEEPER_ID,
      operation: structuredClone(choice.operation),
      idempotencyKey: `${STORY_WORKSPACE_SESSION_ID}:choice:${turn}:${choice.id}`,
      proposedAt,
    },
    rules: [],
  });
  if (!result.ok || result.status !== "accepted") {
    throw new Error(result.failure?.message || "The STORY action could not resolve");
  }

  let state = result.state;
  const acceptedEvents = [...result.acceptedRuleEvents];
  if (choice.id === "open-gate") {
    const threadResolution = reduceStoryActionWithRules({
      runtime: result.runtime,
      state,
      action: {
        id: `${STORY_WORKSPACE_SESSION_ID}:action:${turn}:resolve-gate-thread`,
        sessionId: result.runtime.session.id,
        sceneId: active.id,
        actorRef: KEEPER_ID,
        pieceId: GATE_ID,
        operation: { kind: "resolve-thread", threadRef: GATE_THREAD_REF },
        idempotencyKey: `${STORY_WORKSPACE_SESSION_ID}:choice:${turn}:resolve-gate-thread`,
        proposedAt,
      },
      rules: [],
    });
    if (!threadResolution.ok || threadResolution.status !== "accepted") {
      throw new Error(threadResolution.failure?.message || "The gate consequence could not resolve");
    }
    state = threadResolution.state;
    acceptedEvents.push(...threadResolution.acceptedRuleEvents);
  }
  if (choice.ending) state = createStoryMechanicalState({ ...state, values: { ...state.values, [ENDING_REF]: choice.ending } });

  const resolving = transitionFiveSceneStoryRuntime(result.runtime, "begin-scene-resolution");
  if (!resolving.ok) throw new Error(resolving.failure?.message || "The STORY scene could not begin resolution");
  const completed = transitionFiveSceneStoryRuntime(resolving.runtime, "complete-scene");
  if (!completed.ok) throw new Error(completed.failure?.message || "The STORY scene could not complete");

  return Object.freeze({
    ...game,
    runtime: completed.runtime,
    state,
    history: Object.freeze([...game.history, Object.freeze({
      turn,
      sceneId: active.id,
      sceneTitle: active.title,
      choiceId: choice.id,
      choiceLabel: choice.label,
      mechanic: choice.mechanic,
      consequence: choice.consequence,
      stateRevision: state.revision,
      acceptedOperationKinds: Object.freeze([choice.operation.kind, ...acceptedEvents.map((event) => event.operation?.kind).filter(Boolean)]),
    })]),
  });
}

export function projectStoryWorkspace(game) {
  const active = activeStoryWorkspaceScene(game);
  const pieces = game.collection.pieces;
  const pieceById = new Map(pieces.map((piece) => [piece.id, piece]));
  const currentSceneIndex = active ? STORY_WORKSPACE_SCENES.findIndex((candidate) => candidate.id === active.id) : STORY_WORKSPACE_SCENES.length;
  const ending = game.state.values[ENDING_REF] ?? null;
  return Object.freeze({
    world: { id: game.collection.world.id, title: game.collection.world.title },
    game: { id: game.collection.gameDefinition.id, title: game.collection.gameDefinition.title },
    session: {
      id: game.runtime.session.id,
      status: game.runtime.session.status,
      sceneNumber: active ? currentSceneIndex + 1 : STORY_WORKSPACE_SCENES.length,
      sceneCount: STORY_WORKSPACE_SCENES.length,
      stateRevision: game.state.revision,
    },
    scene: active ? {
      id: active.id,
      title: active.title,
      pressure: active.pressure,
      objectiveRefs: [...active.objectiveRefs],
      unresolvedThreadRefs: active.unresolvedThreadRefs.filter((ref) => game.state.openThreads.includes(ref)),
    } : null,
    activeCharacter: pieceById.get(KEEPER_ID) ?? null,
    activeLocation: pieceById.get(CROSSROADS_ID) ?? null,
    conflict: pieceById.get(GATE_ID) ?? null,
    secret: pieceById.get(SECRET_ID) ?? null,
    technique: pieceById.get(TECHNIQUE_ID) ?? null,
    availablePieces: pieces,
    choices: legalStoryWorkspaceChoices(game),
    rules: game.collection.rules,
    validation: game.collection.validation,
    history: game.history,
    openThreads: [...game.state.openThreads],
    gateOpen: game.state.values[GATE_OPEN_REF] === true,
    hasKey: game.state.objectCustody[KEY_ID] === KEEPER_ID,
    knowsGateName: (game.state.knowledgeByCharacter[KEEPER_ID] || []).includes(GATE_NAME_KNOWLEDGE_REF),
    ending,
  });
}
