import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";

const execFileAsync = promisify(execFile);
const START_PATH = "/api/media-routing/comfyui/start";
const READY_STATES = new Set(["ready-existing", "desktop-started-ready", "started-ready"]);

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
  const match = output.match(new RegExp(`^${name}=([^\\r\\n]+)$`, "m"));
  return match?.[1]?.trim() || "";
}

function setupMessage(state: string, detail: string) {
  if (state === "not-installed") {
    return "ComfyUI Desktop is not installed. Install ComfyUI Desktop first, then return to Settings and choose ComfyUI again.";
  }
  if (state === "desktop-opened-api-not-ready") {
    return "ComfyUI Desktop opened, but its local API is not ready yet. Finish any visible first-run or local-instance setup in ComfyUI Desktop, start the local instance, then choose ComfyUI again. PlotPickle did not download H3 or other optional model packs.";
  }
  if (state === "desktop-launch-failed") return "PlotPickle found ComfyUI Desktop but could not open it. Open ComfyUI Desktop manually, then retry from Settings.";
  if (state === "installed-entrypoint-not-found") return "ComfyUI appears to be installed, but PlotPickle could not find a runnable Desktop or classic local entry point. Open ComfyUI Desktop and complete its local installation, then retry.";
  if (state === "python-not-found") return "A classic ComfyUI installation was found without its Python runtime. Repair that ComfyUI installation or use ComfyUI Desktop, then retry.";
  return detail || "ComfyUI did not become ready. Open ComfyUI Desktop, confirm the local instance is running on port 8188, then retry.";
}

async function startComfyUi() {
  if (process.platform !== "win32") {
    throw new Error("Automatic ComfyUI Desktop startup is currently available on Windows. Start ComfyUI locally on port 8188, then retry from Settings.");
  }
  const script = path.resolve(process.cwd(), "scripts", "start-comfyui-background.ps1");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", script,
    "-BaseUrl", "http://127.0.0.1:8188",
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
  return { ready: READY_STATES.has(state), state, detail, message: setupMessage(state, detail) };
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
          sendJson(response, 400, { ok: false, message: "PlotPickle needs your permission before opening or starting ComfyUI Desktop." });
          return;
        }
        const result = await startComfyUi();
        if (!result.ready) {
          sendJson(response, 409, { ok: false, ...result });
          return;
        }
        sendJson(response, 200, { ok: true, ...result, message: "ComfyUI is running locally. PlotPickle will now verify image nodes and checkpoints before activating it." });
      } catch (error) {
        sendJson(response, 500, { ok: false, message: error instanceof Error ? error.message : "ComfyUI could not be started." });
      }
    })();
  });
}
