import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  configureNativeH3Manifest,
  createNativeH3Video,
  probeNativeH3,
  publicNativeH3Job,
  queryNativeH3Video,
  readNativeH3Store,
  writeNativeH3Store,
  type H3NativeInput,
} from "./comfyui-h3-native-provider";

const API = "/api/media-routing/comfyui/h3-native";
const STATUS_PATH = `${API}/status`;
const MANIFEST_PATH = `${API}/manifest`;
const CONNECTION_PATH = `${API}/connection`;
const ACTIVATION_PATH = `${API}/activation`;
const TEST_PATH = `${API}/test`;
const VIDEO_PATH = "/api/local-ai/generate/video";
const VIDEO_JOB_PATH = "/api/local-ai/video/";
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

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

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > MAX_REQUEST_BYTES) throw new Error("The native H3 request is too large.");
    chunks.push(value);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a valid native H3 request.");
  return value as Record<string, unknown>;
}

function normalizeBaseUrl(value: unknown) {
  const source = typeof value === "string" ? value.trim() : "";
  const url = new URL(source || "http://127.0.0.1:8188");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "8188") {
    throw new Error("Native H3 must use the local ComfyUI address http://127.0.0.1:8188.");
  }
  if (url.username || url.password || (url.pathname && url.pathname !== "/")) {
    throw new Error("Enter only the local ComfyUI server address, without credentials or a path.");
  }
  return "http://127.0.0.1:8188";
}

async function statusBody() {
  const store = await readNativeH3Store();
  const probe = await probeNativeH3(store);
  return {
    ok: true,
    active: store.active,
    allowConstrainedVram: store.allowConstrainedVram,
    configuredAt: store.configuredAt,
    verifiedAt: store.verifiedAt,
    lastError: store.lastError,
    baseUrl: store.baseUrl,
    setup: {
      installsWeights: false,
      installsCustomNodes: false,
      executesDownloadedCode: false,
      officialSources: [
        "https://www.minimax.io/news",
        "https://github.com/MiniMax-AI",
        "https://huggingface.co/MiniMaxAI",
        "https://github.com/Comfy-Org/ComfyUI",
        "https://docs.comfy.org/",
      ],
    },
    ...probe,
  };
}

function nativeInput(body: Record<string, unknown>): H3NativeInput {
  return {
    prompt: body.prompt,
    sourceAssetUrl: body.sourceAssetUrl,
    firstFrameAssetUrl: body.firstFrameAssetUrl,
    lastFrameAssetUrl: body.lastFrameAssetUrl,
    referenceAssetUrl: body.referenceAssetUrl,
    sourceVideoAssetUrl: body.sourceVideoAssetUrl,
    assetId: body.assetId,
    durationSeconds: body.durationSeconds,
    aspectRatio: body.aspectRatio,
    performanceAcknowledged: body.performanceAcknowledged,
  };
}

async function handleNativeApi(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { ok: false, message: "Native H3 is available only from this local PlotPickle server." });
    return true;
  }
  try {
    if (pathname === STATUS_PATH && request.method === "GET") {
      sendJson(response, 200, await statusBody());
      return true;
    }
    if (pathname === MANIFEST_PATH && request.method === "POST") {
      const body = await readBody(request);
      await configureNativeH3Manifest(body.manifest);
      sendJson(response, 200, await statusBody());
      return true;
    }
    if (pathname === CONNECTION_PATH && request.method === "POST") {
      const body = await readBody(request);
      const store = await readNativeH3Store();
      const baseUrl = normalizeBaseUrl(body.baseUrl);
      if (store.baseUrl !== baseUrl) {
        store.baseUrl = baseUrl;
        store.active = false;
        store.verifiedAt = "";
        store.lastError = "";
        await writeNativeH3Store(store);
      }
      sendJson(response, 200, await statusBody());
      return true;
    }
    if (pathname === ACTIVATION_PATH && request.method === "POST") {
      const body = await readBody(request);
      const store = await readNativeH3Store();
      store.allowConstrainedVram = body.allowConstrainedVram === true;
      if (body.active === true) {
        const probe = await probeNativeH3(store);
        if (!probe.ready) throw new Error(probe.error || "Complete every native H3 prerequisite before activation.");
        store.active = true;
      } else store.active = false;
      store.lastError = "";
      await writeNativeH3Store(store);
      sendJson(response, 200, await statusBody());
      return true;
    }
    if (pathname === TEST_PATH && request.method === "POST") {
      const body = await readBody(request);
      const store = await readNativeH3Store();
      const job = await createNativeH3Video(store, {
        prompt: typeof body.prompt === "string"
          ? body.prompt
          : "A restrained cinematic camera move across a storyboard desk, natural motion, no text, no logo.",
        sourceAssetUrl: body.sourceAssetUrl,
        firstFrameAssetUrl: body.firstFrameAssetUrl,
        lastFrameAssetUrl: body.lastFrameAssetUrl,
        referenceAssetUrl: body.referenceAssetUrl,
        sourceVideoAssetUrl: body.sourceVideoAssetUrl,
        assetId: "native-h3-connection-test",
        durationSeconds: 4,
        aspectRatio: "16:9",
        performanceAcknowledged: body.performanceAcknowledged,
      });
      sendJson(response, 202, { ok: true, ...publicNativeH3Job(job) });
      return true;
    }
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The native H3 request failed.";
    const store = await readNativeH3Store().catch(() => null);
    if (store) {
      store.lastError = message;
      store.active = false;
      await writeNativeH3Store(store).catch(() => undefined);
    }
    sendJson(response, 400, { ok: false, message });
    return true;
  }
}

export function registerNativeH3Gateway(server: ViteDevServer) {
  server.middlewares.use(async (request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname.startsWith(API)) {
      if (!(await handleNativeApi(request, response, pathname))) next();
      return;
    }
    if (pathname === VIDEO_PATH && request.method === "POST") {
      try {
        const store = await readNativeH3Store();
        if (!store.active) {
          next();
          return;
        }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Native H3 generation is available only from this local PlotPickle server." });
          return;
        }
        const body = await readBody(request);
        const job = await createNativeH3Video(store, nativeInput(body));
        sendJson(response, 202, { ok: true, ...publicNativeH3Job(job) });
      } catch (error) {
        sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "Native H3 generation failed." });
      }
      return;
    }
    if (pathname.startsWith(VIDEO_JOB_PATH) && request.method === "GET") {
      const id = decodeURIComponent(pathname.slice(VIDEO_JOB_PATH.length));
      if (!id.startsWith("native-h3-")) {
        next();
        return;
      }
      try {
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Native H3 jobs are available only from this local PlotPickle server." });
          return;
        }
        const store = await readNativeH3Store();
        const job = await queryNativeH3Video(store, id);
        sendJson(response, 200, { ok: true, ...publicNativeH3Job(job) });
      } catch (error) {
        sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "The native H3 job could not be checked." });
      }
      return;
    }
    next();
  });
}
