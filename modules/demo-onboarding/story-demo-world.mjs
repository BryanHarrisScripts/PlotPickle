import { reduceStoryActionWithRules } from "../story-the-unwritten/actions.mjs";
import { createStoryMechanicalState } from "../story-the-unwritten/resolution.mjs";
import {
  STORY_FIVE_SCENE_COUNT,
  createFiveSceneStoryRuntime,
  transitionFiveSceneStoryRuntime,
} from "../story-the-unwritten/session-machine.mjs";
import {
  DEMO_AUTHORITY_CLASS,
  DEMO_STORAGE_SCOPE,
  assertDemoCapability,
  createDemoReset,
} from "./demo-boundary.mjs";

export const DEMO_STORY_SCENARIO_ID = "demo:scenario:lantern-at-the-fork";
export const DEMO_STORY_SEED = "plotpickle-demo-lantern-v1";

const PROVENANCE = Object.freeze({
  authorship: "engine",
  creatorRef: "demo:scenario-authority:plotpickle",
  sourceRefs: [DEMO_STORY_SCENARIO_ID],
  admittedByRef: "demo:synthetic-admission:lantern-v1",
  admittedAt: "2026-09-04T00:00:00.000Z",
});

function rule(id, priority, choiceId, operation) {
  return Object.freeze({
    id,
    schemaVersion: 1,
    title: id,
    priority,
    when: "action-accepted",
    if: Object.freeze([{ kind: "value-equals", ref: "demo:value:last-choice", value: choiceId }]),
    cost: Object.freeze([]),
    do: Object.freeze([Object.freeze(operation)]),
    then: Object.freeze([]),
    enabled: true,
    provenance: PROVENANCE,
  });
}

export const DEMO_STORY_RULES = Object.freeze([
  rule("demo:rule:follow-lantern", 10, "demo:decision:follow-lantern", {
    kind: "move-character",
    characterId: "demo:character:mara",
    locationId: "demo:location:fork",
  }),
  rule("demo:rule:take-high-road", 11, "demo:decision:take-high-road", {
    kind: "move-character",
    characterId: "demo:character:mara",
    locationId: "demo:location:ridge",
  }),
  rule("demo:rule:share-whisper", 20, "demo:decision:share-whisper", {
    kind: "grant-knowledge",
    characterId: "demo:character:rowan",
    knowledgeRef: "demo:knowledge:gate-name",
  }),
  rule("demo:rule:keep-whisper", 21, "demo:decision:keep-whisper", {
    kind: "grant-knowledge",
    characterId: "demo:character:mara",
    knowledgeRef: "demo:knowledge:gate-name",
  }),
  rule("demo:rule:return-key", 30, "demo:decision:return-key", {
    kind: "adjust-relationship",
    relationshipId: "demo:relationship:mara-rowan",
    delta: 1,
  }),
  rule("demo:rule:keep-key", 31, "demo:decision:keep-key", {
    kind: "transfer-object",
    objectId: "demo:object:brass-key",
    custodianRef: "demo:character:mara",
  }),
  rule("demo:rule:ask-rowan", 40, "demo:decision:ask-rowan", {
    kind: "adjust-relationship",
    relationshipId: "demo:relationship:mara-rowan",
    delta: 1,
  }),
  rule("demo:rule:enter-alone", 41, "demo:decision:enter-alone", {
    kind: "move-character",
    characterId: "demo:character:mara",
    locationId: "demo:location:archive",
  }),
  rule("demo:rule:write-ending", 50, "demo:decision:write-ending", {
    kind: "resolve-thread",
    threadRef: "demo:thread:unwritten-door",
  }),
  rule("demo:rule:leave-door-open", 51, "demo:decision:leave-door-open", {
    kind: "open-thread",
    threadRef: "demo:thread:second-journey",
  }),
]);

export const DEMO_STORY_SCENARIO = Object.freeze({
  id: DEMO_STORY_SCENARIO_ID,
  seed: DEMO_STORY_SEED,
  title: "The Lantern at the Fork",
  summary: "A five-scene synthetic STORY proof about a lantern, a secret name, a brass key and one unwritten door.",
  synthetic: true,
  publicKnowledgeRefs: Object.freeze(["demo:knowledge:lantern-flickers-near-truth"]),
  storyPieces: Object.freeze([
    Object.freeze({ id: "demo:character:mara", type: "character", name: "Mara" }),
    Object.freeze({ id: "demo:character:rowan", type: "character", name: "Rowan" }),
    Object.freeze({ id: "demo:object:brass-key", type: "object", name: "Brass Key" }),
    Object.freeze({ id: "demo:location:fork", type: "location", name: "The Fork" }),
    Object.freeze({ id: "demo:location:archive", type: "location", name: "The Archive" }),
    Object.freeze({ id: "demo:secret:gate-name", type: "secret", name: "The Gate's Name" }),
  ]),
  scenes: Object.freeze([
    Object.freeze({
      id: "demo:scene:1",
      title: "The Fork",
      locationId: "demo:location:lantern-road",
      participantIds: Object.freeze(["demo:character:mara"]),
      objectiveRefs: Object.freeze(["demo:objective:choose-road"]),
      decisions: Object.freeze([
        Object.freeze({ id: "demo:decision:follow-lantern", label: "Follow the lantern" }),
        Object.freeze({ id: "demo:decision:take-high-road", label: "Take the high road" }),
      ]),
    }),
    Object.freeze({
      id: "demo:scene:2",
      title: "The Whisper",
      locationId: "demo:location:fork",
      participantIds: Object.freeze(["demo:character:mara", "demo:character:rowan"]),
      objectiveRefs: Object.freeze(["demo:objective:handle-secret"]),
      decisions: Object.freeze([
        Object.freeze({ id: "demo:decision:share-whisper", label: "Tell Rowan the gate's name" }),
        Object.freeze({ id: "demo:decision:keep-whisper", label: "Keep the gate's name private" }),
      ]),
    }),
    Object.freeze({
      id: "demo:scene:3",
      title: "The Key",
      locationId: "demo:location:key-stone",
      participantIds: Object.freeze(["demo:character:mara", "demo:character:rowan"]),
      objectiveRefs: Object.freeze(["demo:objective:decide-key"]),
      decisions: Object.freeze([
        Object.freeze({ id: "demo:decision:return-key", label: "Return the key to Rowan" }),
        Object.freeze({ id: "demo:decision:keep-key", label: "Keep the key" }),
      ]),
    }),
    Object.freeze({
      id: "demo:scene:4",
      title: "The Archive",
      locationId: "demo:location:archive-door",
      participantIds: Object.freeze(["demo:character:mara", "demo:character:rowan"]),
      objectiveRefs: Object.freeze(["demo:objective:cross-threshold"]),
      decisions: Object.freeze([
        Object.freeze({ id: "demo:decision:ask-rowan", label: "Ask Rowan to enter together" }),
        Object.freeze({ id: "demo:decision:enter-alone", label: "Enter alone" }),
      ]),
    }),
    Object.freeze({
      id: "demo:scene:5",
      title: "The Unwritten Door",
      locationId: "demo:location:unwritten-door",
      participantIds: Object.freeze(["demo:character:mara"]),
      objectiveRefs: Object.freeze(["demo:objective:choose-ending"]),
      decisions: Object.freeze([
        Object.freeze({ id: "demo:decision:write-ending", label: "Write an ending" }),
        Object.freeze({ id: "demo:decision:leave-door-open", label: "Leave the door open" }),
      ]),
    }),
  ]),
});

const DECISIONS = new Map(
  DEMO_STORY_SCENARIO.scenes.flatMap((scene) => scene.decisions.map((decision) => [decision.id, { ...decision, sceneId: scene.id }])),
);

function requireDemoBoundary(boundary) {
  if (boundary?.authorityClass !== DEMO_AUTHORITY_CLASS
    || boundary?.storageScope !== DEMO_STORAGE_SCOPE
    || boundary?.disposable !== true
    || boundary?.authenticatedHuman !== false
    || boundary?.humanProfileId !== "") {
    const error = new Error("A valid isolated DEMO boundary is required");
    error.code = "DEMO_BOUNDARY_REQUIRED";
    throw error;
  }
  if (boundary.demoId !== DEMO_STORY_SCENARIO_ID || boundary.seed !== DEMO_STORY_SEED) {
    const error = new Error("The DEMO boundary does not match the bundled scenario seed");
    error.code = "DEMO_SCENARIO_SEED_MISMATCH";
    throw error;
  }
}

function createRuntime() {
  const runtime = createFiveSceneStoryRuntime({
    sessionId: "demo:session:lantern-at-the-fork",
    gameDefinitionId: "demo:game:lantern-at-the-fork",
    worldId: "demo:world:lantern-at-the-fork",
    worldRevisionRef: "demo:world:lantern-at-the-fork@1",
    ppfProjectRef: "demo:ppf-projection:lantern-at-the-fork",
    resolutionLimits: { maximumOperationsPerScene: 8, maximumAgentCallsPerTurn: 1 },
    sceneDefinitions: DEMO_STORY_SCENARIO.scenes.map((scene) => ({
      id: scene.id,
      locationId: scene.locationId,
      participantIds: scene.participantIds,
      objectiveRefs: scene.objectiveRefs,
      narrativeBudget: 4,
    })),
  });
  const started = transitionFiveSceneStoryRuntime(runtime, "start-session");
  if (!started.ok) throw new Error(started.failure?.message || "The synthetic STORY session could not start");
  return started.runtime;
}

function createInitialState() {
  return createStoryMechanicalState({
    values: {
      "demo:value:last-choice": "demo:decision:none",
      "demo:value:turns": 0,
    },
    characterLocations: {
      "demo:character:mara": "demo:location:lantern-road",
      "demo:character:rowan": "demo:location:fork",
    },
    objectCustody: {
      "demo:object:brass-key": "demo:location:key-stone",
    },
    knowledgeByCharacter: {
      "demo:character:mara": [],
      "demo:character:rowan": [],
    },
    relationships: {
      "demo:relationship:mara-rowan": 0,
    },
    openThreads: ["demo:thread:unwritten-door"],
  });
}

export function createStoryDemoWorld({ boundary }) {
  requireDemoBoundary(boundary);
  assertDemoCapability("story.synthetic.read");
  return {
    scenario: DEMO_STORY_SCENARIO,
    boundary,
    runtime: createRuntime(),
    state: createInitialState(),
    decisionHistory: [],
  };
}

export function listStoryDemoDecisions(world) {
  requireDemoBoundary(world?.boundary);
  assertDemoCapability("story.synthetic.read");
  const currentSceneId = world?.runtime?.session?.currentSceneId;
  const scene = DEMO_STORY_SCENARIO.scenes.find((candidate) => candidate.id === currentSceneId);
  return scene ? scene.decisions.map((decision) => ({ ...decision })) : [];
}

export function applyStoryDemoDecision(world, decisionId, { proposedAt = "2026-09-04T00:00:00.000Z" } = {}) {
  requireDemoBoundary(world?.boundary);
  assertDemoCapability("story.synthetic.propose");
  assertDemoCapability("story.synthetic.resolve");
  const decision = DECISIONS.get(decisionId);
  if (!decision) {
    const error = new Error(`Unknown DEMO decision: ${String(decisionId)}`);
    error.code = "DEMO_DECISION_UNKNOWN";
    throw error;
  }
  const currentSceneId = world?.runtime?.session?.currentSceneId;
  if (decision.sceneId !== currentSceneId) {
    const error = new Error(`Decision ${decisionId} does not belong to the active DEMO scene`);
    error.code = "DEMO_DECISION_WRONG_SCENE";
    throw error;
  }
  const turn = world.decisionHistory.length + 1;
  const result = reduceStoryActionWithRules({
    runtime: world.runtime,
    state: world.state,
    action: {
      id: `demo:action:${turn}:${decisionId}`,
      sessionId: world.runtime.session.id,
      sceneId: currentSceneId,
      actorRef: "demo:player:new-human",
      pieceId: null,
      operation: { kind: "set-value", ref: "demo:value:last-choice", value: decisionId },
      idempotencyKey: `demo:idempotency:${turn}:${decisionId}`,
      proposedAt,
    },
    rules: DEMO_STORY_RULES,
  });
  if (!result.ok || result.status !== "accepted") {
    const error = new Error(result.failure?.message || "The DEMO decision could not resolve");
    error.code = result.failure?.code || "DEMO_DECISION_REJECTED";
    throw error;
  }

  const nextState = structuredClone(result.state);
  nextState.values["demo:value:turns"] = turn;
  const nextRuntime = structuredClone(result.runtime);
  nextRuntime.session.stateRevision = nextState.revision;
  const resolving = transitionFiveSceneStoryRuntime(nextRuntime, "begin-scene-resolution");
  if (!resolving.ok) throw new Error(resolving.failure?.message || "The DEMO scene could not begin resolution");
  const completed = transitionFiveSceneStoryRuntime(resolving.runtime, "complete-scene");
  if (!completed.ok) throw new Error(completed.failure?.message || "The DEMO scene could not complete");

  return {
    ...world,
    runtime: completed.runtime,
    state: nextState,
    decisionHistory: [
      ...world.decisionHistory,
      {
        turn,
        sceneId: currentSceneId,
        decisionId,
        matchedRuleIds: [...result.matchedRuleIds],
        consequenceKinds: result.acceptedRuleEvents.map((event) => event.operation.kind),
        stateRevision: nextState.revision,
      },
    ],
  };
}

export function projectStoryDemoKnowledge(world, viewerRef = "demo:viewer:audience") {
  requireDemoBoundary(world?.boundary);
  assertDemoCapability("story.synthetic.read");
  const publicRefs = [...DEMO_STORY_SCENARIO.publicKnowledgeRefs];
  if (!Object.prototype.hasOwnProperty.call(world.state.knowledgeByCharacter, viewerRef)) return publicRefs;
  return [...new Set([...publicRefs, ...(world.state.knowledgeByCharacter[viewerRef] || [])])].sort();
}

export function resetStoryDemoWorld(world) {
  requireDemoBoundary(world?.boundary);
  assertDemoCapability("story.synthetic.reset");
  createDemoReset({ boundary: world.boundary, initialState: createInitialState() });
  return createStoryDemoWorld({ boundary: world.boundary });
}

export function replayStoryDemoWorld({ boundary, decisionIds, proposedAtPrefix = "2099-01-01T00:00:" }) {
  if (!Array.isArray(decisionIds)) throw new TypeError("decisionIds must be an array");
  let world = createStoryDemoWorld({ boundary });
  decisionIds.forEach((decisionId, index) => {
    const seconds = String(index).padStart(2, "0");
    world = applyStoryDemoDecision(world, decisionId, { proposedAt: `${proposedAtPrefix}${seconds}.000Z` });
  });
  return world;
}

export function assertStoryDemoSyntheticRefs(world) {
  requireDemoBoundary(world?.boundary);
  const refs = [
    world.runtime.session.id,
    world.runtime.session.gameDefinitionId,
    world.runtime.session.worldId,
    world.runtime.session.worldRevisionRef,
    world.runtime.session.ppfProjectRef,
    ...world.runtime.session.sceneIds,
    ...world.scenario.storyPieces.map((piece) => piece.id),
  ];
  const invalid = refs.filter((ref) => typeof ref !== "string" || !ref.startsWith("demo:"));
  if (invalid.length) {
    const error = new Error(`DEMO contains non-synthetic refs: ${invalid.join(", ")}`);
    error.code = "DEMO_NON_SYNTHETIC_REF";
    throw error;
  }
  return true;
}

export function demoStorySceneCount() {
  return STORY_FIVE_SCENE_COUNT;
}
