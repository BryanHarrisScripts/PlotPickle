import type { ComfyWorkflow } from "./media-routing-store";

const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const DEFAULT_PORT = "8188";
const REQUEST_TIMEOUT_MS = 5_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const REQUIRED_IMAGE_NODES = [
  "CheckpointLoaderSimple",
  "CLIPTextEncode",
  "EmptyLatentImage",
  "KSampler",
  "VAEDecode",
  "SaveImage",
] as const;

export type ComfyConnectionState = "ready" | "running-setup" | "not-listening" | "timeout" | "invalid-response";

export type ComfyConnectionDiagnostic = {
  reachable: boolean;
  serviceReady: boolean;
  connectionState: ComfyConnectionState;
  baseUrl: string;
  attemptedUrls: string[];
  version: string;
  checkpoints: string[];
  imageNodesReady: boolean;
  missingImageNodes: string[];
  workflowNodesReady: boolean;
  missingWorkflowNodes: string[];
  checkedAt: string;
  latencyMs: number;
  error: string;
  capabilityError: string;
  repairGuidance: string;
};

function loopbackHost(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export function normalizeLocalComfyUrl(value: unknown) {
  const source = typeof value === "string" ? value.trim() : "";
  let url: URL;
  try {
    url = new URL(source || DEFAULT_BASE_URL);
  } catch {
    throw new Error("Enter a complete local ComfyUI address, such as http://127.0.0.1:8188.");
  }
  if (url.protocol !== "http:" || !loopbackHost(url.hostname)) {
    throw new Error("ComfyUI must use a local loopback address such as http://127.0.0.1:8188, http://localhost:8188 or http://[::1]:8188.");
  }
  if (url.username || url.password || (url.pathname && url.pathname !== "/") || url.search || url.hash) {
    throw new Error("Enter only the local ComfyUI server address, without credentials, a path, query or fragment.");
  }
  const port = url.port || DEFAULT_PORT;
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65_535) {
    throw new Error("Enter a valid local ComfyUI port between 1 and 65535.");
  }
  return `${url.protocol}//${url.hostname}:${port}`;
}

export function localComfyCandidates(value: unknown) {
  const configured = normalizeLocalComfyUrl(value);
  const configuredUrl = new URL(configured);
  const port = configuredUrl.port || DEFAULT_PORT;
  return [...new Set([
    configured,
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://[::1]:${port}`,
  ])];
}

async function requestJson(baseUrl: string, pathname: string) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch {
    throw new Error(`ComfyUI returned invalid JSON from ${pathname}.`);
  }
  if (!response.ok) throw new Error(`ComfyUI returned HTTP ${response.status} from ${pathname}.`);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`ComfyUI returned invalid JSON from ${pathname}.`);
  return value as Record<string, unknown>;
}

function checkpointNames(body: Record<string, unknown>) {
  const loader = body.CheckpointLoaderSimple;
  if (!loader || typeof loader !== "object" || Array.isArray(loader)) return [];
  const input = (loader as Record<string, unknown>).input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const required = (input as Record<string, unknown>).required;
  if (!required || typeof required !== "object" || Array.isArray(required)) return [];
  const checkpoint = (required as Record<string, unknown>).ckpt_name;
  if (!Array.isArray(checkpoint) || !Array.isArray(checkpoint[0])) return [];
  return checkpoint[0].filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
}

async function nodeExists(baseUrl: string, name: string) {
  try {
    const value = await requestJson(baseUrl, `/object_info/${encodeURIComponent(name)}`);
    return Boolean(value[name]);
  } catch {
    return false;
  }
}

function connectionState(error: unknown): Exclude<ComfyConnectionState, "ready" | "running-setup"> {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  if (error instanceof Error) {
    if (/fetch failed|ECONNREFUSED|ECONNRESET|ENETUNREACH|connect/i.test(error.message)) return "not-listening";
    if (/HTTP \d+|invalid JSON/i.test(error.message)) return "invalid-response";
  }
  return "not-listening";
}

function connectionError(state: Exclude<ComfyConnectionState, "ready" | "running-setup">, attemptedUrls: string[], error: unknown) {
  const addresses = attemptedUrls.join(", ");
  if (state === "timeout") {
    return `No ComfyUI API answered before the five-second timeout at ${addresses}. ComfyUI may be installed but still starting.`;
  }
  if (state === "invalid-response") {
    const detail = error instanceof Error ? error.message : "The local service returned an unexpected response.";
    return `A local service answered at ${attemptedUrls.at(-1) || addresses}, but it did not respond like the ComfyUI API: ${detail}`;
  }
  return `No ComfyUI API service is listening at ${addresses}. ComfyUI may be installed but not running, or it may be using another local port.`;
}

function repairGuidance(state: Exclude<ComfyConnectionState, "ready" | "running-setup">) {
  if (state === "timeout") return "Wait until the ComfyUI terminal says the server is listening, then retry. If startup completed on another port, enter that loopback address above.";
  if (state === "invalid-response") return "Confirm the address points to ComfyUI itself, without a path or proxy, then retry.";
  return "Start ComfyUI and wait for its terminal to show the local address. If it is not port 8188, enter the displayed loopback port above and retry.";
}

export async function diagnoseComfyUI(baseUrlValue: unknown, workflow: ComfyWorkflow | null): Promise<ComfyConnectionDiagnostic> {
  const candidates = localComfyCandidates(baseUrlValue);
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const attemptedUrls: string[] = [];
  let baseUrl = candidates[0] || DEFAULT_BASE_URL;
  let system: Record<string, unknown> | null = null;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    attemptedUrls.push(candidate);
    try {
      system = await requestJson(candidate, "/system_stats");
      baseUrl = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!system) {
    const state = connectionState(lastError);
    return {
      reachable: false,
      serviceReady: false,
      connectionState: state,
      baseUrl: candidates[0] || DEFAULT_BASE_URL,
      attemptedUrls,
      version: "",
      checkpoints: [],
      imageNodesReady: false,
      missingImageNodes: [...REQUIRED_IMAGE_NODES],
      workflowNodesReady: false,
      missingWorkflowNodes: workflow?.nodeClasses ?? [],
      checkedAt,
      latencyMs: Date.now() - started,
      error: connectionError(state, attemptedUrls, lastError),
      capabilityError: "",
      repairGuidance: repairGuidance(state),
    };
  }

  const info = system.system && typeof system.system === "object" && !Array.isArray(system.system)
    ? system.system as Record<string, unknown>
    : {};
  const loader = await requestJson(baseUrl, "/object_info/CheckpointLoaderSimple").catch(() => ({}));
  const imageChecks = await Promise.all(REQUIRED_IMAGE_NODES.map(async (name) => ({ name, exists: await nodeExists(baseUrl, name) })));
  const workflowChecks = workflow
    ? await Promise.all(workflow.nodeClasses.map(async (name) => ({ name, exists: await nodeExists(baseUrl, name) })))
    : [];
  const missingImageNodes = imageChecks.filter((item) => !item.exists).map((item) => item.name);
  const missingWorkflowNodes = workflowChecks.filter((item) => !item.exists).map((item) => item.name);
  const checkpoints = checkpointNames(loader);
  const capabilityProblems = [
    missingImageNodes.length ? `missing image nodes: ${missingImageNodes.join(", ")}` : "",
    checkpoints.length ? "" : "no checkpoints were reported",
    workflow && missingWorkflowNodes.length ? `missing workflow nodes: ${missingWorkflowNodes.join(", ")}` : "",
  ].filter(Boolean);
  const ready = capabilityProblems.length === 0;

  return {
    reachable: true,
    serviceReady: true,
    connectionState: ready ? "ready" : "running-setup",
    baseUrl,
    attemptedUrls,
    version: typeof info.comfyui_version === "string" ? info.comfyui_version : "",
    checkpoints,
    imageNodesReady: missingImageNodes.length === 0,
    missingImageNodes,
    workflowNodesReady: Boolean(workflow) && missingWorkflowNodes.length === 0,
    missingWorkflowNodes,
    checkedAt,
    latencyMs: Date.now() - started,
    error: "",
    capabilityError: ready
      ? ""
      : `ComfyUI is running, but PlotPickle is not ready to generate yet: ${capabilityProblems.join("; ")}.`,
    repairGuidance: ready
      ? "ComfyUI is responding and the required local image capabilities are available."
      : "Keep ComfyUI running, install or enable the listed checkpoint and nodes, then retry the diagnostic.",
  };
}
