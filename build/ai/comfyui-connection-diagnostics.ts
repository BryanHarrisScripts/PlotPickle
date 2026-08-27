import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ComfyWorkflow } from "../media-routing-store";

const execFileAsync = promisify(execFile);
const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const DEFAULT_PORT = "8188";
const REQUEST_TIMEOUT_MS = 5_000;
const MANAGEMENT_PROBE_TIMEOUT_MS = 4_000;
const MANAGEMENT_OUTPUT_LIMIT = 64 * 1024;
const COMFY_MCP_MINIMUM_CLI_VERSION = "1.14.0";
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

export type ComfyManagementDiagnostic = {
  adapter: "comfy-mcp" | "direct-api";
  ready: boolean;
  mcpInstalled: boolean;
  mcpVersion: string;
  comfyCliInstalled: boolean;
  comfyCliVersion: string;
  minimumComfyCliVersion: string;
  message: string;
};

export type ComfyHardwareDiagnostic = {
  gpuName: string;
  totalVramMb: number | null;
  freeVramMb: number | null;
};

export type ComfySetupBlockerKind = "service" | "checkpoint" | "image-node" | "workflow-node";

export type ComfySetupBlocker = {
  code: string;
  kind: ComfySetupBlockerKind;
  summary: string;
  action: string;
  requiresUserConfirmation: boolean;
};

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
  management: ComfyManagementDiagnostic;
  hardware: ComfyHardwareDiagnostic;
  setupBlockers: ComfySetupBlocker[];
  checkedAt: string;
  latencyMs: number;
  error: string;
  capabilityError: string;
  repairGuidance: string;
};

type ExecutableProbe = { installed: boolean; version: string };

function loopbackHost(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export function normalizeLocalComfyUrl(value: unknown) {
  const source = typeof value === "string" ? value.trim() : "";
  const candidate = source || DEFAULT_BASE_URL;
  if (!URL.canParse(candidate)) {
    throw new Error("Enter a complete local ComfyUI address, such as http://127.0.0.1:8188.");
  }
  const url = new URL(candidate);
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

export function parseComfyToolVersion(value: unknown) {
  const match = String(value ?? "").match(/\b(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?\b/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : "";
}

export function comfyVersionAtLeast(version: string, minimum = COMFY_MCP_MINIMUM_CLI_VERSION) {
  const left = version.split(".").map(Number);
  const right = minimum.split(".").map(Number);
  if (left.length !== 3 || right.length !== 3 || [...left, ...right].some((part) => !Number.isInteger(part) || part < 0)) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}

async function probeExecutableVersion(executable: string): Promise<ExecutableProbe> {
  try {
    const result = await execFileAsync(executable, ["--version"], {
      windowsHide: true,
      timeout: MANAGEMENT_PROBE_TIMEOUT_MS,
      maxBuffer: MANAGEMENT_OUTPUT_LIMIT,
      env: process.env,
    });
    const version = parseComfyToolVersion(`${String(result.stdout || "")}\n${String(result.stderr || "")}`);
    return { installed: true, version };
  } catch {
    return { installed: false, version: "" };
  }
}

export async function diagnoseComfyManagement(): Promise<ComfyManagementDiagnostic> {
  const comfyBin = process.env.COMFY_BIN?.trim() || "comfy";
  const [mcp, cli] = await Promise.all([
    probeExecutableVersion("comfy-mcp"),
    probeExecutableVersion(comfyBin),
  ]);
  const cliReady = cli.installed && comfyVersionAtLeast(cli.version);
  const ready = mcp.installed && cliReady;
  if (ready) {
    return {
      adapter: "comfy-mcp",
      ready: true,
      mcpInstalled: true,
      mcpVersion: mcp.version,
      comfyCliInstalled: true,
      comfyCliVersion: cli.version,
      minimumComfyCliVersion: COMFY_MCP_MINIMUM_CLI_VERSION,
      message: "Comfy MCP management is available. PlotPickle still owns provider choice, consent and generation routing.",
    };
  }
  if (mcp.installed && cli.installed && !cliReady) {
    return {
      adapter: "direct-api",
      ready: false,
      mcpInstalled: true,
      mcpVersion: mcp.version,
      comfyCliInstalled: true,
      comfyCliVersion: cli.version,
      minimumComfyCliVersion: COMFY_MCP_MINIMUM_CLI_VERSION,
      message: `Comfy MCP is installed, but comfy-cli ${COMFY_MCP_MINIMUM_CLI_VERSION} or newer is required. PlotPickle will keep using the direct local ComfyUI API.`,
    };
  }
  if (mcp.installed && !cli.installed) {
    return {
      adapter: "direct-api",
      ready: false,
      mcpInstalled: true,
      mcpVersion: mcp.version,
      comfyCliInstalled: false,
      comfyCliVersion: "",
      minimumComfyCliVersion: COMFY_MCP_MINIMUM_CLI_VERSION,
      message: "Comfy MCP is installed, but its comfy-cli engine is not available to PlotPickle. Direct local ComfyUI support remains available.",
    };
  }
  return {
    adapter: "direct-api",
    ready: false,
    mcpInstalled: false,
    mcpVersion: "",
    comfyCliInstalled: cli.installed,
    comfyCliVersion: cli.version,
    minimumComfyCliVersion: COMFY_MCP_MINIMUM_CLI_VERSION,
    message: "Comfy MCP is optional and is not installed. PlotPickle will use its existing direct local ComfyUI API.",
  };
}

export async function launchComfyWithManagedCli() {
  const management = await diagnoseComfyManagement();
  if (!management.ready) {
    return { attempted: false as const, ready: false as const, management, message: management.message };
  }
  const comfyBin = process.env.COMFY_BIN?.trim() || "comfy";
  try {
    await execFileAsync(comfyBin, ["launch", "--background"], {
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: MANAGEMENT_OUTPUT_LIMIT,
      env: process.env,
    });
    return {
      attempted: true as const,
      ready: true as const,
      management,
      message: "The Comfy MCP management stack launched the local ComfyUI workspace through comfy-cli.",
    };
  } catch {
    return {
      attempted: true as const,
      ready: false as const,
      management,
      message: "Comfy MCP management is installed, but the local ComfyUI workspace could not be launched through comfy-cli. PlotPickle can still use the existing direct/desktop startup path.",
    };
  }
}

async function requestJson(baseUrl: string, pathname: string) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`ComfyUI returned HTTP ${response.status} from ${pathname}.`);
  if (text && !/application\/json/i.test(response.headers.get("content-type") || "")) {
    throw new Error(`ComfyUI returned invalid JSON from ${pathname}.`);
  }
  const value: unknown = text ? JSON.parse(text) : {};
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
  return requestJson(baseUrl, `/object_info/${encodeURIComponent(name)}`).then(
    (value) => Boolean(value[name]),
    () => false,
  );
}

function safeDeviceName(value: unknown) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)
    : "";
}

function bytesToMb(value: unknown) {
  const bytes = typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  return bytes === null ? null : Math.round(bytes / (1024 * 1024));
}

function hardwareFromSystem(system: Record<string, unknown>): ComfyHardwareDiagnostic {
  const devices = Array.isArray(system.devices) ? system.devices : [];
  const device = devices.find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)) as Record<string, unknown> | undefined;
  return {
    gpuName: safeDeviceName(device?.name),
    totalVramMb: bytesToMb(device?.vram_total ?? device?.torch_vram_total),
    freeVramMb: bytesToMb(device?.vram_free ?? device?.torch_vram_free),
  };
}

function unavailableSetupBlockers(state: Exclude<ComfyConnectionState, "ready" | "running-setup">, management: ComfyManagementDiagnostic): ComfySetupBlocker[] {
  if (management.ready) {
    return [{
      code: "comfy-service-stopped",
      kind: "service",
      summary: "The managed ComfyUI workspace is available but its local API is not running.",
      action: "Use Start ComfyUI in Settings. PlotPickle will ask before launching the local workspace.",
      requiresUserConfirmation: true,
    }];
  }
  if (state === "invalid-response") {
    return [{
      code: "comfy-address-not-api",
      kind: "service",
      summary: "A local service answered, but it was not a usable ComfyUI API.",
      action: "Check that the configured loopback address points directly to ComfyUI, without a proxy or extra path.",
      requiresUserConfirmation: false,
    }];
  }
  return [{
    code: state === "timeout" ? "comfy-service-timeout" : "comfy-service-unreachable",
    kind: "service",
    summary: state === "timeout" ? "The local ComfyUI API did not become ready before the diagnostic timeout." : "No local ComfyUI API is listening at the configured loopback address.",
    action: "Start ComfyUI locally, wait until its API is ready, then rerun the diagnostic. If it uses another port, enter that loopback address in Settings.",
    requiresUserConfirmation: true,
  }];
}

function runningSetupBlockers(input: {
  checkpoints: readonly string[];
  missingImageNodes: readonly string[];
  workflow: ComfyWorkflow | null;
  missingWorkflowNodes: readonly string[];
}): ComfySetupBlocker[] {
  const blockers: ComfySetupBlocker[] = [];
  if (!input.checkpoints.length) {
    blockers.push({
      code: "comfy-checkpoint-missing",
      kind: "checkpoint",
      summary: "ComfyUI is running, but no image checkpoint is available to PlotPickle.",
      action: "Choose an installed compatible checkpoint or review PlotPickle's SDXL starter. Any model download requires separate source, size, license, destination and hash approval.",
      requiresUserConfirmation: true,
    });
  }
  if (input.missingImageNodes.length) {
    blockers.push({
      code: "comfy-image-nodes-missing",
      kind: "image-node",
      summary: `Required image nodes are missing: ${input.missingImageNodes.join(", ")}.`,
      action: "Repair or install the required ComfyUI nodes explicitly. PlotPickle will never turn a generation request into an automatic third-party node installation.",
      requiresUserConfirmation: true,
    });
  }
  if (input.workflow && input.missingWorkflowNodes.length) {
    blockers.push({
      code: "comfy-workflow-nodes-missing",
      kind: "workflow-node",
      summary: `The selected reviewed workflow is missing nodes: ${input.missingWorkflowNodes.join(", ")}.`,
      action: "Review the missing workflow dependencies before running it. Any third-party custom-node install requires explicit user confirmation.",
      requiresUserConfirmation: true,
    });
  }
  return blockers;
}

function connectionState(error: unknown): Exclude<ComfyConnectionState, "ready" | "running-setup"> {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  if (error instanceof SyntaxError) return "invalid-response";
  if (error instanceof Error) {
    if (/fetch failed|ECONNREFUSED|ECONNRESET|ENETUNREACH|connect/i.test(error.message)) return "not-listening";
    if (/HTTP \d+|invalid JSON/i.test(error.message)) return "invalid-response";
  }
  return "not-listening";
}

function connectionError(state: Exclude<ComfyConnectionState, "ready" | "running-setup">, attemptedUrls: string[], error: unknown, management: ComfyManagementDiagnostic) {
  const addresses = attemptedUrls.join(", ");
  if (state === "timeout") {
    return `No ComfyUI API answered before the five-second timeout at ${addresses}. ${management.ready ? "Comfy MCP management is installed, so the workspace may simply still be starting." : "ComfyUI may be installed but still starting."}`;
  }
  if (state === "invalid-response") {
    const detail = error instanceof Error ? error.message : "The local service returned an unexpected response.";
    return `A local service answered at ${attemptedUrls.at(-1) || addresses}, but it did not respond like the ComfyUI API: ${detail}`;
  }
  return management.ready
    ? `Comfy MCP management is installed, but no ComfyUI API service is listening at ${addresses}. The local workspace is installed/manageable but not currently serving PlotPickle.`
    : `No ComfyUI API service is listening at ${addresses}. ComfyUI may be installed but not running, or it may be using another local port.`;
}

function repairGuidance(state: Exclude<ComfyConnectionState, "ready" | "running-setup">, management: ComfyManagementDiagnostic) {
  if (state === "timeout") return "Wait until the local ComfyUI service finishes starting, then retry. If startup completed on another port, enter that loopback address above.";
  if (state === "invalid-response") return "Confirm the address points to ComfyUI itself, without a path or proxy, then retry.";
  if (management.ready) return "Comfy MCP management is ready. Use PlotPickle's Start ComfyUI action to launch the managed local workspace, then retry the diagnostic.";
  return "Start ComfyUI and wait for its local server to become ready. If it is not port 8188, enter the displayed loopback port above and retry.";
}

export async function diagnoseComfyUI(baseUrlValue: unknown, workflow: ComfyWorkflow | null): Promise<ComfyConnectionDiagnostic> {
  const candidates = localComfyCandidates(baseUrlValue);
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const managementPromise = diagnoseComfyManagement();
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

  const management = await managementPromise;
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
      management,
      hardware: { gpuName: "", totalVramMb: null, freeVramMb: null },
      setupBlockers: unavailableSetupBlockers(state, management),
      checkedAt,
      latencyMs: Date.now() - started,
      error: connectionError(state, attemptedUrls, lastError, management),
      capabilityError: "",
      repairGuidance: repairGuidance(state, management),
    };
  }

  const info = system.system && typeof system.system === "object" && !Array.isArray(system.system)
    ? system.system as Record<string, unknown>
    : {};
  const loader = await requestJson(baseUrl, "/object_info/CheckpointLoaderSimple").then(
    (value) => value,
    () => ({}),
  );
  const imageChecks = await Promise.all(REQUIRED_IMAGE_NODES.map(async (name) => ({ name, exists: await nodeExists(baseUrl, name) })));
  const workflowChecks = workflow
    ? await Promise.all(workflow.nodeClasses.map(async (name) => ({ name, exists: await nodeExists(baseUrl, name) })))
    : [];
  const missingImageNodes = imageChecks.filter((item) => !item.exists).map((item) => item.name);
  const missingWorkflowNodes = workflowChecks.filter((item) => !item.exists).map((item) => item.name);
  const checkpoints = checkpointNames(loader);
  const setupBlockers = runningSetupBlockers({ checkpoints, missingImageNodes, workflow, missingWorkflowNodes });
  const capabilityProblems = setupBlockers.map((blocker) => blocker.summary);
  const ready = setupBlockers.length === 0;

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
    management,
    hardware: hardwareFromSystem(system),
    setupBlockers,
    checkedAt,
    latencyMs: Date.now() - started,
    error: "",
    capabilityError: ready
      ? ""
      : `ComfyUI is running, but PlotPickle is not ready to generate yet: ${capabilityProblems.join(" ")}`,
    repairGuidance: ready
      ? "ComfyUI is responding and the required local image capabilities are available."
      : setupBlockers.map((blocker) => blocker.action).join(" "),
  };
}
