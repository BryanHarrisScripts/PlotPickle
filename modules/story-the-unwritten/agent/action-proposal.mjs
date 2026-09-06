import { reduceStoryActionWithRules } from "../actions.mjs";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function rejected(code, message, action = null, runtime = null, state = null) {
  return {
    ok: false,
    status: "rejected",
    action,
    runtime,
    state,
    acceptedEvent: null,
    checkpoint: null,
    matchedRuleIds: [],
    acceptedRuleEvents: [],
    failure: { code, message },
  };
}

export function storyAgentPermissionForOperation(operationKind) {
  return `story-action:${String(operationKind || "").trim()}`;
}

export function createStoryAgentActionProposal({
  sessionId,
  sceneId,
  characterId,
  proposalId,
  pieceId = null,
  operation,
  gameActionPermissionRefs = [],
  proposedAt = new Date().toISOString(),
}) {
  for (const [field, value] of Object.entries({ sessionId, sceneId, characterId, proposalId })) {
    if (!isReference(value)) return rejected("invalid-agent-proposal", `${field} must be a non-empty reference`);
  }
  if (pieceId !== null && !isReference(pieceId)) {
    return rejected("invalid-agent-proposal", "pieceId must be null or a non-empty reference");
  }
  if (!isRecord(operation) || !isReference(operation.kind)) {
    return rejected("invalid-agent-proposal", "operation with a kind is required");
  }
  if (!Array.isArray(gameActionPermissionRefs) || gameActionPermissionRefs.some((permission) => !isReference(permission))) {
    return rejected("invalid-agent-proposal", "gameActionPermissionRefs must contain references only");
  }

  const requiredPermission = storyAgentPermissionForOperation(operation.kind);
  if (!gameActionPermissionRefs.includes(requiredPermission)) {
    return rejected(
      "story-agent-action-not-permitted",
      `STORY character agent is not permitted to propose operation ${operation.kind}`,
    );
  }

  const safeProposalId = proposalId.trim();
  const action = {
    id: `story-agent-action:${safeProposalId}`,
    sessionId: sessionId.trim(),
    sceneId: sceneId.trim(),
    actorRef: characterId.trim(),
    pieceId,
    operation: structuredClone(operation),
    idempotencyKey: `story-agent:${sessionId.trim()}:${sceneId.trim()}:${characterId.trim()}:${safeProposalId}`,
    proposedAt: new Date(proposedAt).toISOString(),
  };
  return { ok: true, status: "proposal", action, failure: null };
}

export function resolveStoryAgentActionProposal({
  runtime,
  state,
  characterId,
  proposalId,
  pieceId = null,
  operation,
  gameActionPermissionRefs = [],
  rules = [],
  proposedAt,
}) {
  const sessionId = runtime?.session?.id;
  const sceneId = runtime?.session?.currentSceneId;
  const scene = Array.isArray(runtime?.scenes)
    ? runtime.scenes.find((candidate) => candidate.id === sceneId)
    : null;

  if (!isReference(sessionId) || !isReference(sceneId) || !scene) {
    return rejected("invalid-session-runtime", "active STORY session and scene are required", null, runtime, state);
  }
  if (!Array.isArray(scene.participantIds) || !scene.participantIds.includes(characterId)) {
    return rejected(
      "story-agent-character-not-active",
      "STORY character agent may propose actions only while participating in the current scene",
      null,
      runtime,
      state,
    );
  }

  const proposal = createStoryAgentActionProposal({
    sessionId,
    sceneId,
    characterId,
    proposalId,
    pieceId,
    operation,
    gameActionPermissionRefs,
    proposedAt,
  });
  if (!proposal.ok) return { ...proposal, runtime, state };

  const resolution = reduceStoryActionWithRules({ runtime, state, action: proposal.action, rules });
  return {
    ...resolution,
    action: proposal.action,
    proposedBy: characterId,
    authority: "deterministic-story-engine",
  };
}
