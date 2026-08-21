import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { diagnoseComfyUI, launchComfyWithManagedCli } from "./comfyui-connection-diagnostics";

const execFileAsync = promisify(execFile);
const START_PATH = "/api/media-routing/comfyui/start";
const LOCAL_COMFY_URL = "http://127.0.0.1:8188";
const READY_STATES = new Set(["ready-existing", "mcp-managed-started-ready", "desktop-started-ready", "started-ready"]);

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

function setupMessage(state: string, detail: string) {
  if (state === "mcp-managed-starting") {
    return "The Comfy MCP management stack launched the local workspace, but its API is still starting. Leave PlotPickle open and retry the connection check shortly.";
  }
  if (state === "not-installed") {
    return "PlotPickle could not find a managed ComfyUI workspace or ComfyUI Desktop. Install either the optional Comfy MCP/comfy-cli stack with a local workspace, or ComfyUI Desktop, then retry.";
  }
  if (state === "desktop-opened-api-not-ready") {
    return "ComfyUI Desktop opened, but its local API is not ready yet. Finish any visible first-run or local-instance setup in ComfyUI Desktop, start the local instance, then choose ComfyUI again. PlotPickle did not download H3 or other optional model packs.";
  }
  if (state === "desktop-launch-failed") return "PlotPickle found ComfyUI Desktop but could not open it. Open ComfyUI Desktop manually, then retry from Settings.";
  if (state === "installed-entrypoint-not-found") return "ComfyUI appears to be installed, but PlotPickle could not find a runnable local entry point. Repair the local workspace or open ComfyUI Desktop, then retry.";
  if (state === "python-not-found") return "A classic ComfyUI installation was found without its Python runtime. Repair that ComfyUI installation or use ComfyUI Desktop, then retry.";
  return detail || "ComfyUI did not become ready. Confirm the local instance is running on port 8188, then retry.";
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

async function startWithDesktopFallback() {
  if (process.platform !== "win32") {
    throw new Error("Automatic fallback startup without the optional Comfy MCP management stack is currently available on Windows only. Start ComfyUI locally, then retry from Settings.");
  }
  const script = path.resolve(process.cwd(), "scripts", "start-comfyui-background.ps1");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", script,
    "-BaseUrl", LOCAL_COMFY_URL,
    "-ReadyTimeoutSeconds", "90",
    "-AllowDesktopLaunch",
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
  const detail = marker(combined, "PLOTPICKLE_COMFYUI_DETAIL");
  return { ready: READY_STATES.has(state), state, manager: "desktop-fallback", detail, message: setupMessage(state, detail) };
}

async function startComfyUi() {
  const existing = await diagnoseComfyUI(LOCAL_COMFY_URL, null);
  if (existing.serviceReady) {
    return {
      ready: true,
      state: "ready-existing",
      manager: existing.management.ready ? "comfy-mcp" : "direct-api",
      detail: existing.management.message,
      message: "ComfyUI is already running locally. PlotPickle will verify image nodes and checkpoints before activating it.",
    };
  }

  const managed = await launchComfyWithManagedCli();
  if (managed.attempted && managed.ready) {
    const apiReady = await waitForComfyApi();
    const state = apiReady ? "mcp-managed-started-ready" : "mcp-managed-starting";
    return {
      ready: apiReady,
      state,
      manager: "comfy-mcp",
      detail: managed.message,
      message: apiReady
        ? "The Comfy MCP management stack started the local ComfyUI workspace. PlotPickle will now verify image nodes and checkpoints."
        : setupMessage(state, managed.message),
    };
  }

  return startWithDesktopFallback();
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
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, message: "Use the Settings action to start ComfyUI." });
      return;
    }

    void (async () => {
      try {
        const body = await readBody(request);
        if (body.approved !== true) {
          sendJson(response, 400, { ok: false, message: "PlotPickle needs your permission before opening or starting a local ComfyUI workspace." });
          return;
        }
        const result = await startComfyUi();
        if (!result.ready) {
          sendJson(response, 409, { ok: false, ...result });
          return;
        }
        sendJson(response, 200, { ok: true, ...result });
      } catch (error) {
        sendJson(response, 500, { ok: false, message: error instanceof Error ? error.message : "ComfyUI could not be started." });
      }
    })();
  });
}
