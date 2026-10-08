import { readCapabilityDiagnostics, relayCapabilityDiagnostic } from "./ai/capabilities/capability-diagnostics";
import { cloudMediaReadiness, writingReadiness, computeReadiness } from "../core/contracts/compute/compute-readiness.mjs";
import { localRuntimeSnapshot } from "./local-runtime-manager";
import { readCapabilityChoice, readProviderConsent, saveProviderConsent, requireRouteConsent } from "./ai/capabilities/capability-routing-state";
import { requireSelectedCapability } from "../core/contracts/compute/capability-routes.mjs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { readCredentialJson, writeCredentialJson, writeComputeSelection } from "./local-credentials";
import {
  probeNativeH3,
  readNativeH3Store,
  writeNativeH3Store,
} from "./ai/h3/comfyui-h3-native-provider";
import { diagnoseComfyUI } from "./ai/comfyui-connection-diagnostics";
import { generateComfyImage, probeComfyUI } from "./ai/comfyui-media-provider";
import {
  readMediaRoutingStore,
  writeMediaRoutingStore,
  type MediaProfile,
} from "./media-routing-store";
import {
  readSynchronizedAssistantStore,
  writeAssistantStore,
  type ActiveTextProvider,
  type ProviderProfile,
} from "./writing-assistant-store";
import { generateAssistantText, probeOllama } from "./writing-assistant-provider";
import {
  normalizedUrl,
  providerForm,
  providerRequest,
  safeAssetStem,
  saveGeneratedAsset,
  videoSourceReference,
  type ImageGenerationInput,
  type VideoGenerationInput,
} from "./media-provider-common";

export type TextRoute = "local" | "ollama" | "openai" | "minimax" | "gemini" | "off";
export type ImageRoute = "comfyui" | "ollama-comfyui" | "openai" | "minimax" | "manual";
export type VideoRoute = "comfyui-native" | "minimax" | "minimax-comfyui" | "openai" | "off";

type RoutingChoice = {
  version: 1 | 2;
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

export async function readRoutingChoice(): Promise<RoutingChoice> {
  return await readCapabilityChoice() as RoutingChoice;
}

function profileState(profile: MediaProfile | undefined, kind: "image" | "video") {
  return { ...cloudMediaReadiness(profile, kind), model: profile?.[`${kind}Model`] || "", error: profile?.lastError || "" };
}
function textProfileState(profile: ProviderProfile | undefined, available = true) {
  return { ...writingReadiness(profile, available), model: profile?.textModel || "" };
}

async function statusBody() {
  const [choice, assistantResult, media, native] = await Promise.all([
    readRoutingChoice(),
    readSynchronizedAssistantStore(),
    readMediaRoutingStore(),
    readNativeH3Store(),
  ]);
  const [comfy, nativeProbe, localRuntime] = await Promise.all([
    diagnoseComfyUI(media.comfyui.baseUrl, media.comfyui.h3Workflow),
    probeNativeH3(native),
    localRuntimeSnapshot(),
  ]);
  const [ollamaProbe, providerConsent, comfyCloud, qwenProbe] = await Promise.all([
    assistantResult.store.profiles.ollama ? probeOllama(assistantResult.store.profiles.ollama.baseUrl) : Promise.resolve(null),
    readProviderConsent(),
    readCredentialJson<{ apiKey?: string; testedAt?: string }>("comfy-cloud.json"),
    media.comfyui.imageProfile === "qwen-image-2.1-experimental" ? probeComfyUI(media.comfyui.baseUrl, media.comfyui.qwenImage21.workflow) : Promise.resolve(null),
  ]);
  const assistant = assistantResult.store;
  const ollama = assistant.profiles.ollama;
  const openAiText = assistant.profiles.openai;
  const minimaxText = assistant.profiles.minimax;
  const geminiText = assistant.profiles.gemini;
  const checkpoint = media.comfyui.checkpoint || comfy.checkpoints[0] || "";
  const comfyImageConfigured = Boolean(comfy.reachable && checkpoint);
  const sdxlImageReady = computeReadiness({ configured: comfyImageConfigured && comfy.imageNodesReady, available: comfy.reachable, verifiedAt: media.comfyui.imageVerifiedAt, error: media.comfyui.lastError }).ready;
  const comfyImageReady = qwenProbe ? Boolean(qwenProbe.reachable && qwenProbe.workflowNodesReady && media.comfyui.qwenImage21.licenseAcknowledgedAt && media.comfyui.imageVerifiedAt && !media.comfyui.qwenImage21.lastError) : sdxlImageReady;
  const workflow = media.comfyui.h3Workflow;
  const apiVideoConfigured = Boolean(workflow && media.profiles.minimax?.apiKey && media.profiles.minimax.videoModel);
  const apiVideoReady = Boolean(apiVideoConfigured && comfy.reachable && comfy.workflowNodesReady && workflow?.verifiedAt && workflow.verifiedHash === workflow.hash && !workflow.lastError);
  const cloudConnection = { label: "ComfyUI Cloud", configured: Boolean(comfyCloud?.apiKey), connectionVerified: Boolean(comfyCloud?.testedAt), ready: false, model: "", verifiedAt: "", locality: "cloud", cost: "Comfy Cloud account usage", settingsTarget: "comfy-cloud", supported: false, error: "Connection setup is available; an executable, verified generation workflow is still required." };
  const ollamaImageConfigured = Boolean(ollama?.textModel && comfyImageConfigured);
  const ollamaImageReady = Boolean(writingReadiness(ollama, Boolean(ollamaProbe?.reachable && ollamaProbe.models.includes(ollama?.textModel || ""))).ready && comfyImageReady);
  return {
    ok: true,
    choice,
    providerConsent,
    consent: {
      cloudSelectionRequiresCostAcknowledgement: true,
      cloudVideoRequiresDataSharingAcknowledgement: true,
      silentPaidFallback: false,
    },
    text: {
      selected: choice.text,
      options: {
        local: {
          ...textProfileState(assistant.profiles.local, localRuntime.activeRuntime.reachable && localRuntime.roles.fast.available),
          locality: "local", cost: "No per-request provider charge", settingsTarget: "",
        },
        ollama: {
          ...textProfileState(ollama, Boolean(ollamaProbe?.reachable && ollamaProbe.models.includes(ollama?.textModel || ""))),
          locality: "local",
          cost: "No per-request provider charge",
          settingsTarget: "ollama",
        },
        openai: {
          ...textProfileState(openAiText),
          locality: "cloud",
          cost: "Paid API usage",
          settingsTarget: "openai",
        },
        minimax: {
          ...textProfileState(minimaxText),
          locality: "cloud",
          cost: "Paid API usage",
          settingsTarget: "minimax",
        },
        gemini: {
          ...textProfileState(geminiText),
          locality: "cloud",
          cost: "Provider account usage",
          settingsTarget: "gemini",
        },
        off: {
          configured: true,
          ready: false,
          disabled: true,
          model: "",
          verifiedAt: "",
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
          model: checkpoint,
          verifiedAt: media.comfyui.imageVerifiedAt,
          error: media.comfyui.lastError || comfy.error || comfy.capabilityError,
          locality: "local",
          cost: "No per-request provider charge",
          settingsTarget: "comfyui",
        },
        "ollama-comfyui": {
          configured: ollamaImageConfigured,
          ready: ollamaImageReady,
          model: [ollama?.textModel, checkpoint].filter(Boolean).join(" → "),
          verifiedAt: ollamaImageReady ? media.comfyui.imageVerifiedAt : "",
          error: ollama?.lastError || media.comfyui.lastError || comfy.error || comfy.capabilityError || (!ollama?.textModel ? "Select and test an Ollama LLM first." : ""),
          locality: "local",
          cost: "No per-request provider charge",
          settingsTarget: "ollama",
        },
        openai: { ...profileState(media.profiles.openai, "image"), locality: "cloud", cost: "Paid API usage", settingsTarget: "openai" },
        minimax: { ...profileState(media.profiles.minimax, "image"), locality: "cloud", cost: "Paid API usage", settingsTarget: "minimax" },
        "comfy-cloud": cloudConnection,
        manual: {
          configured: true,
          ready: false,
          disabled: true,
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
        "minimax-comfyui": {
          label: "ComfyUI", configured: apiVideoConfigured, ready: apiVideoReady, model: media.profiles.minimax?.videoModel || "MiniMax-H3", verifiedAt: workflow?.verifiedAt || "", locality: "local", inferenceLocation: "cloud", provider: "minimax", cost: "Cloud generation through your MiniMax API account", settingsTarget: "comfyui", error: apiVideoReady ? "" : comfy.error || workflow?.lastError || "Configure and test the MiniMax API video workflow in local ComfyUI Setup.", workflowFamily: JSON.stringify(workflow?.source || {}).includes("{{PLOTPICKLE_SOURCE_IMAGE}}") ? "image-to-video" : "text-to-video",
        },
        "comfy-cloud": cloudConnection,
        "comfyui-openai": { label: "ComfyUI · OpenAI", configured: false, ready: false, locality: "local", inferenceLocation: "cloud", provider: "openai", supported: false, settingsTarget: "comfyui", error: "OpenAI Videos/Sora API was removed September 24, 2026. No supported local ComfyUI video adapter is available." },
        "comfyui-native": {
          label: "ComfyUI — Native local inference",
          configured: nativeProbe.manifestConfigured,
          ready: Boolean(nativeProbe.ready && native.verifiedAt),
          model: "MiniMax-H3",
          verifiedAt: native.verifiedAt || "",
          error: native.lastError || nativeProbe.error,
          locality: "local",
          cost: "No per-request provider charge",
          settingsTarget: "comfyui",
          workflowFamily: nativeProbe.workflowFamily || "",
          vramProfile: nativeProbe.vramProfile || "",
          performanceAcknowledged: native.allowConstrainedVram,
        },
        minimax: { ...profileState(media.profiles.minimax, "video"), locality: "cloud", cost: "Paid API usage", settingsTarget: "minimax" },
        openai: { ...profileState(media.profiles.openai, "video"), ready: false, supported: false, error: "OpenAI Videos/Sora API was removed September 24, 2026.", locality: "cloud", cost: "Paid API usage", settingsTarget: "openai" },
        off: {
          configured: true,
          ready: false,
          disabled: true,
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

async function selectRoute(body: Record<string, unknown>) {
  const capability = body.capability;
  const route = body.route;
  const names = ["ai-routing.json", "writing-assistant-profiles.json", "media-routing.json", "h3-native-routing.json"];
  const expected = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readCredentialJson(name)])));
  const status = await statusBody();
  requireSelectedCapability(status, capability, route);
  await requireRouteConsent(String(capability), String(route));
  const choice = await readRoutingChoice();
  const [assistantResult, media, native] = await Promise.all([
    readSynchronizedAssistantStore(),
    readMediaRoutingStore(),
    readNativeH3Store(),
  ]);

  if (capability === "text") {
    if (route !== "local" && route !== "ollama" && route !== "openai" && route !== "minimax" && route !== "gemini" && route !== "off") throw new Error("Choose Ollama, OpenAI, Google Gemini, MiniMax or Off for text.");
    assistantResult.store.activeProvider = route === "off" ? "disabled" : route;
    assistantResult.store.explicitlyDisabled = route === "off";
    choice.text = route;
  } else if (capability === "image") {
    if (route !== "comfyui" && route !== "ollama-comfyui" && route !== "openai" && route !== "minimax" && route !== "manual") throw new Error("Choose ComfyUI, Ollama + ComfyUI, OpenAI, MiniMax or Manual for images.");
    media.imageRoute = route === "ollama-comfyui" ? "comfyui" : route;
    choice.image = route;
  } else if (capability === "video") {
    if (route !== "comfyui-native" && route !== "minimax-comfyui" && route !== "openai" && route !== "minimax" && route !== "off") throw new Error("Choose local ComfyUI H3, OpenAI, MiniMax or Off for video.");
    native.active = false;
    media.videoRoute = route === "minimax" ? "minimax-direct" : route === "minimax-comfyui" ? "minimax-comfyui" : "none";
    if (route === "comfyui-native") {
      const probe = await probeNativeH3(native);
      native.active = probe.ready;
      native.lastError = probe.ready ? "" : probe.error || "Native H3 is selected but still needs setup.";
    }
    choice.video = route;
  } else {
    throw new Error("Choose text, image or video routing.");
  }

  choice.version = 2;
  choice.updatedAt = new Date().toISOString();
  const updates: Record<string, unknown> = { "ai-routing.json": choice, "story-mode-policy.json": { version: 1, mode: "hybrid", updatedAt: choice.updatedAt } };
  if (capability === "text") updates["writing-assistant-profiles.json"] = assistantResult.store;
  if (capability === "image" || capability === "video") updates["media-routing.json"] = media;
  if (capability === "video") updates["h3-native-routing.json"] = native;
  await writeComputeSelection(updates, Object.fromEntries(Object.entries(expected).filter(([name]) => name in updates)));
  await relayCapabilityDiagnostic(capability as "text" | "image" | "video", String(route), "selection", "selected-ready-route");
  return statusBody();
}

export async function createOllamaComfyImage(input: ImageGenerationInput) {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) throw new Error("Enter an image prompt before generating.");
  const [assistantResult, media] = await Promise.all([
    readSynchronizedAssistantStore(),
    readMediaRoutingStore(),
  ]);
  const ollama = assistantResult.store.profiles.ollama;
  if (!ollama?.assistantVerifiedAt) throw new Error("Ollama + ComfyUI is selected, but the Ollama LLM has not passed its response test. Open Ollama Settings.");
  const comfy = await diagnoseComfyUI(media.comfyui.baseUrl, media.comfyui.h3Workflow);
  const checkpoint = media.comfyui.checkpoint || comfy.checkpoints[0] || "";
  if (!comfy.reachable) throw new Error(comfy.error || "ComfyUI is not reachable.");
  if (!comfy.imageNodesReady || !checkpoint) throw new Error(comfy.capabilityError || "ComfyUI is running but its image workflow is not ready.");
  const revisedPrompt = await generateAssistantText(
    ollama,
    "Rewrite the writer's request as one concise cinematic image-generation prompt. Preserve names, setting, action, emotion and continuity. Return only the improved prompt.",
    prompt,
  );
  if (!revisedPrompt) throw new Error("The selected Ollama model returned no image prompt.");
  try {
    const result = await generateComfyImage(media.comfyui.baseUrl, checkpoint, { ...input, prompt: revisedPrompt });
    media.comfyui.checkpoint = checkpoint;
    media.comfyui.imageVerifiedAt = new Date().toISOString();
    media.comfyui.lastError = "";
    await writeMediaRoutingStore(media);
    return { ...result, revisedPrompt, promptModel: ollama.textModel };
  } catch (error) {
    media.comfyui.lastError = error instanceof Error ? error.message : "The Ollama + ComfyUI image route failed.";
    await writeMediaRoutingStore(media);
    throw error;
  }
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
    if (pathname === `${API}/diagnostics` && request.method === "GET") {
      sendJson(response, 200, { ok: true, events: await readCapabilityDiagnostics() }); return;
    }
    if (pathname === `${API}/consent`) {
      if (request.method === "GET") { sendJson(response, 200, { ok: true, providers: await readProviderConsent() }); return; }
      if (request.method === "POST") {
        const body = await readBody(request);
        sendJson(response, 200, { ok: true, providers: await saveProviderConsent(String(body.provider), body.billing === true, body.dataSharing === true) });
        return;
      }
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
      let selectedVideo = "off";
      try {
        const choice = await readRoutingChoice();
        selectedVideo = choice.video;
        const status = await statusBody();
        await relayCapabilityDiagnostic("video", choice.video, "preflight", status.video.options[choice.video as keyof typeof status.video.options]?.ready ? "ready" : "selected-route-unavailable");
        requireSelectedCapability(status, "video", choice.video);
        await requireRouteConsent("video", choice.video);
        if (choice.video === "off") {
          sendJson(response, 409, { ok: false, message: "Video generation is Off. Select a video provider in Settings → Hybrid." });
          return;
        }
        if (choice.video === "comfyui-native") {
          const native = await readNativeH3Store();
          const probe = await probeNativeH3(native);
          if (!probe.ready) {
            sendJson(response, 409, { ok: false, message: probe.error || "Local ComfyUI H3 is selected but is not ready. Open ComfyUI Settings." });
            return;
          }
          next();
          return;
        }
        if (choice.video === "minimax" || choice.video === "minimax-comfyui") {
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
        await relayCapabilityDiagnostic("video", selectedVideo, "failed", "video-preflight-failed");
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
