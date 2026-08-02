import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  createCloudVideo,
  generateCloudImage,
  publicCloudVideoJob,
  queryCloudVideo,
  cancelCloudVideo,
} from "./cloud-media-provider";
import {
  createComfyVideo,
  generateComfyImage,
  probeComfyUI,
  publicComfyVideoJob,
  queryComfyVideo,
  validateH3Workflow,
  workflowNodeClasses,
} from "./comfyui-media-provider";
import {
  publicMediaProfile,
  readMediaRoutingStore,
  workflowHash,
  writeMediaRoutingStore,
  type ImageRoute,
  type MediaRoutingStore,
  type VideoRoute,
} from "./media-routing-store";
import type { ImageGenerationInput, VideoGenerationInput } from "./media-provider-common";

const API = "/api/media-routing";
const STATUS_PATH = `${API}/status`;
const ROUTES_PATH = `${API}/routes`;
const CHECKPOINT_PATH = `${API}/comfyui/checkpoint`;
const WORKFLOW_PATH = `${API}/comfyui/h3-workflow`;
const TEST_IMAGE_PATH = `${API}/test/image`;
const TEST_VIDEO_PATH = `${API}/test/video`;
const IMAGE_PATH = "/api/local-ai/generate/image";
const VIDEO_PATH = "/api/local-ai/generate/video";
const VIDEO_JOB_PATH = "/api/local-ai/video/";

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

async function readBody(request: IncomingMessage, maximum = 512 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The local media-routing request is too large.");
    chunks.push(value);
  }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Enter a valid media-routing request.");
  return body as Record<string, unknown>;
}

function providerForImageRoute(route: ImageRoute) {
  return route === "openai" || route === "minimax" ? route : null;
}

async function mediaStatus(store: MediaRoutingStore) {
  const workflow = store.comfyui.h3Workflow;
  const comfy = await probeComfyUI(store.comfyui.baseUrl, workflow);
  const checkpoint = store.comfyui.checkpoint || comfy.checkpoints[0] || "";
  const minimaxConfigured = Boolean(store.profiles.minimax?.apiKey && store.profiles.minimax?.videoModel);
  const workflowConfigured = Boolean(workflow);
  const workflowTested = Boolean(workflow?.verifiedAt && workflow.verifiedHash === workflow.hash);
  const hybridReady = comfy.reachable
    && comfy.workflowNodesReady
    && minimaxConfigured
    && workflowConfigured
    && workflowTested;
  return {
    ok: true,
    imageRoute: store.imageRoute,
    videoRoute: store.videoRoute,
    profiles: {
      openai: publicMediaProfile(store.profiles.openai),
      minimax: publicMediaProfile(store.profiles.minimax),
    },
    comfyui: {
      ...comfy,
      baseUrl: store.comfyui.baseUrl,
      checkpoint,
      selectedCheckpoint: store.comfyui.checkpoint,
      imageVerifiedAt: store.comfyui.imageVerifiedAt,
      lastError: store.comfyui.lastError,
      h3Workflow: workflow ? {
        configured: true,
        hash: workflow.hash,
        nodeClasses: workflow.nodeClasses,
        configuredAt: workflow.configuredAt,
        verifiedAt: workflow.verifiedAt,
        verifiedHash: workflow.verifiedHash,
        lastError: workflow.lastError,
      } : { configured: false },
    },
    hybridGate: {
      ready: hybridReady,
      requirements: [
        { id: "comfyui", label: "ComfyUI responds on 127.0.0.1:8188", ready: comfy.reachable },
        { id: "workflow", label: "Reviewed MiniMax-H3 API workflow is configured", ready: workflowConfigured },
        { id: "nodes", label: "Every workflow node exists in ComfyUI", ready: comfy.workflowNodesReady },
        { id: "minimax", label: "A user-owned MiniMax key and H3 model are configured", ready: minimaxConfigured },
        { id: "test", label: "A paid test job completed and returned a local asset", ready: workflowTested },
      ],
    },
  };
}

async function saveImageSuccess(store: MediaRoutingStore, route: ImageRoute) {
  const now = new Date().toISOString();
  if (route === "comfyui") {
    store.comfyui.imageVerifiedAt = now;
    store.comfyui.lastError = "";
  } else {
    const provider = providerForImageRoute(route);
    if (provider && store.profiles[provider]) {
      store.profiles[provider]!.imageVerifiedAt = now;
      store.profiles[provider]!.lastError = "";
    }
  }
  await writeMediaRoutingStore(store);
}

async function saveImageError(store: MediaRoutingStore, route: ImageRoute, message: string) {
  if (route === "comfyui") store.comfyui.lastError = message;
  else {
    const provider = providerForImageRoute(route);
    if (provider && store.profiles[provider]) store.profiles[provider]!.lastError = message;
  }
  await writeMediaRoutingStore(store);
}

async function generateImage(store: MediaRoutingStore, route: ImageRoute, input: ImageGenerationInput) {
  if (route === "manual") throw new Error("Image routing is set to Manual Import. Import an image or select a tested generator.");
  if (route === "comfyui") {
    const probe = await probeComfyUI(store.comfyui.baseUrl, store.comfyui.h3Workflow);
    if (!probe.reachable || !probe.imageNodesReady) throw new Error(probe.error || `ComfyUI is missing: ${probe.missingImageNodes.join(", ")}`);
    const checkpoint = store.comfyui.checkpoint || probe.checkpoints[0] || "";
    if (!checkpoint) throw new Error("ComfyUI is running but no checkpoint is available.");
    if (!store.comfyui.checkpoint) {
      store.comfyui.checkpoint = checkpoint;
      await writeMediaRoutingStore(store);
    }
    return generateComfyImage(store.comfyui.baseUrl, checkpoint, input);
  }
  const profile = store.profiles[route];
  if (!profile) throw new Error(`Configure ${route === "openai" ? "OpenAI" : "MiniMax"} in Settings before using this image route.`);
  return generateCloudImage(profile, input);
}

async function createVideo(store: MediaRoutingStore, route: VideoRoute, input: VideoGenerationInput) {
  if (route === "none") throw new Error("Video routing is Off. Select MiniMax H3 Direct or MiniMax H3 through ComfyUI.");
  const profile = store.profiles.minimax;
  if (!profile) throw new Error("Configure MiniMax in Settings before creating an H3 video.");
  if (route === "minimax-direct") return publicCloudVideoJob(await createCloudVideo(profile, input));
  const workflow = store.comfyui.h3Workflow;
  if (!workflow) throw new Error("Import a reviewed ComfyUI API workflow for MiniMax-H3 first.");
  const probe = await probeComfyUI(store.comfyui.baseUrl, workflow);
  if (!probe.reachable || !probe.workflowNodesReady) {
    throw new Error(probe.error || `ComfyUI is missing workflow nodes: ${probe.missingWorkflowNodes.join(", ")}`);
  }
  return publicComfyVideoJob(await createComfyVideo(store.comfyui.baseUrl, workflow, profile, input));
}

async function queryVideo(store: MediaRoutingStore, id: string) {
  const profile = store.profiles.minimax;
  if (!profile) throw new Error("The MiniMax profile used by this video job is no longer configured.");
  if (id.startsWith("comfyui-")) {
    const job = await queryComfyVideo(store.comfyui.baseUrl, id);
    if (job.status === "succeeded" && store.comfyui.h3Workflow) {
      const now = new Date().toISOString();
      store.comfyui.h3Workflow.verifiedAt = now;
      store.comfyui.h3Workflow.verifiedHash = store.comfyui.h3Workflow.hash;
      store.comfyui.h3Workflow.lastError = "";
      store.videoRoute = "minimax-comfyui";
      profile.videoVerifiedAt = now;
      await writeMediaRoutingStore(store);
    }
    return publicComfyVideoJob(job);
  }
  const job = await queryCloudVideo(profile, id);
  if (job.status === "succeeded") {
    profile.videoVerifiedAt = new Date().toISOString();
    profile.lastError = "";
    await writeMediaRoutingStore(store);
  }
  return publicCloudVideoJob(job);
}

async function handleApi(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { ok: false, message: "Media routing is available only from this local PlotPickle server." });
    return;
  }
  try {
    const store = await readMediaRoutingStore();
    if (pathname === STATUS_PATH && request.method === "GET") {
      sendJson(response, 200, await mediaStatus(store));
      return;
    }
    if (pathname === ROUTES_PATH && request.method === "POST") {
      const body = await readBody(request);
      if (typeof body.imageRoute === "string") {
        const route = body.imageRoute as ImageRoute;
        if (!["comfyui", "openai", "minimax", "manual"].includes(route)) throw new Error("Choose a supported image route.");
        if ((route === "openai" || route === "minimax") && !store.profiles[route]) throw new Error(`Configure ${route} in Settings before selecting it.`);
        store.imageRoute = route;
      }
      if (typeof body.videoRoute === "string") {
        const route = body.videoRoute as VideoRoute;
        if (!["minimax-direct", "minimax-comfyui", "none"].includes(route)) throw new Error("Choose a supported video route.");
        if (route !== "none" && !store.profiles.minimax) throw new Error("Configure MiniMax before selecting an H3 route.");
        if (route === "minimax-comfyui") {
          const status = await mediaStatus(store);
          if (!status.hybridGate.ready) throw new Error("Complete every ComfyUI H3 prerequisite and successful paid test before enabling the hybrid route.");
        }
        store.videoRoute = route;
      }
      await writeMediaRoutingStore(store);
      sendJson(response, 200, await mediaStatus(store));
      return;
    }
    if (pathname === CHECKPOINT_PATH && request.method === "POST") {
      const body = await readBody(request);
      const checkpoint = typeof body.checkpoint === "string" ? body.checkpoint.trim() : "";
      const probe = await probeComfyUI(store.comfyui.baseUrl, store.comfyui.h3Workflow);
      if (!probe.checkpoints.includes(checkpoint)) throw new Error("Select a checkpoint currently reported by ComfyUI.");
      store.comfyui.checkpoint = checkpoint;
      store.comfyui.imageVerifiedAt = "";
      await writeMediaRoutingStore(store);
      sendJson(response, 200, await mediaStatus(store));
      return;
    }
    if (pathname === WORKFLOW_PATH && request.method === "POST") {
      const body = await readBody(request);
      const source = body.workflow;
      if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("Paste a ComfyUI API-format workflow JSON object.");
      const workflow = source as Record<string, unknown>;
      const nodeClasses = validateH3Workflow(workflow);
      const hash = workflowHash(workflow);
      store.comfyui.h3Workflow = {
        source: workflow,
        hash,
        nodeClasses: workflowNodeClasses(workflow),
        configuredAt: new Date().toISOString(),
        verifiedAt: "",
        verifiedHash: "",
        lastError: "",
      };
      store.videoRoute = "none";
      await writeMediaRoutingStore(store);
      sendJson(response, 200, { ok: true, nodeClasses, ...(await mediaStatus(store)) });
      return;
    }
    if (pathname === TEST_IMAGE_PATH && request.method === "POST") {
      const body = await readBody(request);
      const route = typeof body.route === "string" ? body.route as ImageRoute : store.imageRoute;
      const input: ImageGenerationInput = {
        prompt: typeof body.prompt === "string" ? body.prompt : "A warm cinematic storyboard frame of a writer opening PlotPickle for the first time, clear composition, expressive light, no text.",
        aspect: "landscape",
        quality: "low",
        assetId: `media-route-test-${route}`,
        billingAcknowledged: body.billingAcknowledged,
        requestCount: 1,
      };
      try {
        const result = await generateImage(store, route, input);
        await saveImageSuccess(store, route);
        sendJson(response, 200, { ok: true, route, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The image test failed.";
        await saveImageError(store, route, message);
        throw error;
      }
      return;
    }
    if (pathname === TEST_VIDEO_PATH && request.method === "POST") {
      const body = await readBody(request);
      const route = typeof body.route === "string" ? body.route as VideoRoute : store.videoRoute;
      const job = await createVideo(store, route, {
        prompt: typeof body.prompt === "string" ? body.prompt : "A paper storyboard panel gently comes to life with a slow camera push and natural movement.",
        assetId: `h3-route-test-${route}`,
        durationSeconds: 4,
        aspectRatio: "16:9",
        billingAcknowledged: body.billingAcknowledged,
        dataSharingAcknowledged: body.dataSharingAcknowledged,
      });
      sendJson(response, 200, { ok: true, ...job });
      return;
    }
    if (pathname === IMAGE_PATH && request.method === "POST") {
      const input = await readBody(request, 256 * 1024) as ImageGenerationInput;
      const result = await generateImage(store, store.imageRoute, input);
      await saveImageSuccess(store, store.imageRoute);
      sendJson(response, 200, { ok: true, route: store.imageRoute, ...result });
      return;
    }
    if (pathname === VIDEO_PATH && request.method === "POST") {
      const job = await createVideo(store, store.videoRoute, await readBody(request, 128 * 1024) as VideoGenerationInput);
      sendJson(response, 200, { ok: true, ...job });
      return;
    }
    if (pathname.startsWith(VIDEO_JOB_PATH) && (request.method === "GET" || request.method === "DELETE")) {
      const id = decodeURIComponent(pathname.slice(VIDEO_JOB_PATH.length));
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new Error("Invalid media job ID.");
      if (request.method === "DELETE") {
        if (id.startsWith("comfyui-")) throw new Error("Stop a running ComfyUI workflow from ComfyUI. PlotPickle does not pretend a paid custom-node job was cancelled.");
        const profile = store.profiles.minimax;
        if (!profile) throw new Error("The MiniMax profile used by this job is no longer configured.");
        sendJson(response, 200, { ok: true, ...publicCloudVideoJob(await cancelCloudVideo(profile, id)) });
      } else sendJson(response, 200, { ok: true, ...(await queryVideo(store, id)) });
      return;
    }
    sendJson(response, 404, { ok: false, message: "Media-routing operation not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : "The media-routing operation failed.";
    sendJson(response, 400, { ok: false, message });
  }
}

export function registerMediaRoutingGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    const handled = pathname.startsWith(API)
      || pathname === IMAGE_PATH
      || pathname === VIDEO_PATH
      || pathname.startsWith(VIDEO_JOB_PATH);
    if (!handled) {
      next();
      return;
    }
    void handleApi(request, response, pathname);
  });
}
