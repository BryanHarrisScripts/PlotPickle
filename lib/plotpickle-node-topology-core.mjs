const CAPABILITIES = Object.freeze([
  "client",
  "host",
  "text",
  "vision",
  "image",
  "video",
  "retrieval",
  "agents",
  "community",
]);

const TRUST_SCOPES = Object.freeze(["local", "lan", "internet"]);
const NODE_MODES = Object.freeze(["desktop", "studio-host", "compute", "hybrid"]);
const READINESS_STATES = Object.freeze(["ready", "degraded", "offline", "unknown"]);

export const PLOTPICKLE_NODE_CAPABILITIES = CAPABILITIES;
export const PLOTPICKLE_NODE_TRUST_SCOPES = TRUST_SCOPES;
export const PLOTPICKLE_NODE_MODES = NODE_MODES;
export const PLOTPICKLE_NODE_READINESS = READINESS_STATES;

function assertChoice(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} is not supported: ${String(value)}`);
}

function normalizedHostname(hostname) {
  return String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
}

export function isLoopbackNodeHostname(hostname) {
  const value = normalizedHostname(hostname);
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function isPrivateIpv4(hostname) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return false;
  if (octets[0] === 10) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  return false;
}

export function isPrivateLanNodeHostname(hostname) {
  const value = normalizedHostname(hostname);
  if (!value || isLoopbackNodeHostname(value)) return false;
  if (isPrivateIpv4(value)) return true;
  if (value.endsWith(".local")) return true;
  if (!value.includes(".") && !value.includes(":")) return true;
  return value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

export function normalizePlotPickleNodeEndpoint(value, trustScope) {
  assertChoice(trustScope, TRUST_SCOPES, "PlotPickle node trust scope");
  const endpointValue = String(value);
  if (!URL.canParse(endpointValue)) {
    throw new Error("PlotPickle node endpoint must be a valid absolute URL.");
  }
  const url = new URL(endpointValue);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PlotPickle node endpoints must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("PlotPickle node endpoint URLs cannot contain credentials.");
  }
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) {
    throw new Error("PlotPickle node endpoints must be an origin only, without a path, query, or fragment.");
  }

  if (trustScope === "local" && !isLoopbackNodeHostname(url.hostname)) {
    throw new Error("Local PlotPickle nodes must use a loopback endpoint.");
  }
  if (trustScope === "lan" && !isPrivateLanNodeHostname(url.hostname)) {
    throw new Error("LAN PlotPickle nodes must use a private/local-network hostname or address.");
  }
  if (trustScope === "internet") {
    if (url.protocol !== "https:") throw new Error("Internet-facing PlotPickle nodes require HTTPS.");
    if (isLoopbackNodeHostname(url.hostname) || isPrivateLanNodeHostname(url.hostname)) {
      throw new Error("Internet-facing PlotPickle nodes cannot use loopback or private-LAN endpoints.");
    }
  }

  return url.origin;
}

function normalizedCapabilities(values) {
  if (!Array.isArray(values)) throw new Error("PlotPickle node capabilities must be an array.");
  const unique = [];
  for (const value of values) {
    assertChoice(value, CAPABILITIES, "PlotPickle node capability");
    if (!unique.includes(value)) unique.push(value);
  }
  return unique;
}

export function normalizePlotPickleNodeDescriptor(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("PlotPickle node descriptor must be an object.");
  }
  const id = String(input.id || "").trim();
  const label = String(input.label || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(id)) throw new Error("PlotPickle node id must be a stable 2-63 character identifier.");
  if (!label) throw new Error("PlotPickle node label is required.");
  assertChoice(input.mode, NODE_MODES, "PlotPickle node mode");
  assertChoice(input.trustScope, TRUST_SCOPES, "PlotPickle node trust scope");
  assertChoice(input.readiness, READINESS_STATES, "PlotPickle node readiness");

  const endpoint = normalizePlotPickleNodeEndpoint(input.endpoint, input.trustScope);
  const capabilities = normalizedCapabilities(input.capabilities);
  const hardware = input.hardware && typeof input.hardware === "object" && !Array.isArray(input.hardware)
    ? {
        platform: String(input.hardware.platform || "unknown"),
        architecture: String(input.hardware.architecture || "unknown"),
        cpuModel: String(input.hardware.cpuModel || ""),
        ramGb: Number(input.hardware.ramGb || 0),
        gpuName: String(input.hardware.gpuName || ""),
        gpuGeneration: String(input.hardware.gpuGeneration || ""),
        gpuMemoryGb: Number(input.hardware.gpuMemoryGb || 0),
        memoryModel: ["system", "discrete", "unified", "unknown"].includes(input.hardware.memoryModel)
          ? input.hardware.memoryModel
          : "unknown",
      }
    : null;

  return Object.freeze({
    id,
    label,
    mode: input.mode,
    trustScope: input.trustScope,
    endpoint,
    enabled: input.enabled === true,
    readiness: input.readiness,
    capabilities: Object.freeze(capabilities),
    hardware: hardware ? Object.freeze(hardware) : null,
  });
}

export function createLocalDesktopPlotPickleNode(input = {}) {
  const capabilities = ["client", "host", "agents", "community"];
  if (input.textReady) capabilities.push("text");
  if (input.visionReady) capabilities.push("vision");
  if (input.imageReady) capabilities.push("image");
  if (input.videoReady) capabilities.push("video");
  if (input.retrievalReady) capabilities.push("retrieval");

  return normalizePlotPickleNodeDescriptor({
    id: input.id || "local-desktop",
    label: input.label || "This PlotPickle",
    mode: "desktop",
    trustScope: "local",
    endpoint: input.endpoint || "http://127.0.0.1:4173",
    enabled: true,
    readiness: input.readiness || "ready",
    capabilities,
    hardware: input.hardware || null,
  });
}

function routeRank(node) {
  const trust = node.trustScope === "local" ? 0 : node.trustScope === "lan" ? 100 : 200;
  const mode = node.mode === "hybrid" ? 0 : node.mode === "compute" ? 5 : node.mode === "desktop" ? 10 : 15;
  return trust + mode;
}

export function selectPlotPickleNode(nodes, request = {}) {
  const requiredCapabilities = normalizedCapabilities(request.capabilities || []);
  const allowInternet = request.allowInternet === true;
  const allowDegraded = request.allowDegraded === true;
  const allowedTrustScopes = Array.isArray(request.allowedTrustScopes) && request.allowedTrustScopes.length
    ? request.allowedTrustScopes
    : ["local", "lan"];
  for (const scope of allowedTrustScopes) assertChoice(scope, TRUST_SCOPES, "Allowed PlotPickle node trust scope");

  const candidates = nodes
    .map(normalizePlotPickleNodeDescriptor)
    .filter((node) => node.enabled)
    .filter((node) => node.readiness === "ready" || (allowDegraded && node.readiness === "degraded"))
    .filter((node) => allowedTrustScopes.includes(node.trustScope))
    .filter((node) => node.trustScope !== "internet" || allowInternet)
    .filter((node) => requiredCapabilities.every((capability) => node.capabilities.includes(capability)))
    .sort((left, right) => routeRank(left) - routeRank(right) || left.id.localeCompare(right.id));

  return candidates[0] || null;
}
