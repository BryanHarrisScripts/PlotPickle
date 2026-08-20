import { createHash } from "node:crypto";

export const PROFILE_AGENT_SCOPE_VERSION = 1;
export const HUMAN_BUZZ_CREDENTIAL = "buzz-connection.json";

const ACTIONS = new Set(["read", "post", "moderate"]);

function fail(message, code = "AGENT_SCOPE_REJECTED") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function id(value, label, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) return null;
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(normalized)) fail(`${label} is invalid.`, "INVALID_AGENT_SCOPE_ID");
  return normalized;
}

function profileFor(authService, authContext) {
  const status = authService.getAuthStatus(authContext);
  const profileId = status?.profile?.profileId;
  if (typeof profileId !== "string" || !profileId) fail("Agent scope requires an authenticated Human profile.", "PROFILE_REQUIRED");
  return profileId;
}

function objectId(prefix, parts) {
  const digest = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return `${prefix}-${digest.slice(0, 48)}`;
}

function instanceFor(authService, authContext, input) {
  const profileId = profileFor(authService, authContext);
  const agentDefinitionId = id(input?.agentDefinitionId, "Agent definition id");
  const projectId = id(input?.projectId, "Project id", true);
  const conversationId = id(input?.conversationId, "Conversation id");
  const instanceId = objectId("agent-instance", [profileId, agentDefinitionId, projectId, conversationId]);
  return Object.freeze({
    version: PROFILE_AGENT_SCOPE_VERSION,
    scope: "human-profile",
    profileId,
    agentDefinitionId,
    projectId,
    conversationId,
    instanceId,
    authorship: "agent",
    humanCommunityAuthority: false,
  });
}

function grantObjectId(instance, roomId) {
  return objectId("agent-buzz-grant", [instance.profileId, instance.agentDefinitionId, instance.projectId, instance.conversationId, roomId]);
}

export function createProfileAgentScopeService(options) {
  if (!options?.authService || typeof options.authService.getAuthStatus !== "function") fail("Agent scope requires PlotPickle Auth.", "INVALID_AGENT_SCOPE_CONTRACT");
  if (!options?.privateStorage || typeof options.privateStorage.readPrivateJson !== "function" || typeof options.privateStorage.writePrivateJson !== "function") {
    fail("Agent scope requires profile-private storage.", "INVALID_AGENT_SCOPE_CONTRACT");
  }
  const { authService, privateStorage } = options;

  return Object.freeze({
    resolveInstance(authContext, input) {
      return instanceFor(authService, authContext, input);
    },

    async readHumanBuzzIdentity(authContext) {
      profileFor(authService, authContext);
      return privateStorage.readCredential(authContext, HUMAN_BUZZ_CREDENTIAL);
    },

    async writeHumanBuzzIdentity(authContext, value) {
      profileFor(authService, authContext);
      if (!value || typeof value !== "object" || Array.isArray(value)) fail("BUZZ identity record is invalid.", "INVALID_BUZZ_IDENTITY");
      await privateStorage.writeCredential(authContext, HUMAN_BUZZ_CREDENTIAL, value);
      return true;
    },

    async writeMemory(authContext, input) {
      const instance = instanceFor(authService, authContext, input);
      const memoryObjectId = objectId("agent-memory", [instance.profileId, instance.agentDefinitionId, instance.projectId, instance.conversationId]);
      await privateStorage.writePrivateJson(authContext, {
        domain: "memory",
        objectId: memoryObjectId,
        value: {
          version: PROFILE_AGENT_SCOPE_VERSION,
          provenance: instance,
          value: input.value,
        },
      });
      return Object.freeze({ ...instance, memoryObjectId });
    },

    async readMemory(authContext, input) {
      const instance = instanceFor(authService, authContext, input);
      const memoryObjectId = objectId("agent-memory", [instance.profileId, instance.agentDefinitionId, instance.projectId, instance.conversationId]);
      const record = await privateStorage.readPrivateJson(authContext, { domain: "memory", objectId: memoryObjectId });
      if (record === null) return null;
      if (!record || typeof record !== "object" || Array.isArray(record)
        || record.version !== PROFILE_AGENT_SCOPE_VERSION
        || record.provenance?.profileId !== instance.profileId
        || record.provenance?.agentDefinitionId !== instance.agentDefinitionId
        || record.provenance?.projectId !== instance.projectId
        || record.provenance?.conversationId !== instance.conversationId) {
        fail("Agent memory provenance is invalid.", "AGENT_MEMORY_CORRUPT");
      }
      return record.value;
    },

    async grantBuzz(authContext, input) {
      const instance = instanceFor(authService, authContext, input);
      const roomId = id(input?.roomId, "BUZZ room id");
      const actions = [...new Set(Array.isArray(input?.actions) ? input.actions.map((action) => id(action, "BUZZ action")) : [])];
      if (!actions.length || actions.some((action) => !ACTIONS.has(action))) fail("BUZZ grant actions are invalid.", "INVALID_BUZZ_GRANT");
      const grant = Object.freeze({
        version: PROFILE_AGENT_SCOPE_VERSION,
        profileId: instance.profileId,
        instanceId: instance.instanceId,
        agentDefinitionId: instance.agentDefinitionId,
        projectId: instance.projectId,
        conversationId: instance.conversationId,
        roomId,
        actions,
        authorship: "agent",
        humanSignerSubstitution: false,
        inheritedAcrossRooms: false,
        contentAccess: instance.agentDefinitionId.toLowerCase() === "merrin" ? "room-content-only" : "granted-room-only",
        projectPrivateData: false,
      });
      await privateStorage.writePrivateJson(authContext, {
        domain: "buzz",
        objectId: grantObjectId(instance, roomId),
        value: grant,
      });
      return grant;
    },

    async authorizeBuzz(authContext, input) {
      const instance = instanceFor(authService, authContext, input);
      const roomId = id(input?.roomId, "BUZZ room id");
      const action = id(input?.action, "BUZZ action");
      if (!ACTIONS.has(action)) return false;
      const grant = await privateStorage.readPrivateJson(authContext, { domain: "buzz", objectId: grantObjectId(instance, roomId) });
      return Boolean(grant
        && typeof grant === "object"
        && !Array.isArray(grant)
        && grant.profileId === instance.profileId
        && grant.instanceId === instance.instanceId
        && grant.roomId === roomId
        && grant.humanSignerSubstitution === false
        && Array.isArray(grant.actions)
        && grant.actions.includes(action));
    },

    describeOperationalAgent(agentDefinitionId) {
      return Object.freeze({
        version: PROFILE_AGENT_SCOPE_VERSION,
        scope: "node-operational",
        agentDefinitionId: id(agentDefinitionId, "Agent definition id"),
        humanProfileAccess: false,
        humanVaultAccess: false,
        humanBuzzSignerAccess: false,
        inheritedHumanPermissions: false,
      });
    },
  });
}
