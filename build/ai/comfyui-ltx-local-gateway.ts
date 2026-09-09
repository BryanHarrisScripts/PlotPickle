import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { bundledLtxManifest, legacyBundledLtxManifestV1 } from "./comfyui-ltx-default";
import {
  configureLtxManifest,
  ensureLtxDefault,
  createLtxVideo,
  getLtxVideoJob,
  probeLtxVideo,
  type LtxJob,
  type LtxStore,
} from "./comfyui-ltx-local-provider";
import {
  holdLocalGpuMediaLease,
  releaseLocalGpuMediaLease,
} from "../local-gpu-resource-manager";
import { readMediaRoutingStore } from "../media-routing-store";
import type { VideoGenerationInput } from "../media-provider-common";

const PROFILE_PATH = "/api/local-ai/ltx-video";
const MANIFEST_PATH = `${PROFILE_PATH}/manifest`;
const SETUP_PATH = `${PROFILE_PATH}/setup`;
const LTX_TEST_PATH = `${PROFILE_PATH}/test`;
const VIDEO_PATH = "/api/local-ai/generate/video";
const TEST_VIDEO_PATH = "/api/media-routing/test/video";
const VIDEO_JOB_PATH = "/api/local-ai/video/";
const LOCAL_VIDEO_WAIT_MS = 30 * 60_000;
const INSTALL_SCRIPT_NAME = "install-comfyui-ltx-2b-starter.ps1";
const REVIEWED_DOWNLOAD_SIZE = "16.13 GB";

type LtxSetupTask = {
  state: "idle" | "installing" | "installed" | "failed";
  message: string;
  startedAt: string;
  finishedAt: string;
};

let setupTask: LtxSetupTask = {
  state: "idle",
  message: "",
  startedAt: "",
  finishedAt: "",
};

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
  } catch { return false; }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 256 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The local LTX-Video request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid local LTX-Video request.");
  return parsed as Record<string, unknown>;
}

function installerPath() {
  return path.resolve(process.cwd(), "scripts", INSTALL_SCRIPT_NAME);
}

function marker(output: string, name: string) {
  const prefix = `${name}=`;
  for (const line of output.split(/\r?\n/u)) {
    if (line.startsWith(prefix)) return line.slice(prefix.length).trim();
  }
  return "";
}

function isLegacyBundledStore(store: LtxStore) {
  if (!store.manifest) return false;
  const legacy = legacyBundledLtxManifestV1();
  return store.manifest.model === legacy.model
    && store.manifest.source === legacy.source
    && JSON.stringify(store.manifest.requiredModelNames) === JSON.stringify(legacy.requiredModelNames)
    && JSON.stringify(store.manifest.workflow) === JSON.stringify(legacy.workflow);
}

async function ensureCurrentBundledLtx() {
  let store = await ensureLtxDefault();
  if (isLegacyBundledStore(store)) store = await configureLtxManifest(bundledLtxManifest());
  return store;
}

function startReviewedLtxInstall() {
  setupTask = {
    state: "installing",
    message: `Downloading and verifying the reviewed LTX model files (${REVIEWED_DOWNLOAD_SIZE} total). Keep PlotPickle and ComfyUI open.`,
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
  const append = (chunk: Buffer | string) => {
    output = `${output}${String(chunk)}`.slice(-512 * 1024);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.once("error", (error) => {
    setupTask = { ...setupTask, state: "failed", message: error.message, finishedAt: new Date().toISOString() };
  });
  child.once("close", (code) => {
    const state = marker(output, "PLOTPICKLE_LTX_INSTALL_STATUS");
    const detail = marker(output, "PLOTPICKLE_LTX_INSTALL_DETAIL");
    const success = code === 0 && ["installed", "ready"].includes(state);
    setupTask = {
      ...setupTask,
      state: success ? "installed" : "failed",
      message: detail || (success
        ? "The reviewed LTX model files are installed and verified."
        : `The LTX model installer exited with code ${code ?? "unknown"}.`),
      finishedAt: new Date().toISOString(),
    };
  });
}

async function usesDefaultLocalVideo() {
  const media = await readMediaRoutingStore();
  return media.videoRoute === "none";
}

async function waitForLocalVideo(job: LtxJob) {
  const deadline = Date.now() + LOCAL_VIDEO_WAIT_MS;
  let current = job;
  while ((current.status === "queued" || current.status === "running") && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    current = await getLtxVideoJob(job.id);
  }
  if (current.status === "failed") throw new Error(current.error || "The local LTX-Video render failed.");
  if (current.status !== "succeeded") throw new Error("The local LTX-Video render exceeded PlotPickle's 30-minute GPU reservation window.");
  return current;
}

async function createVideoWithGpuLease(input: VideoGenerationInput) {
  holdLocalGpuMediaLease();
  try {
    return await waitForLocalVideo(await createLtxVideo(input));
  } finally {
    await releaseLocalGpuMediaLease();
  }
}

export function registerLtxLocalVideoGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    const profileOperation = pathname === PROFILE_PATH || pathname === MANIFEST_PATH || pathname === SETUP_PATH || pathname === LTX_TEST_PATH;
    const jobOperation = pathname.startsWith(VIDEO_JOB_PATH) && pathname.slice(VIDEO_JOB_PATH.length).startsWith("ltx-");
    const generationOperation = (pathname === VIDEO_PATH || pathname === TEST_VIDEO_PATH) && request.method === "POST";
    if (!profileOperation && !jobOperation && !generationOperation) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Local LTX-Video is restricted to this PlotPickle server." });
      return;
    }

    void (async () => {
      if (generationOperation && !(await usesDefaultLocalVideo())) {
        next();
        return;
      }
      if (pathname === PROFILE_PATH && request.method === "GET") {
        const store = await ensureCurrentBundledLtx();
        sendJson(response, 200, {
          ok: true,
          defaultLocalVideo: true,
          enabled: store.enabled,
          configuredAt: store.configuredAt,
          verifiedAt: store.verifiedAt,
          lastError: store.lastError,
          setupTask,
          reviewedDownloadSize: REVIEWED_DOWNLOAD_SIZE,
          ...(await probeLtxVideo(store)),
        });
        return;
      }
      if (pathname === SETUP_PATH && request.method === "POST") {
        const store = await ensureCurrentBundledLtx();
        const status = await probeLtxVideo(store);
        if (status.ready) {
          sendJson(response, 200, { ok: true, setupTask, reviewedDownloadSize: REVIEWED_DOWNLOAD_SIZE, ...status });
          return;
        }
        if (status.missingNodes.length) {
          sendJson(response, 409, {
            ok: false,
            message: `The installed ComfyUI build is missing required core LTX nodes: ${status.missingNodes.join(", ")}. Update the managed ComfyUI runtime, then CHECK AGAIN.`,
            setupTask,
            ...status,
          });
          return;
        }
        if (status.missingModels.length) {
          if (process.platform !== "win32") {
            sendJson(response, 409, {
              ok: false,
              message: "Automatic reviewed LTX model installation is currently available on local Windows only.",
              setupTask,
              ...status,
            });
            return;
          }
          if (setupTask.state === "installing") {
            sendJson(response, 202, { ok: true, installing: true, setupTask, reviewedDownloadSize: REVIEWED_DOWNLOAD_SIZE, ...status });
            return;
          }
          const body = await readBody(request, 4 * 1024);
          if (body.approved !== true) {
            sendJson(response, 409, {
              ok: false,
              approvalRequired: true,
              reviewedDownloadSize: REVIEWED_DOWNLOAD_SIZE,
              message: `Explicit approval is required before PlotPickle downloads up to ${REVIEWED_DOWNLOAD_SIZE} of reviewed LTX model files.`,
              setupTask,
              ...status,
            });
            return;
          }
          startReviewedLtxInstall();
          sendJson(response, 202, { ok: true, installing: true, setupTask, reviewedDownloadSize: REVIEWED_DOWNLOAD_SIZE, ...status });
          return;
        }
        sendJson(response, 200, { ok: true, setupTask, reviewedDownloadSize: REVIEWED_DOWNLOAD_SIZE, ...status });
        return;
      }
      if (pathname === MANIFEST_PATH && request.method === "POST") {
        const body = await readBody(request, 2 * 1024 * 1024);
        const store = await configureLtxManifest(body.manifest);
        sendJson(response, 200, { ok: true, ...(await probeLtxVideo(store)) });
        return;
      }
      if (generationOperation || (pathname === LTX_TEST_PATH && request.method === "POST")) {
        const body = await readBody(request);
        const input: VideoGenerationInput = pathname === TEST_VIDEO_PATH || pathname === LTX_TEST_PATH ? {
          prompt: typeof body.prompt === "string" ? body.prompt : "A cinematic storyboard frame comes gently to life with a subtle camera push and natural character motion.",
          assetId: "ltx-local-video-test",
          durationSeconds: 2,
          aspectRatio: "16:9",
        } : body;
        const job = await createVideoWithGpuLease(input);
        sendJson(response, 200, { ok: true, ...job });
        return;
      }
      if (jobOperation && request.method === "GET") {
        const id = decodeURIComponent(pathname.slice(VIDEO_JOB_PATH.length));
        if (!/^ltx-[a-zA-Z0-9-]{1,180}$/.test(id)) throw new Error("Invalid LTX-Video job ID.");
        sendJson(response, 200, { ok: true, ...(await getLtxVideoJob(id)) });
        return;
      }
      sendJson(response, 405, { ok: false, message: "Method not allowed." });
    })().catch((error) => {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : "The local LTX-Video operation failed.",
      });
    });
  });
}
