import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { diagnoseComfyUI, launchComfyWithManagedCli } from "./comfyui-connection-diagnostics";

const execFileAsync = promisify(execFile);
const START_PATH = "/api/media-routing/comfyui/start";
const LOCAL_COMFY_URL = "http://127.0.0.1:8188";
const COMFY_DOWNLOAD_URL = "https://comfy.org/download";
const READY_STATES = new Set(["ready-existing", "mcp-managed-started-ready", "desktop-started-ready", "started-ready"]);
const MANAGED_STOPPED_STATES = new Set(["desktop-managed-engine-stopped"]);
const INSTALLED_TOOL_STATES = new Set(["detected", "installed-api-not-ready", "installed", "installed-not-running"]);

type StarterResult = { ready: boolean; state: string; manager: string; detail: string; message: string };
type StartAttempt = StarterResult & { attemptedAt: string };

let lastStartAttempt: StartAttempt | null = null;

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 8 * 1024) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The ComfyUI setup request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid ComfyUI setup request.");
  return parsed as Record<string, unknown>;
}

function marker(output: string, name: string) {
  const prefix = `${name}=`;
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith(prefix)) return line.slice(prefix.length).trim();
  }
  return "";
}

function outputExcerpt(output: string) {
  return output
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-10)
    .join(" | ")
    .slice(0, 1800);
}

function rememberStart(result: StarterResult): StartAttempt {
  const attempt = { ...result, attemptedAt: new Date().toISOString() };
  lastStartAttempt = attempt;
  return attempt;
}

function setupMessage(state: string, detail: string) {
  if (state === "mcp-managed-starting") {
    return "The managed ComfyUI workspace launched through comfy-cli, but its API is still starting. Leave PlotPickle open and retry shortly.";
  }
  if (state === "not-installed") {
    return "PlotPickle could not find a managed ComfyUI workspace or ComfyUI Desktop. Install ComfyUI Desktop or configure a comfy-cli workspace once, then retry.";
  }
  if (state === "desktop-no-managed-instance") {
    return "ComfyUI Desktop is installed, but PlotPickle could not find a registered managed engine to run headlessly. Open ComfyUI Desktop once and create or select its local instance; PlotPickle will manage that engine afterward.";
  }
  if (state === "desktop-instance-provisioning") {
    return "ComfyUI Desktop has a local instance that is still provisioning. Finish that one-time instance setup, then PlotPickle can manage the engine headlessly.";
  }
  if (state === "desktop-opened-api-not-ready") {
    return "ComfyUI Desktop opened, but its local API is not ready yet. Finish any visible first-run or local-instance setup in ComfyUI Desktop, then retry. PlotPickle did not download H3 or other optional model packs.";
  }
  if (state === "desktop-launch-failed") return "PlotPickle found ComfyUI Desktop but could not open it. Open ComfyUI Desktop manually for one-time repair, then retry.";
  if (state === "installed-entrypoint-not-found") return "ComfyUI appears to be installed, but PlotPickle could not find a runnable local entry point. Repair the local workspace once, then retry.";
  if (state === "python-not-found") return "A classic ComfyUI installation was found without its Python runtime. Repair that ComfyUI installation, then retry.";
  return detail || "ComfyUI did not become ready. Confirm the managed local engine can use port 8188, then retry.";
}

async function waitForComfyApi(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await fetch(`${LOCAL_COMFY_URL}/system_stats`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2_500),
    }).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return false;
}

async function inspectInstalledComfyUi() {
  const diagnostics = await diagnoseComfyUI(LOCAL_COMFY_URL, null);
  if (diagnostics.serviceReady) {
    return {
      installed: true,
      running: true,
      canStart: false,
      state: "ready-existing",
      detail: "ComfyUI is installed and its managed local API is running.",
      location: LOCAL_COMFY_URL,
      officialDownloadUrl: COMFY_DOWNLOAD_URL,
      diagnostics,
    };
  }

  if (process.platform !== "win32") {
    return {
      installed: false,
      running: false,
      canStart: false,
      state: "not-detected",
      detail: "PlotPickle could not verify an installed managed ComfyUI engine from this platform. Start ComfyUI locally or use its official installer.",
      location: "",
      officialDownloadUrl: COMFY_DOWNLOAD_URL,
      diagnostics,
    };
  }

  const script = path.resolve(process.cwd(), "scripts", "install-local-ai-tool.ps1");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", script,
    "-Tool", "ComfyUI",
    "-CheckOnly",
  ];
  let stdout = "";
  let stderr = "";
  try {
    const result = await execFileAsync("powershell.exe", args, {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 512 * 1024,
    });
    stdout = String(result.stdout || "");
    stderr = String(result.stderr || "");
  } catch (error) {
    const value = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
    stdout = String(value.stdout || "");
    stderr = String(value.stderr || value.message || "");
  }

  const combined = `${stdout}\n${stderr}`;
  const toolState = marker(combined, "PLOTPICKLE_LOCAL_AI_STATUS") || "missing";
  const location = marker(combined, "PLOTPICKLE_LOCAL_AI_LOCATION");
  const detail = marker(combined, "PLOTPICKLE_LOCAL_AI_DETAIL");
  const installed = INSTALLED_TOOL_STATES.has(toolState);
  return {
    installed,
    running: false,
    canStart: installed,
    state: installed ? "installed-stopped" : "not-installed",
    detail: detail || (installed
      ? "ComfyUI is installed, but its managed local API is stopped."
      : "ComfyUI Desktop is not installed on this Windows profile."),
    location,
    officialDownloadUrl: COMFY_DOWNLOAD_URL,
    diagnostics,
  };
}

async function runWindowsStarter(allowDesktopLaunch: boolean): Promise<StarterResult> {
  const script = path.resolve(process.cwd(), "scripts", "start-comfyui-background.ps1");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", script,
    "-BaseUrl", LOCAL_COMFY_URL,
    "-ReadyTimeoutSeconds", "90",
    ...(allowDesktopLaunch ? ["-AllowDesktopLaunch"] : []),
  ];

  let stdout = "";
  let stderr = "";
  try {
    const result = await execFileAsync("powershell.exe", args, {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    stdout = String(result.stdout || "");
    stderr = String(result.stderr || "");
  } catch (error) {
    const value = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
    stdout = String(value.stdout || "");
    stderr = String(value.stderr || value.message || "");
  }

  const combined = `${stdout}\n${stderr}`;
  const state = marker(combined, "PLOTPICKLE_COMFYUI_STATUS") || "unknown";
  const markerDetail = marker(combined, "PLOTPICKLE_COMFYUI_DETAIL");
  const detail = markerDetail || outputExcerpt(stderr) || outputExcerpt(stdout);
  return {
    ready: READY_STATES.has(state),
    state,
    manager: allowDesktopLaunch ? "managed-desktop-instance" : "managed-local-probe",
    detail,
    message: setupMessage(state, detail),
  };
}

async function startWithManagedLocalRuntime() {
  if (process.platform !== "win32") {
    throw new Error("Automatic managed ComfyUI startup is currently available on Windows only. Start ComfyUI locally, then retry.");
  }

  // First pass is headless-only. It may discover an already-running/classic engine,
  // or prove that a Comfy Desktop managed instance exists without ever opening Desktop.
  const inspected = await runWindowsStarter(false);
  if (inspected.ready) return inspected;
  if (!MANAGED_STOPPED_STATES.has(inspected.state)) return inspected;

  // The second pass is allowed to enter the existing managed-instance branch. Because
  // the first pass proved that exact managed engine exists, start-comfyui-background.ps1
  // launches its Python process hidden before any Desktop UI fallback can be reached.
  return runWindowsStarter(true);
}

async function startComfyUi(): Promise<StarterResult> {
  const existing = await diagnoseComfyUI(LOCAL_COMFY_URL, null);
  if (existing.serviceReady) {
    return {
      ready: true,
      state: "ready-existing",
      manager: existing.management.ready ? "comfy-mcp" : "direct-api",
      detail: existing.management.message,
      message: "ComfyUI is already running locally. PlotPickle will use the fixed local image contract at 127.0.0.1:8188.",
    };
  }

  const managed = await launchComfyWithManagedCli();
  if (managed.attempted && managed.ready) {
    const apiReady = await waitForComfyApi();
    const state = apiReady ? "mcp-managed-started-ready" : "mcp-managed-starting";
    return {
      ready: apiReady,
      state,
      manager: "comfy-cli",
      detail: managed.message,
      message: apiReady
        ? "comfy-cli started the managed local ComfyUI service. PlotPickle will now verify SDXL 1.0 readiness."
        : setupMessage(state, managed.message),
    };
  }

  return startWithManagedLocalRuntime();
}

export function registerComfyUiOnboardingGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== START_PATH) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "ComfyUI setup is available only from this local PlotPickle server." });
      return;
    }
    if (request.method === "GET") {
      void inspectInstalledComfyUi().then(
        (installation) => sendJson(response, 200, { ok: true, installation, lastStart: lastStartAttempt }),
        (error) => sendJson(response, 500, { ok: false, message: error instanceof Error ? error.message : "ComfyUI installation status could not be checked." }),
      );
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, message: "Use GET to inspect ComfyUI or POST to start its managed local service." });
      return;
    }

    void (async () => {
      try {
        const body = await readBody(request);
        if (body.approved !== true) {
          sendJson(response, 400, { ok: false, message: "PlotPickle needs approval before starting the managed local ComfyUI service." });
          return;
        }
        const attempt = rememberStart(await startComfyUi());
        if (!attempt.ready) {
          sendJson(response, 409, { ok: false, ...attempt });
          return;
        }
        sendJson(response, 200, { ok: true, ...attempt });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "The managed ComfyUI service could not be started.";
        const attempt = rememberStart({
          ready: false,
          state: "gateway-error",
          manager: "onboarding-gateway",
          detail,
          message: detail,
        });
        sendJson(response, 500, { ok: false, ...attempt });
      }
    })();
  });
}
