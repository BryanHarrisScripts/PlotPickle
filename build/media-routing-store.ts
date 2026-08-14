import { createHash } from "node:crypto";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";

export type CloudMediaProvider = "openai" | "minimax";
export type ImageRoute = "comfyui" | "openai" | "minimax" | "manual";
export type VideoRoute = "minimax-direct" | "minimax-comfyui" | "none";

export type MediaProfile = {
  provider: CloudMediaProvider;
  baseUrl: string;
  imageModel: string;
  videoModel: string;
  apiKey: string;
  configuredAt: string;
  imageVerifiedAt: string;
  videoVerifiedAt: string;
  lastError: string;
};

export type ComfyWorkflow = {
  source: Record<string, unknown>;
  hash: string;
  nodeClasses: string[];
  configuredAt: string;
  verifiedAt: string;
  verifiedHash: string;
  lastError: string;
};

export type MediaRoutingStore = {
  version: 1;
  imageRoute: ImageRoute;
  videoRoute: VideoRoute;
  profiles: Partial<Record<CloudMediaProvider, MediaProfile>>;
  comfyui: {
    baseUrl: string;
    checkpoint: string;
    imageVerifiedAt: string;
    lastError: string;
    h3Workflow: ComfyWorkflow | null;
  };
};

type ExistingAiConnection = {
  version?: unknown;
  provider?: unknown;
  baseUrl?: unknown;
  imageModel?: unknown;
  videoModel?: unknown;
  apiKey?: unknown;
  verifiedAt?: unknown;
};

const STORE_FILE = "media-routing.json";
const AI_FILE = "ai-connection.json";
const imageRoutes: ImageRoute[] = ["comfyui", "openai", "minimax", "manual"];
const videoRoutes: VideoRoute[] = ["minimax-direct", "minimax-comfyui", "none"];

function emptyStore(): MediaRoutingStore {
  return {
    version: 1,
    imageRoute: "comfyui",
    videoRoute: "none",
    profiles: {},
    comfyui: {
      baseUrl: "http://127.0.0.1:8188",
      checkpoint: "",
      imageVerifiedAt: "",
      lastError: "",
      h3Workflow: null,
    },
  };
}

function isProfile(value: unknown): value is MediaProfile {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MediaProfile>;
  return (item.provider === "openai" || item.provider === "minimax")
    && typeof item.baseUrl === "string"
    && typeof item.imageModel === "string"
    && typeof item.videoModel === "string"
    && typeof item.apiKey === "string"
    && typeof item.configuredAt === "string"
    && typeof item.imageVerifiedAt === "string"
    && typeof item.videoVerifiedAt === "string"
    && typeof item.lastError === "string";
}

function normalizeStore(value: unknown): MediaRoutingStore {
  const fallback = emptyStore();
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<MediaRoutingStore>;
  const comfy = item.comfyui && typeof item.comfyui === "object" ? item.comfyui : fallback.comfyui;
  const profiles: MediaRoutingStore["profiles"] = {};
  if (isProfile(item.profiles?.openai)) profiles.openai = item.profiles.openai;
  if (isProfile(item.profiles?.minimax)) profiles.minimax = item.profiles.minimax;
  return {
    version: 1,
    imageRoute: imageRoutes.includes(item.imageRoute as ImageRoute) ? item.imageRoute as ImageRoute : fallback.imageRoute,
    videoRoute: videoRoutes.includes(item.videoRoute as VideoRoute) ? item.videoRoute as VideoRoute : fallback.videoRoute,
    profiles,
    comfyui: {
      baseUrl: typeof comfy.baseUrl === "string" ? comfy.baseUrl : fallback.comfyui.baseUrl,
      checkpoint: typeof comfy.checkpoint === "string" ? comfy.checkpoint : "",
      imageVerifiedAt: typeof comfy.imageVerifiedAt === "string" ? comfy.imageVerifiedAt : "",
      lastError: typeof comfy.lastError === "string" ? comfy.lastError : "",
      h3Workflow: comfy.h3Workflow && typeof comfy.h3Workflow === "object" ? comfy.h3Workflow : null,
    },
  };
}

function importedProfile(value: ExistingAiConnection): MediaProfile | null {
  if (value.provider !== "openai" && value.provider !== "minimax") return null;
  if (typeof value.baseUrl !== "string" || typeof value.apiKey !== "string") return null;
  return {
    provider: value.provider,
    baseUrl: value.baseUrl,
    imageModel: typeof value.imageModel === "string" ? value.imageModel : "",
    videoModel: typeof value.videoModel === "string" ? value.videoModel : "",
    apiKey: value.apiKey,
    configuredAt: typeof value.verifiedAt === "string" ? value.verifiedAt : new Date().toISOString(),
    imageVerifiedAt: "",
    videoVerifiedAt: "",
    lastError: "",
  };
}

function sameProfile(left: MediaProfile | undefined, right: MediaProfile) {
  return Boolean(left
    && left.baseUrl === right.baseUrl
    && left.imageModel === right.imageModel
    && left.videoModel === right.videoModel
    && left.apiKey === right.apiKey);
}

export function workflowHash(source: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}

export async function readMediaRoutingStore() {
  const [stored, existing] = await Promise.all([
    readCredentialJson<unknown>(STORE_FILE),
    readCredentialJson<ExistingAiConnection>(AI_FILE),
  ]);
  const next = normalizeStore(stored);
  const imported = existing ? importedProfile(existing) : null;
  let changed = !stored;
  if (imported && !sameProfile(next.profiles[imported.provider], imported)) {
    next.profiles[imported.provider] = imported;
    changed = true;
  }
  if (next.videoRoute === "minimax-comfyui") {
    const workflow = next.comfyui.h3Workflow;
    if (!workflow?.verifiedAt || workflow.verifiedHash !== workflow.hash) {
      next.videoRoute = "none";
      changed = true;
    }
  }
  if (changed) await writeMediaRoutingStore(next);
  return next;
}

export async function writeMediaRoutingStore(value: MediaRoutingStore) {
  await writeCredentialJson(STORE_FILE, value);
}

export function publicMediaProfile(value: MediaProfile | undefined) {
  return value ? {
    configured: true,
    provider: value.provider,
    baseUrl: value.baseUrl,
    imageModel: value.imageModel,
    videoModel: value.videoModel,
    configuredAt: value.configuredAt,
    imageVerifiedAt: value.imageVerifiedAt,
    videoVerifiedAt: value.videoVerifiedAt,
    lastError: value.lastError,
  } : { configured: false };
}
