import type { ComfyWorkflow } from "./media-routing-store";

const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const REQUEST_TIMEOUT_MS = 5_000;
const REQUIRED_IMAGE_NODES = [
  "CheckpointLoaderSimple",
  "CLIPTextEncode",
  "EmptyLatentImage",
  "KSampler",
  "VAEDecode",
  "SaveImage",
] as const;

export type ComfyConnectionDiagnostic = {
  reachable: boolean;
  serviceReady: boolean;
  baseUrl: string;
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
};

export function normalizeLocalComfyUrl(value: unknown) {
  const source = typeof value === "string" ? value.trim() : "";
  const url = new URL(source || DEFAULT_BASE_URL);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]" || url.hostname === "::1";
  if (url.protocol !== "http:" || !loopback || (url.port || "8188") !== "8188") {
    throw new Error("ComfyUI must use a local address on port 8188, such as http://127.0.0.1:8188 or http://localhost:8188.");
  }
  if (url.username || url.password || (url.pathname && url.pathname !== "/")) {
    throw new Error("Enter only the local ComfyUI server address, without credentials or a path.");
  }
  return DEFAULT_BASE_URL;
}

async function requestJson(baseUrl: string, pathname: string) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
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

function connectionError(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "ComfyUI did not answer before the five-second timeout. Start ComfyUI and wait until its terminal says the server is listening on port 8188.";
  }
  if (error instanceof Error) {
    if (/fetch failed|ECONNREFUSED|connect/i.test(error.message)) {
      return "ComfyUI is not reachable on port 8188. Start ComfyUI, then test again.";
    }
    return error.message.slice(0, 400);
  }
  return "ComfyUI could not be checked.";
}

export async function diagnoseComfyUI(baseUrlValue: unknown, workflow: ComfyWorkflow | null): Promise<ComfyConnectionDiagnostic> {
  const baseUrl = normalizeLocalComfyUrl(baseUrlValue);
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  let system: Record<string, unknown>;
  try {
    system = await requestJson(baseUrl, "/system_stats");
  } catch (error) {
    return {
      reachable: false,
      serviceReady: false,
      baseUrl,
      version: "",
      checkpoints: [],
      imageNodesReady: false,
      missingImageNodes: [...REQUIRED_IMAGE_NODES],
      workflowNodesReady: false,
      missingWorkflowNodes: workflow?.nodeClasses ?? [],
      checkedAt,
      latencyMs: Date.now() - started,
      error: connectionError(error),
      capabilityError: "",
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

  return {
    reachable: true,
    serviceReady: true,
    baseUrl,
    version: typeof info.comfyui_version === "string" ? info.comfyui_version : "",
    checkpoints,
    imageNodesReady: missingImageNodes.length === 0,
    missingImageNodes,
    workflowNodesReady: Boolean(workflow) && missingWorkflowNodes.length === 0,
    missingWorkflowNodes,
    checkedAt,
    latencyMs: Date.now() - started,
    error: "",
    capabilityError: capabilityProblems.length
      ? `ComfyUI is running, but PlotPickle is not ready to generate yet: ${capabilityProblems.join("; ")}.`
      : "",
  };
}
