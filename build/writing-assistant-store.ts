import { readCredentialJson, writeCredentialJson } from "./local-credentials";

export type TextProvider = "ollama" | "openai" | "minimax";
export type ActiveTextProvider = TextProvider | "disabled";

export type ProviderProfile = {
  provider: TextProvider;
  baseUrl: string;
  textModel: string;
  apiKey: string;
  configuredAt: string;
  assistantVerifiedAt: string;
  lastAttemptAt: string;
  lastLatencyMs: number;
  lastPreview: string;
  lastError: string;
};

export type ProfileStore = {
  version: 1;
  activeProvider: ActiveTextProvider;
  explicitlyDisabled: boolean;
  ollamaBaseUrl: string;
  profiles: Partial<Record<TextProvider, ProviderProfile>>;
};

type LegacyAiConnection = {
  provider?: unknown;
  baseUrl?: unknown;
  textModel?: unknown;
  apiKey?: unknown;
  verifiedAt?: unknown;
};

const STORE_FILE = "writing-assistant-profiles.json";
const LEGACY_FILE = "ai-connection.json";
export const TEXT_PROVIDERS: TextProvider[] = ["ollama", "openai", "minimax"];

export function isTextProvider(value: unknown): value is TextProvider {
  return typeof value === "string" && TEXT_PROVIDERS.includes(value as TextProvider);
}

function emptyStore(): ProfileStore {
  return {
    version: 1,
    activeProvider: "disabled",
    explicitlyDisabled: false,
    ollamaBaseUrl: "http://127.0.0.1:11434",
    profiles: {},
  };
}

function normalizeProfile(value: unknown, provider: TextProvider): ProviderProfile | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ProviderProfile>;
  if (item.provider !== provider || typeof item.baseUrl !== "string" || typeof item.textModel !== "string" || typeof item.apiKey !== "string") return null;
  return {
    provider,
    baseUrl: item.baseUrl,
    textModel: item.textModel,
    apiKey: item.apiKey,
    configuredAt: typeof item.configuredAt === "string" ? item.configuredAt : "",
    assistantVerifiedAt: typeof item.assistantVerifiedAt === "string" ? item.assistantVerifiedAt : "",
    lastAttemptAt: typeof item.lastAttemptAt === "string" ? item.lastAttemptAt : "",
    lastLatencyMs: typeof item.lastLatencyMs === "number" && Number.isFinite(item.lastLatencyMs) ? item.lastLatencyMs : 0,
    lastPreview: typeof item.lastPreview === "string" ? item.lastPreview : "",
    lastError: typeof item.lastError === "string" ? item.lastError : "",
  };
}

function normalizeStore(value: unknown): ProfileStore {
  const fallback = emptyStore();
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<ProfileStore>;
  const profiles: Partial<Record<TextProvider, ProviderProfile>> = {};
  for (const provider of TEXT_PROVIDERS) {
    const profile = normalizeProfile(item.profiles?.[provider], provider);
    if (profile) profiles[provider] = profile;
  }
  return {
    version: 1,
    activeProvider: item.activeProvider === "disabled" || isTextProvider(item.activeProvider) ? item.activeProvider : "disabled",
    explicitlyDisabled: item.explicitlyDisabled === true,
    ollamaBaseUrl: typeof item.ollamaBaseUrl === "string" && item.ollamaBaseUrl.trim()
      ? item.ollamaBaseUrl.trim()
      : profiles.ollama?.baseUrl || fallback.ollamaBaseUrl,
    profiles,
  };
}

function legacyProfile(value: unknown): ProviderProfile | null {
  if (!value || typeof value !== "object") return null;
  const item = value as LegacyAiConnection;
  if (!isTextProvider(item.provider) || typeof item.baseUrl !== "string" || typeof item.textModel !== "string" || !item.textModel.trim() || typeof item.apiKey !== "string") return null;
  return {
    provider: item.provider,
    baseUrl: item.baseUrl,
    textModel: item.textModel,
    apiKey: item.apiKey,
    configuredAt: typeof item.verifiedAt === "string" ? item.verifiedAt : new Date().toISOString(),
    assistantVerifiedAt: "",
    lastAttemptAt: "",
    lastLatencyMs: 0,
    lastPreview: "",
    lastError: "",
  };
}

function sameConnection(left: ProviderProfile | undefined, right: ProviderProfile) {
  return Boolean(left
    && left.provider === right.provider
    && left.baseUrl === right.baseUrl
    && left.textModel === right.textModel
    && left.apiKey === right.apiKey);
}

export async function readSynchronizedAssistantStore() {
  const storedValue = await readCredentialJson<unknown>(STORE_FILE);
  const existed = Boolean(storedValue);
  const store = normalizeStore(storedValue);
  const imported = legacyProfile(await readCredentialJson<unknown>(LEGACY_FILE));
  let changed = false;

  if (imported) {
    const current = store.profiles[imported.provider];
    if (!sameConnection(current, imported)) {
      store.profiles[imported.provider] = imported;
      changed = true;
    }
    if (imported.provider === "ollama" && store.ollamaBaseUrl !== imported.baseUrl) {
      store.ollamaBaseUrl = imported.baseUrl;
      changed = true;
    }
    if ((!existed || !isTextProvider(store.activeProvider) || !store.profiles[store.activeProvider]) && !store.explicitlyDisabled) {
      store.activeProvider = imported.provider;
      changed = true;
    }
  }

  if (changed) await writeAssistantStore(store);
  return { store, available: existed || Boolean(imported) };
}

export async function writeAssistantStore(store: ProfileStore) {
  await writeCredentialJson(STORE_FILE, store);
}

export function publicProfile(profile: ProviderProfile | undefined, activeProvider: ActiveTextProvider) {
  if (!profile) return { configured: false, ready: false, active: false };
  return {
    configured: Boolean(profile.textModel),
    ready: Boolean(profile.assistantVerifiedAt),
    active: activeProvider === profile.provider,
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    model: profile.textModel,
    configuredAt: profile.configuredAt,
    verifiedAt: profile.assistantVerifiedAt,
    lastAttemptAt: profile.lastAttemptAt,
    latencyMs: profile.lastLatencyMs,
    preview: profile.lastPreview,
    error: profile.lastError,
  };
}
