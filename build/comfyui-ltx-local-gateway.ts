import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  configureLtxManifest,
  createLtxVideo,
  getLtxVideoJob,
  probeLtxVideo,
  readLtxStore,
  type LtxJob,
} from "./comfyui-ltx-local-provider";
import { readMediaRoutingStore } from "./media-routing-store";
import type { VideoGenerationInput } from "./media-provider-common";

const PROFILE_PATH = "/api/local-ai/ltx-video";
const MANIFEST_PATH = `${PROFILE_PATH}/manifest`;
const VIDEO_PATH = "/api/local-ai/generate/video";
const TEST_VIDEO_PATH = "/api/media-routing/test/video";
const VIDEO_JOB_PATH = "/api/local-ai/video/";
const LOCAL_VIDEO_WAIT_MS = 30 * 60_000;

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

export function registerLtxLocalVideoGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    const profileOperation = pathname === PROFILE_PATH || pathname === MANIFEST_PATH;
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
        const store = await readLtxStore();
        sendJson(response, 200, {
          ok: true,
          defaultLocalVideo: true,
          enabled: store.enabled,
          configuredAt: store.configuredAt,
          verifiedAt: store.verifiedAt,
          lastError: store.lastError,
          ...(await probeLtxVideo(store)),
        });
        return;
      }
      if (pathname === MANIFEST_PATH && request.method === "POST") {
        const body = await readBody(request, 2 * 1024 * 1024);
        const store = await configureLtxManifest(body.manifest);
        sendJson(response, 200, { ok: true, ...(await probeLtxVideo(store)) });
        return;
      }
      if (generationOperation) {
        const body = await readBody(request);
        const input: VideoGenerationInput = pathname === TEST_VIDEO_PATH ? {
          prompt: typeof body.prompt === "string" ? body.prompt : "A cinematic storyboard frame comes gently to life with a subtle camera push and natural character motion.",
          assetId: "ltx-local-video-test",
          durationSeconds: 2,
          aspectRatio: "16:9",
        } : body;
        const job = await waitForLocalVideo(await createLtxVideo(input));
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
