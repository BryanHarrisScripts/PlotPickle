import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { normalizedUrl } from "../../../../build/media-provider-common";
import {
  readMediaRoutingStore,
  writeMediaRoutingStore,
  type CloudMediaProvider,
  type MediaProfile,
} from "../../../../build/media-routing-store";
import {
  readSynchronizedAssistantStore,
  writeAssistantStore,
  type ProviderProfile,
} from "../../../../build/writing-assistant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CloudProvider = "openai" | "minimax";

type ProviderInput = {
  provider?: unknown;
  baseUrl?: unknown;
  textModel?: unknown;
  imageModel?: unknown;
  videoModel?: unknown;
  apiKey?: unknown;
};

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanText(value: unknown, maximum = 240) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maximum || /[\r\n\0]/u.test(text)) return "";
  return text;
}

function cloudProvider(value: unknown): CloudProvider | null {
  return value === "openai" || value === "minimax" ? value : null;
}

function sameWritingAuthority(current: ProviderProfile | undefined, input: { baseUrl: string; textModel: string; apiKey: string }) {
  return Boolean(current
    && current.baseUrl === input.baseUrl
    && current.textModel === input.textModel
    && current.apiKey === input.apiKey);
}

function sameImageAuthority(current: MediaProfile | undefined, input: { baseUrl: string; imageModel: string; apiKey: string }) {
  return Boolean(current
    && current.baseUrl === input.baseUrl
    && current.imageModel === input.imageModel
    && current.apiKey === input.apiKey);
}

function sameVideoAuthority(current: MediaProfile | undefined, input: { baseUrl: string; videoModel: string; apiKey: string }) {
  return Boolean(current
    && current.baseUrl === input.baseUrl
    && current.videoModel === input.videoModel
    && current.apiKey === input.apiKey);
}

async function authorize(request: Request) {
  const runtimeState = await getProfileExperienceRuntime();
  const origin = new URL(request.url).origin;
  const boundary = runtimeState.boundaryFor(origin);
  return boundary.authorizeRequest(requestBoundary(request), { mutation: true });
}

export async function POST(request: Request) {
  try {
    await authorize(request);
    const input = await request.json() as ProviderInput;
    const provider = cloudProvider(input.provider);
    if (!provider) return response({ ok: false, message: "Choose OpenAI or MiniMax cloud authority." }, 400);

    const baseUrlSource = cleanText(input.baseUrl, 500);
    const textModel = cleanText(input.textModel);
    const imageModel = cleanText(input.imageModel);
    const videoModel = cleanText(input.videoModel);
    if (!baseUrlSource) return response({ ok: false, message: "Enter the provider API address." }, 400);
    if (!textModel || !imageModel || !videoModel) return response({ ok: false, message: "Choose writing, image and video model IDs before saving cloud authority." }, 400);
    const baseUrl = normalizedUrl(baseUrlSource);

    const [assistantResult, mediaStore] = await Promise.all([
      readSynchronizedAssistantStore(),
      readMediaRoutingStore(),
    ]);
    const existingWriting = assistantResult.store.profiles[provider];
    const existingMedia = mediaStore.profiles[provider as CloudMediaProvider];
    const suppliedKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
    const apiKey = suppliedKey || existingWriting?.apiKey || existingMedia?.apiKey || "";
    if (!apiKey) return response({ ok: false, message: `Enter the ${provider === "openai" ? "OpenAI" : "MiniMax"} API key owned by the current human profile.` }, 400);

    const now = new Date().toISOString();
    const writingUnchanged = sameWritingAuthority(existingWriting, { baseUrl, textModel, apiKey });
    const imageUnchanged = sameImageAuthority(existingMedia, { baseUrl, imageModel, apiKey });
    const videoUnchanged = sameVideoAuthority(existingMedia, { baseUrl, videoModel, apiKey });

    assistantResult.store.profiles[provider] = {
      provider,
      baseUrl,
      textModel,
      apiKey,
      configuredAt: now,
      assistantVerifiedAt: writingUnchanged ? existingWriting?.assistantVerifiedAt || "" : "",
      lastAttemptAt: writingUnchanged ? existingWriting?.lastAttemptAt || "" : "",
      lastLatencyMs: writingUnchanged ? existingWriting?.lastLatencyMs || 0 : 0,
      lastPreview: writingUnchanged ? existingWriting?.lastPreview || "" : "",
      lastError: "",
    };

    mediaStore.profiles[provider as CloudMediaProvider] = {
      provider,
      baseUrl,
      imageModel,
      videoModel,
      apiKey,
      configuredAt: now,
      imageVerifiedAt: imageUnchanged ? existingMedia?.imageVerifiedAt || "" : "",
      videoVerifiedAt: videoUnchanged ? existingMedia?.videoVerifiedAt || "" : "",
      lastError: "",
    };

    await Promise.all([
      writeAssistantStore(assistantResult.store),
      writeMediaRoutingStore(mediaStore),
    ]);

    return response({
      ok: true,
      provider,
      configured: true,
      writingReady: Boolean(assistantResult.store.profiles[provider]?.assistantVerifiedAt),
      imageReady: Boolean(mediaStore.profiles[provider as CloudMediaProvider]?.imageVerifiedAt),
      videoReady: Boolean(mediaStore.profiles[provider as CloudMediaProvider]?.videoVerifiedAt),
      message: "Cloud authority saved for the authenticated human profile. No paid provider request was run and no route was activated.",
    });
  } catch {
    return response({ ok: false, message: "Cloud authority could not be saved for this authenticated human profile." }, 403);
  }
}
