import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { ViteDevServer } from "vite";
import voiceManifest from "../../config/local-voice-input.json";
import { localVoiceRuntimeStatus, transcribeLocalVoiceWav } from "./local-voice-runtime";

const STATUS_PATH = "/api/local-voice/status";
const SETUP_PATH = "/api/local-voice/setup";
const TRANSCRIBE_PATH = "/api/local-voice/transcribe";
const INSTALL_SCRIPT = "install-whisper-cpp.ps1";

type SetupTask = {
  state: "idle" | "installing" | "installed" | "failed";
  message: string;
  startedAt: string;
  finishedAt: string;
};

let setupTask: SetupTask = { state: "idle", message: "", startedAt: "", finishedAt: "" };
let transcriptionActive = false;

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

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage, maximum = 4096) {
  const bytes = await readBytes(request, maximum);
  const parsed: unknown = JSON.parse(bytes.toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid local voice request.");
  return parsed as Record<string, unknown>;
}

async function readBytes(request: IncomingMessage, maximum: number) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > maximum) throw new Error("VOICE_AUDIO_BOUNDS: Dictation audio exceeds PlotPickle's bounded local size.");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function installerPath() {
  return path.resolve(process.cwd(), "scripts", INSTALL_SCRIPT);
}

function startInstaller() {
  setupTask = {
    state: "installing",
    message: "Downloading and verifying the reviewed whisper.cpp CPU runtime and base.en model locally.",
    startedAt: new Date().toISOString(),
    finishedAt: "",
  };
  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", installerPath(),
    "-Mode", "Install",
    "-Approved",
  ], {
    cwd: process.cwd(),
    windowsHide: true,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const append = (chunk: Buffer | string) => { output = `${output}${String(chunk)}`.slice(-512 * 1024); };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.once("error", (error) => {
    setupTask = { ...setupTask, state: "failed", message: error.message, finishedAt: new Date().toISOString() };
  });
  child.once("close", (code) => {
    const success = code === 0;
    setupTask = {
      ...setupTask,
      state: success ? "installed" : "failed",
      message: success
        ? "The reviewed local dictation runtime and model were installed. PlotPickle will verify integrity before use."
        : (output.trim().split(/\r?\n/u).at(-1) || `Local dictation setup exited with code ${code ?? "unknown"}.`),
      finishedAt: new Date().toISOString(),
    };
  });
}

export function registerLocalVoiceGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (![STATUS_PATH, SETUP_PATH, TRANSCRIBE_PATH].includes(pathname)) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Local dictation is restricted to this PlotPickle server." });
      return;
    }

    void (async () => {
      if (pathname === STATUS_PATH && request.method === "GET") {
        sendJson(response, 200, { ok: true, ...(await localVoiceRuntimeStatus()), setupTask, manifest: {
          provider: voiceManifest.provider,
          releaseTag: voiceManifest.runtime.releaseTag,
          model: voiceManifest.model.id,
          runtimeSizeBytes: voiceManifest.runtime.sizeBytes,
          modelSizeBytes: voiceManifest.model.sizeBytes,
          automaticRuntimeDownload: voiceManifest.execution.automaticRuntimeDownload,
          cloudFallback: voiceManifest.execution.cloudFallback,
        } });
        return;
      }

      if (pathname === SETUP_PATH && request.method === "POST") {
        const status = await localVoiceRuntimeStatus();
        if (status.ready) {
          sendJson(response, 200, { ok: true, ...status, setupTask });
          return;
        }
        if (process.platform !== "win32") {
          sendJson(response, 409, { ok: false, message: status.reason, ...status, setupTask });
          return;
        }
        if (setupTask.state === "installing") {
          sendJson(response, 202, { ok: true, installing: true, setupTask, ...status });
          return;
        }
        const body = await readJsonBody(request);
        if (body.approved !== true) {
          sendJson(response, 409, {
            ok: false,
            approvalRequired: true,
            message: "Explicit approval is required before PlotPickle downloads the reviewed whisper.cpp runtime and base.en speech model.",
            setupTask,
            ...status,
          });
          return;
        }
        startInstaller();
        sendJson(response, 202, { ok: true, installing: true, setupTask, ...status });
        return;
      }

      if (pathname === TRANSCRIBE_PATH && request.method === "POST") {
        if (transcriptionActive) {
          sendJson(response, 409, { ok: false, code: "VOICE_BUSY", message: "Another local dictation transcription is already active." });
          return;
        }
        if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("audio/wav")) {
          sendJson(response, 415, { ok: false, code: "VOICE_AUDIO_FORMAT", message: "PlotPickle local dictation accepts mono 16 kHz PCM WAV audio only." });
          return;
        }
        transcriptionActive = true;
        try {
          const bytes = await readBytes(request, voiceManifest.capture.maxWavBytes);
          const result = await transcribeLocalVoiceWav(bytes);
          sendJson(response, 200, { ok: true, ...result });
        } finally {
          transcriptionActive = false;
        }
        return;
      }

      sendJson(response, 405, { ok: false, message: "Method not allowed." });
    })().catch((error) => {
      const message = error instanceof Error ? error.message : "Local dictation failed.";
      const code = message.startsWith("VOICE_") ? message.split(":", 1)[0] : "VOICE_TRANSCRIPTION_FAILED";
      const status = code === "VOICE_TIMEOUT" ? 504 : code === "VOICE_MODEL_UNAVAILABLE" || code === "VOICE_RUNTIME_UNAVAILABLE" ? 409 : 400;
      sendJson(response, status, { ok: false, code, message: message.replace(/^VOICE_[A-Z_]+:\s*/u, "") });
    });
  });
}
