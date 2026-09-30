export const PI_DEVELOPER_ROUTE_ENV = "PLOTPICKLE_PI_ROUTE_JSON";

export const PI_DEVELOPER_LOGICAL_MODEL = Object.freeze({
  provider: "plotpickle",
  model: "developer",
});

export const PI_CLASSIFIER_ALLOWED_DECISIONS = Object.freeze([
  "task-category",
  "complexity",
  "read-only-sufficiency",
  "model-family",
]);

export const PI_CLASSIFIER_FORBIDDEN_DECISIONS = Object.freeze([
  "human-approval",
  "dsdd-intent-lock",
  "story-canon",
  "source-mutation",
  "destructive-action",
  "merge-authorization",
  "final-correctness",
  "evidence-sufficiency",
]);

const THINKING_LEVELS = new Set(["off", "low", "medium", "high", "xhigh"]);

function string(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedRoute(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`PlotPickle Pi route ${index} must be an object.`);
  }
  const id = string(value.id);
  const provider = string(value.provider);
  const model = string(value.model);
  const locality = value.locality === "cloud" ? "cloud" : value.locality === "local" ? "local" : "";
  const purpose = string(value.purpose) || "default";
  const thinkingLevel = THINKING_LEVELS.has(value.thinkingLevel) ? value.thinkingLevel : "medium";
  if (!id || !provider || !model || !locality) {
    throw new Error(`PlotPickle Pi route ${index} requires id, provider, model and locality.`);
  }
  return Object.freeze({
    id,
    provider,
    model,
    locality,
    purpose,
    thinkingLevel,
    ready: value.ready === true,
  });
}

function normalizedClassifier(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.enabled !== true) return null;
  const provider = string(value.provider);
  const model = string(value.model);
  const locality = value.locality === "local" ? "local" : value.locality === "cloud" ? "cloud" : "";
  const decisionKinds = Array.isArray(value.decisionKinds)
    ? [...new Set(value.decisionKinds.map(string).filter(Boolean))]
    : [];
  if (!provider || !model || !locality) throw new Error("Enabled Pi classifier requires provider, model and locality.");
  if (locality !== "local") {
    throw new Error("PlotPickle Phase 4 classifiers must be local; cloud classifiers are not an authority shortcut.");
  }
  for (const kind of decisionKinds) {
    if (!PI_CLASSIFIER_ALLOWED_DECISIONS.includes(kind)) {
      throw new Error(`Classifier decision ${kind} is not an allowed non-authoritative routing decision.`);
    }
  }
  return Object.freeze({
    enabled: true,
    provider,
    model,
    locality,
    decisionKinds,
    authoritative: false,
  });
}

function routeAllowedByPrivacy(route, privacy) {
  if (!route.ready) return false;
  if (route.locality === "local") return true;
  return privacy.localOnly !== true
    && privacy.cloudAllowed === true
    && privacy.explicitCloudConsent === true;
}

export function normalizePiDeveloperRouteProjection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PlotPickle Pi developer route projection is missing.");
  }
  if (value.schemaVersion !== 1) throw new Error("Unsupported PlotPickle Pi developer route projection.");
  if (value.authority !== "plotpickle-agent-compute") {
    throw new Error("Pi developer routing must be projected from PlotPickle Agent Compute policy.");
  }

  const privacy = Object.freeze({
    localOnly: value.privacy?.localOnly !== false,
    cloudAllowed: value.privacy?.cloudAllowed === true,
    explicitCloudConsent: value.privacy?.explicitCloudConsent === true,
  });
  const authorizedRoutes = Array.isArray(value.authorizedRoutes)
    ? value.authorizedRoutes.map(normalizedRoute)
    : [];
  if (!authorizedRoutes.length) throw new Error("PlotPickle Pi developer routing has no authorized physical route.");

  const selectedRouteId = string(value.selectedRouteId);
  const selected = authorizedRoutes.find((route) => route.id === selectedRouteId);
  if (!selected) throw new Error("PlotPickle Pi selected route is not in the authorized route set.");
  if (!routeAllowedByPrivacy(selected, privacy)) {
    throw new Error("PlotPickle Pi selected route violates the current local/cloud consent policy.");
  }

  return Object.freeze({
    schemaVersion: 1,
    authority: "plotpickle-agent-compute",
    logicalModel: Object.freeze({
      provider: string(value.logicalModel?.provider) || PI_DEVELOPER_LOGICAL_MODEL.provider,
      model: string(value.logicalModel?.model) || PI_DEVELOPER_LOGICAL_MODEL.model,
    }),
    selectedRouteId,
    authorizedRoutes: Object.freeze(authorizedRoutes),
    privacy,
    classifier: normalizedClassifier(value.classifier),
  });
}

export function buildPiDeveloperRouteProjection({
  localRoute,
  cloudRoute = null,
  localOnly = true,
  explicitCloudConsent = false,
  preferCloud = false,
  classifier = null,
} = {}) {
  const routes = [normalizedRoute({ ...localRoute, locality: "local", ready: localRoute?.ready !== false }, 0)];
  const cloudEnabled = Boolean(cloudRoute)
    && localOnly !== true
    && explicitCloudConsent === true;
  if (cloudRoute) {
    routes.push(normalizedRoute({ ...cloudRoute, locality: "cloud", ready: cloudRoute.ready !== false }, 1));
  }
  const selectedRouteId = preferCloud && cloudEnabled
    ? routes.find((route) => route.locality === "cloud")?.id || routes[0].id
    : routes[0].id;

  return normalizePiDeveloperRouteProjection({
    schemaVersion: 1,
    authority: "plotpickle-agent-compute",
    logicalModel: PI_DEVELOPER_LOGICAL_MODEL,
    selectedRouteId,
    authorizedRoutes: routes,
    privacy: {
      localOnly: localOnly === true,
      cloudAllowed: cloudEnabled,
      explicitCloudConsent: explicitCloudConsent === true,
    },
    classifier,
  });
}

export function readPiDeveloperRouteProjection(source = process.env[PI_DEVELOPER_ROUTE_ENV]) {
  const text = string(source);
  if (!text) throw new Error(`${PI_DEVELOPER_ROUTE_ENV} is required for the PlotPickle developer virtual model.`);
  return normalizePiDeveloperRouteProjection(JSON.parse(text));
}

export function classifierMayDecide(kind) {
  const normalized = string(kind);
  return PI_CLASSIFIER_ALLOWED_DECISIONS.includes(normalized)
    && !PI_CLASSIFIER_FORBIDDEN_DECISIONS.includes(normalized);
}

function stickyRoute(request, routes, privacy) {
  const sticky = request?.reason === "retry" ? request?.failed : request?.previous;
  const model = sticky?.model;
  if (!model?.provider || !model?.id) return null;
  return routes.find((route) => (
    route.provider === model.provider
    && route.model === model.id
    && routeAllowedByPrivacy(route, privacy)
  )) || null;
}

export function choosePiDeveloperPhysicalRoute({
  projection,
  request = {},
  classifierChoice = "",
} = {}) {
  const policy = normalizePiDeveloperRouteProjection(projection);
  if (request.reason !== "user") {
    const sticky = stickyRoute(request, policy.authorizedRoutes, policy.privacy);
    if (sticky) return sticky;
  }

  const allowed = policy.authorizedRoutes.filter((route) => routeAllowedByPrivacy(route, policy.privacy));
  if (!allowed.length) throw new Error("PlotPickle Pi developer routing has no ready route allowed by current policy.");

  if (classifierChoice === "complex" && policy.classifier?.decisionKinds.includes("complexity")) {
    const complex = allowed.find((route) => route.purpose === "complex");
    if (complex) return complex;
  }
  if (classifierChoice === "read-only" && policy.classifier?.decisionKinds.includes("read-only-sufficiency")) {
    const readOnly = allowed.find((route) => route.purpose === "read-only");
    if (readOnly) return readOnly;
  }

  return allowed.find((route) => route.id === policy.selectedRouteId) || allowed[0];
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function safePiDeveloperRouteEvidence({
  projection,
  physicalRoute,
  usage = {},
} = {}) {
  const policy = normalizePiDeveloperRouteProjection(projection);
  const route = normalizedRoute(physicalRoute, 0);
  if (!policy.authorizedRoutes.some((item) => item.id === route.id && item.provider === route.provider && item.model === route.model)) {
    throw new Error("Physical Pi route is not authorized by the current PlotPickle projection.");
  }
  return {
    logicalProviderId: policy.logicalModel.provider,
    logicalModelId: policy.logicalModel.model,
    providerId: route.provider,
    modelId: route.model,
    thinkingLevel: route.thinkingLevel,
    inputTokens: finiteNumber(usage.inputTokens),
    outputTokens: finiteNumber(usage.outputTokens),
    cachedTokens: finiteNumber(usage.cachedTokens),
    estimatedCost: finiteNumber(usage.estimatedCost),
    authority: policy.authority,
  };
}
