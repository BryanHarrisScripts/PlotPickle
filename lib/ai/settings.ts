import type { AiProviderKind } from "./contracts";

export const SETTINGS_VERSION = "1.0.0" as const;

export type MusicService = "suno" | "udio";

export type MusicArtistLink = {
  id: string;
  service: MusicService;
  artistName: string;
  artistUrl: string;
};

export type PluginSetting = {
  id: string;
  label: string;
  status: "coming-soon";
};

export type PlotPickleSettings = {
  version: typeof SETTINGS_VERSION;
  ai: {
    provider: AiProviderKind;
    baseUrl: string;
    textModel: string;
    imageModel: string;
  };
  music: MusicArtistLink[];
  plugins: PluginSetting[];
};

export const defaultPlotPickleSettings: PlotPickleSettings = {
  version: SETTINGS_VERSION,
  ai: {
    provider: "disabled",
    baseUrl: "",
    textModel: "",
    imageModel: "",
  },
  music: [],
  plugins: [
    { id: "future-knowledge", label: "Knowledge services", status: "coming-soon" },
    { id: "future-publishing", label: "Publishing services", status: "coming-soon" },
    { id: "future-collaboration", label: "Collaboration services", status: "coming-soon" },
  ],
};

export function normalizePlotPickleSettings(value: unknown): PlotPickleSettings {
  if (!value || typeof value !== "object") return structuredClone(defaultPlotPickleSettings);
  const candidate = value as Partial<PlotPickleSettings>;
  const ai = candidate.ai && typeof candidate.ai === "object" ? candidate.ai : {};
  const providerChoices: AiProviderKind[] = ["openai", "openai-compatible", "ollama", "manual", "disabled"];
  const provider = providerChoices.includes(ai.provider as AiProviderKind) ? ai.provider as AiProviderKind : "disabled";
  const music = Array.isArray(candidate.music)
    ? candidate.music.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const link = item as Partial<MusicArtistLink>;
      if ((link.service !== "suno" && link.service !== "udio") || typeof link.id !== "string") return [];
      return [{
        id: link.id,
        service: link.service,
        artistName: typeof link.artistName === "string" ? link.artistName : "",
        artistUrl: typeof link.artistUrl === "string" ? link.artistUrl : "",
      }];
    })
    : [];

  return {
    version: SETTINGS_VERSION,
    ai: {
      provider,
      baseUrl: typeof ai.baseUrl === "string" ? ai.baseUrl : "",
      textModel: typeof ai.textModel === "string" ? ai.textModel : "",
      imageModel: typeof ai.imageModel === "string" ? ai.imageModel : "",
    },
    music,
    plugins: structuredClone(defaultPlotPickleSettings.plugins),
  };
}

export function isSupportedMusicArtistUrl(service: MusicService, value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return service === "suno" ? hostname === "suno.com" : hostname === "udio.com";
  } catch {
    return false;
  }
}
