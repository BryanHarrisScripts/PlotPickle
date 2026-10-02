const ALLOWED_ACTIONS = Object.freeze([
  "search_resources",
  "fetch_resource",
  "list_projects",
  "fetch_project_summary",
]);

export const CHATGPT_GATEWAY_RESOURCE_TYPES = Object.freeze([
  "project",
  "character",
  "story-block",
  "mini-block",
  "scene",
  "developer-brief",
]);

export const CHATGPT_GATEWAY_AUTHORITY = Object.freeze({
  storyAuthority: "plotpickle-ppf",
  clientRole: "interface",
  canonMutation: false,
  repositoryMutation: false,
  mergeAuthority: false,
  dsddAuthority: false,
  browserAutomationAuthority: false,
});

export const CHATGPT_GATEWAY_EXTENSION_PLAN = Object.freeze({
  sidebar: Object.freeze({
    phase: "prototype",
    entrypoint: "global",
    purpose: "Open the read-only PlotPickle navigator.",
  }),
  composerMentions: Object.freeze({
    phase: "prototype-where-supported",
    resourceTypes: CHATGPT_GATEWAY_RESOURCE_TYPES,
    purpose: "Select governed PlotPickle resources without copying them into a second story store.",
  }),
  fileViewer: Object.freeze({
    phase: "deferred",
    reason: "Do not claim a PlotPickle file-handler contract until canonical file/resource transport is separately governed.",
  }),
  richForms: Object.freeze({
    phase: "deferred",
    reason: "Structured write/proposal actions require a separate Human-approval and PPF-mutation contract.",
  }),
});

function clean(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requireAllowed(value, allowed, label) {
  const normalized = clean(value, 180);
  if (!allowed.includes(normalized)) throw new Error(`Unsupported ChatGPT gateway ${label}: ${normalized || "missing"}`);
  return normalized;
}

export function normalizeChatGptGatewayRequest(input = {}) {
  const action = requireAllowed(input.action, ALLOWED_ACTIONS, "action");
  const sessionId = clean(input.sessionId, 240);
  const actorId = clean(input.actorId, 240);
  if (!sessionId || !actorId) throw new Error("ChatGPT gateway requests require authenticated actor and session identity.");

  const resourceType = input.resourceType == null
    ? null
    : requireAllowed(input.resourceType, CHATGPT_GATEWAY_RESOURCE_TYPES, "resource type");

  if (["fetch_resource"].includes(action) && (!resourceType || !clean(input.resourceId, 320))) {
    throw new Error("fetch_resource requires a governed resource type and resource id.");
  }

  return Object.freeze({
    schemaVersion: 1,
    requestId: clean(input.requestId, 240) || `chatgpt:${sessionId}:${action}`,
    actorId,
    sessionId,
    action,
    projectId: clean(input.projectId, 320) || null,
    resourceType,
    resourceId: clean(input.resourceId, 320) || null,
    query: clean(input.query, 2000) || null,
    requestedFields: Object.freeze([...(input.requestedFields ?? [])]
      .map((value) => clean(value, 180))
      .filter(Boolean)
      .slice(0, 64)),
  });
}

export function governedResourceUri({ projectId, resourceType, resourceId }) {
  const project = clean(projectId, 320);
  const type = requireAllowed(resourceType, CHATGPT_GATEWAY_RESOURCE_TYPES, "resource type");
  const id = clean(resourceId, 320);
  if (!project || !id) throw new Error("Governed PlotPickle resource URIs require project and resource ids.");
  return `plotpickle://project/${encodeURIComponent(project)}/${type}/${encodeURIComponent(id)}`;
}

export function chatGptGatewayResponse({ request, data, evidenceRefs = [] }) {
  const normalized = normalizeChatGptGatewayRequest(request);
  return Object.freeze({
    schemaVersion: 1,
    requestId: normalized.requestId,
    authoritativeSource: "plotpickle-ppf",
    clientRole: "interface",
    action: normalized.action,
    data,
    evidenceRefs: Object.freeze([...(evidenceRefs ?? [])].map((value) => clean(value, 1000)).filter(Boolean)),
    authority: CHATGPT_GATEWAY_AUTHORITY,
  });
}

export function minimalChatGptGatewayPrototype() {
  return Object.freeze({
    id: "plotpickle-read-only-navigator",
    transport: "remote-mcp-or-secure-mcp-tunnel",
    defaultWriteAccess: false,
    tools: Object.freeze([
      Object.freeze({ name: "plotpickle_list_projects", action: "list_projects", readOnly: true }),
      Object.freeze({ name: "plotpickle_search_resources", action: "search_resources", readOnly: true }),
      Object.freeze({ name: "plotpickle_fetch_resource", action: "fetch_resource", readOnly: true }),
      Object.freeze({ name: "plotpickle_fetch_project_summary", action: "fetch_project_summary", readOnly: true }),
    ]),
    extensionPlan: CHATGPT_GATEWAY_EXTENSION_PLAN,
    authority: CHATGPT_GATEWAY_AUTHORITY,
  });
}

export function assertNoPrivilegedGatewayCapability(name) {
  const capability = clean(name, 180);
  const forbidden = [
    "shell",
    "browser-control",
    "filesystem",
    "repository-write",
    "git-merge",
    "canon-write",
    "dsdd-pass-fail",
    "provider-credential-read",
  ];
  if (forbidden.includes(capability)) throw new Error(`Forbidden ChatGPT gateway capability: ${capability}`);
  return capability;
}
