import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";
import {
  probeNativeH3,
  readNativeH3Store,
  writeNativeH3Store,
} from "./comfyui-h3-native-provider";
import { probeComfyUI } from "./comfyui-media-provider";
import {
  readMediaRoutingStore,
  writeMediaRoutingStore,
  type MediaProfile,
} from "./media-routing-store";
import {
  readSynchronizedAssistantStore,
  writeAssistantStore,
  type ActiveTextProvider,
} from "./writing-assistant-store";
import {
  normalizedUrl,
  providerForm,
  providerRequest,
  safeAssetStem,
  saveGeneratedAsset,
  videoSourceReference,
  type VideoGenerationInput,
} from "./media-provider-common";

export type TextRoute = "ollama" | "openai" | "off";
export type ImageRoute = "comfyui" | "openai" | "minimax" | "manual";
export type VideoRoute = "comfyui-native" | "minimax" | "openai" | "off";

type RoutingChoice = {
  version: 1;
  text: TextRoute;
  image: ImageRoute;
  video: VideoRoute;
  updatedAt: string;
};

type OpenAiVideoStatus = "queued" | "running" | "succeeded" | "failed" | "expired";

type OpenAiVideoJob = {
  id: string;
  provider: "openai";
  route: "openai";
  model: string;
  status: OpenAiVideoStatus;
  prompt: string;
  assetId: string;
  sourceAssetUrl: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  outputAssetUrl: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

const API = "/api/ai-routing";
const STATUS_PATH = `${API}/status`;
const SELECT_PATH = `${API}/select`;
const VIDEO_PATH = "/api/local-ai/generate/video";
const VIDEO_JOB_PATH = "/api/local-ai/video/";
const ROUTING_FILE = "ai-routing.json";
const OPENAI_JOBS_FILE = "openai-video-jobs.json";

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

async function readBody(request: IncomingMessage, maximum = 256 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The AI routing request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid AI routing request.");
  return parsed as Record<string, unknown>;
}

function textRoute(value: ActiveTextProvider): TextRoute | null {
  if (value === "ollama" || value === "openai") return value;
  if (value === "disabled") return "off";
  return null;
}

function normalizeChoice(value: unknown): RoutingChoice | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<RoutingChoice>;
  if (!["ollama", "openai", "off"].includes(String(item.text))) return null;
  if (!["comfyui", "openai", "minimax", "manual"].includes(String(item.image))) return null;
  if (!["comfyui-native", "minimax", "openai", "off"].includes(String(item.video))) return null;
  return {
    version: 1,
    text: item.text as TextRoute,
    image: item.image as ImageRoute,
    video: item.video as VideoRoute,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

async function readRoutingChoice() {
  const [stored, assistantResult, media, native] = await Promise.all([
    readCredentialJson<unknown>(ROUTING_FILE),
    readSynchronizedAssistantStore(),
    readMediaRoutingStore(),
    readNativeH3Store(),
  ]);
  const existing = normalizeChoice(stored);
  const assistantSelection = textRoute(assistantResult.store.activeProvider);
  const inferred: RoutingChoice = existing ?? {
    version: 1,
    text: assistantSelection ?? "off",
    image: media.imageRoute,
    video: native.active ? "comfyui-native" : media.videoRoute === "none" ? "off" : "minimax",
    updatedAt: new Date().toISOString(),
  };

  let changed = !existing;
  if (assistantSelection && inferred.text !== assistantSelection) {
    inferred.text = assistantSelection;
    changed = true;
  }
  if (inferred.image !== media.imageRoute) {
    inferred.image = media.imageRoute;
    changed = true;
  }
  if (native.active && inferred.video !== "comfyui-native") {
    inferred.video = "comfyui-native";
    changed = true;
  } else if (!native.active && media.videoRoute !== "none" && inferred.video !== "minimax") {
    inferred.video = "minimax";
    changed = true;
  }
  if (changed) {
    inferred.updatedAt = new Date().toISOString();
    await writeCredentialJson(ROUTING_FILE, inferred);
  }
  return inferred;
}

async function writeRoutingChoice(value: RoutingChoice) {
  value.updatedAt = new Date().toISOString();
  await writeCredentialJson(ROUTING_FILE, value);
}

function profileState(profile: MediaProfile | undefined, kind: "image" | "video") {
  const model = kind === "image" ? profile?.imageModel : profile?.videoModel;
  const verifiedAt = kind === "image" ? profile?.imageVerifiedAt : profile?.videoVerifiedAt;
  return {
    configured: Boolean(profile?.apiKey && model),
    ready: Boolean(profile?.apiKey && model && verifiedAt),
    model: model || "",
    verifiedAt: verifiedAt || "",
    error: profile?.lastError || "",
  };
}

async function statusBody() {
  const [choice, assistantResult, media, native] = await Promise.all([
    readRoutingChoice(),
    readSynchronizedAssistantStore(),
    readMediaRoutingStore(),
    readNativeH3Store(),
  ]);
  const [comfy, nativeProbe] = await Promise.all([
    probeComfyUI(media.comfyui.baseUrl, media.comfyui.h3Workflow),
    probeNativeH3(native),
  ]);
  const assistant = assistantResult.store;
  const ollama = assistant.profiles.ollama;
  const openAiText = assistant.profiles.openai;
  const comfyImageConfigured = Boolean(comfy.reachable && (media.comfyui.checkpoint || comfy.checkpoints[0]));
  const comfyImageReady = Boolean(comfyImageConfigured && comfy.imageNodesReady && media.comfyui.imageVerifiedAt);
  return {
    ok: true,
    choice,
    consent: {
      cloudSelectionRequiresCostAcknowledgement: true,
      cloudVideoRequiresDataSharingAcknowledgement: true,
      silentPaidFallback: false,
    },
    text: {
      selected: choice.text,
      options: {
        ollama: {
          configured: Boolean(ollama?.textModel),
          ready: Boolean(ollama?.assistantVerifiedAt),
          model: ollama?.textModel || "",
          error: ollama?.lastError || "",
          locality: "local",
          cost: "No per-request provider charge",
          settingsTarget: "ollama",
        },
        openai: {
          configured: Boolean(openAiText?.apiKey && openAiText?.textModel),
          ready: Boolean(openAiText?.assistantVerifiedAt),
          model: openAiText?.textModel || "",
          error: openAiText?.lastError || "",
          locality: "cloud",
          cost: "Paid API usage",
          settingsTarget: "openai",
        },
        off: {
          configured: true,
          ready: true,
          model: "",
          error: "",
          locality: "off",
          cost: "No AI cost",
          settingsTarget: "",
        },
      },
    },
    image: {
      selected: choice.image,
      options: {
        comfyui: {
          configured: comfyImageConfigured,
          ready: comfyImageReady,
          model: media.comfyui.checkpoint || comfy.checkpoints[0] || "",
          error: media.comfyui.lastError || comfy.error,
          locality: "local",
          cost: "No per-request provider charge",
          settingsTarget: "comfyui",
        },
        openai: { ...profileState(media.profiles.openai, "image"), locality: "cloud", cost: "Paid API usage", settingsTarget: "openai" },
        minimax: { ...profileState(media.profiles.minimax, "image"), locality: "cloud", cost: "Paid API usage", settingsTarget: "minimax" },
        manual: {
          configured: true,
          ready: true,
          model: "",
          verifiedAt: "",
          error: "",
          locality: "manual",
          cost: "No AI cost",
          settingsTarget: "",
        },
      },
    },
    video: {
      selected: choice.video,
      options: {
        "comfyui-native": {
          configured: nativeProbe.manifestConfigured,
          ready: nativeProbe.ready,
          model: "MiniMax-H3",
          error: native.lastError || nativeProbe.error,
          locality: "local",
          cost: "No per-request provider charge",
          settingsTarget: "comfyui",
        },
        minimax: { ...profileState(media.profiles.minimax, "video"), locality: "cloud", cost: "Paid API usage", settingsTarget: "minimax" },
        openai: { ...profileState(media.profiles.openai, "video"), locality: "cloud", cost: "Paid API usage", settingsTarget: "openai" },
        off: {
          configured: true,
          ready: true,
          model: "",
          verifiedAt: "",
          error: "",
          locality: "off",
          cost: "No video generation cost",
          settingsTarget: "",
        },
      },
    },
  };
}

function requirePaidConsent(body: Record<string, unknown>) {
  if (body.paidAcknowledged !== true) {
    throw new Error("Confirm that the selected cloud provider can charge the user-owned API account before activating it.");
  }
}

async function selectRoute(body: Record<string, unknown>) {
  const capability = body.capability;
  const route = body.route;
  const choice = await readRoutingChoice();
  const [assistantResult, media, native] = await Promise.all([
    readSynchronizedAssistantStore(),
    readMediaRoutingStore(),
    readNativeH3Store(),
  ]);

  if (capability === "text") {
    if (route !== "ollama" && route !== "openai" && route !== "off") throw new Error("Choose Ollama, OpenAI or Off for text.");
    if (route === "openai") requirePaidConsent(body);
    assistantResult.store.activeProvider = route === "off" ? "disabled" : route;
    assistantResult.store.explicitlyDisabled = route === "off";
    choice.text = route;
    await writeAssistantStore(assistantResult.store);
  } else if (capability === "image") {
    if (route !== "comfyui" && route !== "openai" && route !== "minimax" && route !== "manual") throw new Error("Choose ComfyUI, OpenAI, MiniMax or Manual for images.");
    if (route === "openai" || route === "minimax") requirePaidConsent(body);
    media.imageRoute = route;
    choice.image = route;
    await writeMediaRoutingStore(media);
  } else if (capability === "video") {
    if (route !== "comfyui-native" && route !== "openai" && route !== "minimax" && route !== "off") throw new Error("Choose local ComfyUI H3, OpenAI, MiniMax or Off for video.");
    if (route === "openai" || route === "minimax") {
      requirePaidConsent(body);
      if (body.dataSharingAcknowledged !== true) throw new Error("Confirm that video prompts and selected reference images may leave this computer before activating a cloud video route.");
    }
    native.active = false;
    media.videoRoute = route === "minimax" ? "minimax-direct" : "none";
    if (route === "comfyui-native") {
      const probe = await probeNativeH3(native);
      native.active = probe.ready;
      native.lastError = probe.ready ? "" : probe.error || "Native H3 is selected but still needs setup.";
    }
    choice.video = route;
    await Promise.all([writeNativeH3Store(native), writeMediaRoutingStore(media)]);
  } else {
    throw new Error("Choose text, image or video routing.");
  }

  await writeRoutingChoice(choice);
  return statusBody();
}

function openAiJobStatus(value: unknown): OpenAiVideoStatus {
  if (value === "queued") return "queued";
  if (value === "in_progress") return "running";
  if (value === "completed") return "succeeded";
  if (value === "failed") return "failed";
  return "expired";
}

async function readOpenAiJobs() {
  const value = await readCredentialJson<unknown>(OPENAI_JOBS_FILE);
  return Array.isArray(value)
    ? value.filter((item): item is OpenAiVideoJob => Boolean(item && typeof item === "object" && typeof (item as OpenAiVideoJob).id === "string"))
    : [];
}

async function saveOpenAiJob(job: OpenAiVideoJob) {
  const current = await readOpenAiJobs();
  await writeCredentialJson(OPENAI_JOBS_FILE, [job, ...current.filter((item) => item.id !== job.id)].slice(0, 100));
  return job;
}

function publicOpenAiJob(job: OpenAiVideoJob) {
  return {
    id: job.id,
    provider: job.provider,
    route: job.route,
    model: job.model,
    status: job.status,
    durationSeconds: job.durationSeconds,
    aspectRatio: job.aspectRatio,
    sourceAssetUrl: job.sourceAssetUrl,
    outputAssetUrl: job.outputAssetUrl,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    reviewState: "unreviewed",
  };
}

function openAiSeconds(value: unknown) {
  const requested = typeof value === "number" && Number.isFinite(value) ? value : 4;
  return requested <= 4 ? "4" : requested <= 8 ? "8" : "12";
}

async function createOpenAiVideo(profile: MediaProfile, input: VideoGenerationInput) {
  if (input.billingAcknowledged !== true || input.dataSharingAcknowledged !== true) {
    throw new Error("Confirm this paid OpenAI video request and the exact prompt and reference image being uploaded.");
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 7_000) : "";
  if (!prompt) throw new Error("Enter a motion prompt before creating a video job.");
  const model = profile.videoModel || "sora-2";
  const sourceAssetUrl = typeof input.sourceAssetUrl === "string" ? input.sourceAssetUrl.trim() : "";
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", prompt);
  form.set("seconds", openAiSeconds(input.durationSeconds));
  form.set("size", input.aspectRatio === "9:16" ? "720x1280" : "1280x720");
  if (sourceAssetUrl) {
    const source = await videoSourceReference(sourceAssetUrl);
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i.exec(source);
    if (match) {
      form.set("input_reference", new Blob([new Uint8Array(Buffer.from(match[2], "base64"))], { type: match[1] }), "plotpickle-reference.png");
    }
  }
  const value = await providerForm(`${normalizedUrl(profile.baseUrl)}/videos`, profile, form);
  const id = typeof value.id === "string" ? value.id : "";
  if (!id) throw new Error("OpenAI returned no video job ID.");
  const now = new Date().toISOString();
  return saveOpenAiJob({
    id,
    provider: "openai",
    route: "openai",
    model,
    status: openAiJobStatus(value.status),
    prompt,
    assetId: safeAssetStem(input.assetId || `openai-video-${id}`),
    sourceAssetUrl,
    durationSeconds: Number(openAiSeconds(input.durationSeconds)),
    aspectRatio: input.aspectRatio === "9:16" || input.aspectRatio === "1:1" ? input.aspectRatio : "16:9",
    outputAssetUrl: "",
    error: "",
    createdAt: now,
    updatedAt: now,
  });
}

async function queryOpenAiVideo(profile: MediaProfile, id: string) {
  const jobs = await readOpenAiJobs();
  const existing = jobs.find((item) => item.id === id);
  if (!existing) throw new Error("This OpenAI video job was not created by the current PlotPickle router.");
  const value = await providerRequest(`${normalizedUrl(profile.baseUrl)}/videos/${encodeURIComponent(id)}`, profile, "GET", 60_000);
  const status = openAiJobStatus(value.status);
  const errorObject = value.error && typeof value.error === "object" ? value.error as { message?: unknown } : {};
  let next: OpenAiVideoJob = {
    ...existing,
    status,
    error: status === "failed" ? typeof errorObject.message === "string" ? errorObject.message.slice(0, 300) : "OpenAI video generation failed." : "",
    updatedAt: new Date().toISOString(),
  };
  if (status === "succeeded" && !next.outputAssetUrl) {
    const response = await fetch(`${normalizedUrl(profile.baseUrl)}/videos/${encodeURIComponent(id)}/content`, {
      headers: { Accept: "video/mp4", Authorization: `Bearer ${profile.apiKey}` },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error("The completed OpenAI video could not be downloaded into local PlotPickle storage.");
    next = { ...next, outputAssetUrl: await saveGeneratedAsset(Buffer.from(await response.arrayBuffer()), next.assetId, ".mp4") };
    profile.videoVerifiedAt = new Date().toISOString();
    profile.lastError = "";
    const media = await readMediaRoutingStore();
    media.profiles.openai = profile;
    await writeMediaRoutingStore(media);
  }
  return saveOpenAiJob(next);
}

async function handleRoutingApi(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { ok: false, message: "AI routing is available only from this local PlotPickle server." });
    return;
  }
  try {
    if (pathname === STATUS_PATH && request.method === "GET") {
      sendJson(response, 200, await statusBody());
      return;
    }
    if (pathname === SELECT_PATH && request.method === "POST") {
      const body = await readBody(request);
      sendJson(response, 200, await selectRoute(body));
      return;
    }
    sendJson(response, 404, { ok: false, message: "AI routing operation not found." });
  } catch (error) {
    sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "AI routing failed." });
  }
}

export function registerAiRoutingGateway(server: ViteDevServer) {
  server.middlewares.use(async (request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname.startsWith(API)) {
      await handleRoutingApi(request, response, pathname);
      return;
    }
    if (pathname === VIDEO_PATH && request.method === "POST") {
      if (!isLocalRequest(request)) {
        sendJson(response, 403, { ok: false, message: "Video generation is available only from this local PlotPickle server." });
        return;
      }
      try {
        const choice = await readRoutingChoice();
        if (choice.video === "off") {
          sendJson(response, 409, { ok: false, message: "Video generation is Off. Select a video provider in Settings → AI Routing." });
          return;
        }
        if (choice.video === "comfyui-native") {
          const native = await readNativeH3Store();
          const probe = await probeNativeH3(native);
          if (!native.active || !probe.ready) {
            sendJson(response, 409, { ok: false, message: probe.error || "Local ComfyUI H3 is selected but is not ready. Open ComfyUI Settings." });
            return;
          }
          next();
          return;
        }
        if (choice.video === "minimax") {
          const media = await readMediaRoutingStore();
          media.videoRoute = "minimax-direct";
          await writeMediaRoutingStore(media);
          next();
          return;
        }
        const media = await readMediaRoutingStore();
        const profile = media.profiles.openai;
        if (!profile?.apiKey || !profile.videoModel) {
          sendJson(response, 409, { ok: false, message: "OpenAI video is selected but its API key or video model is not configured. Open OpenAI Settings." });
          return;
        }
        const body = await readBody(request);
        const job = await createOpenAiVideo(profile, body);
        sendJson(response, 202, { ok: true, ...publicOpenAiJob(job) });
      } catch (error) {
        sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "The selected video provider failed." });
      }
      return;
    }
    if (pathname.startsWith(VIDEO_JOB_PATH) && request.method === "GET") {
      const id = decodeURIComponent(pathname.slice(VIDEO_JOB_PATH.length));
      const jobs = await readOpenAiJobs();
      if (!jobs.some((item) => item.id === id)) {
        next();
        return;
      }
      try {
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Video jobs are available only from this local PlotPickle server." });
          return;
        }
        const media = await readMediaRoutingStore();
        const profile = media.profiles.openai;
        if (!profile) throw new Error("The OpenAI profile used by this video job is no longer configured.");
        const job = await queryOpenAiVideo(profile, id);
        sendJson(response, 200, { ok: true, ...publicOpenAiJob(job) });
      } catch (error) {
        sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "The OpenAI video job could not be checked." });
      }
      return;
    }
    next();
  });
}
