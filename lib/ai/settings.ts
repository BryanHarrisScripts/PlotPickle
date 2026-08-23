import type { AiProviderKind } from "./contracts";

export const SETTINGS_VERSION = "1.3.0" as const;

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
  status: "enabled" | "disabled" | "coming-soon";
};

export type PlotPickleSettings = {
  version: typeof SETTINGS_VERSION;
  general: {
    language: string;
    startupPage: "dashboard" | "simple-start";
    confirmDestructiveActions: boolean;
  };
  appearance: {
    theme: "system" | "light" | "dark";
    density: "comfortable" | "compact";
    reduceTransparency: boolean;
  };
  projectDefaults: {
    format: "feature" | "short" | "series" | "stage";
    targetMinutes: number;
    autosaveSeconds: number;
  };
  storage: {
    backupOnSave: boolean;
    backupLimit: number;
  };
  ai: {
    provider: AiProviderKind;
    baseUrl: string;
    textModel: string;
    imageModel: string;
    videoModel: string;
  };
  privacy: {
    diagnosticReports: boolean;
    confirmExternalSharing: boolean;
  };
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    largeText: boolean;
  };
  music: MusicArtistLink[];
  plugins: PluginSetting[];
};

const defaultMediaEnginePlaceholders: PluginSetting[] = [];

const retiredPlaceholderIds = new Set([
  "future-knowledge",
  "future-publishing",
  "future-collaboration",
  "future-pika",
  "future-runway",
  "future-media-engine",
]);

export const defaultPlotPickleSettings: PlotPickleSettings = {
  version: SETTINGS_VERSION,
  general: {
    language: "English",
    startupPage: "dashboard",
    confirmDestructiveActions: true,
  },
  appearance: {
    theme: "dark",
    density: "comfortable",
    reduceTransparency: false,
  },
  projectDefaults: {
    format: "feature",
    targetMinutes: 105,
    autosaveSeconds: 30,
  },
  storage: {
    backupOnSave: true,
    backupLimit: 20,
  },
  ai: {
    provider: "disabled",
    baseUrl: "",
    textModel: "",
    imageModel: "",
    videoModel: "",
  },
  privacy: {
    diagnosticReports: false,
    confirmExternalSharing: true,
  },
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    largeText: false,
  },
  music: [],
  plugins: structuredClone(defaultMediaEnginePlaceholders),
};

export function normalizePlotPickleSettings(value: unknown): PlotPickleSettings {
  if (!value || typeof value !== "object") return structuredClone(defaultPlotPickleSettings);
  const candidate = value as Partial<PlotPickleSettings>;
  const general: Partial<PlotPickleSettings["general"]> = candidate.general && typeof candidate.general === "object" ? candidate.general : {};
  const appearance: Partial<PlotPickleSettings["appearance"]> = candidate.appearance && typeof candidate.appearance === "object" ? candidate.appearance : {};
  const projectDefaults: Partial<PlotPickleSettings["projectDefaults"]> = candidate.projectDefaults && typeof candidate.projectDefaults === "object" ? candidate.projectDefaults : {};
  const storage: Partial<PlotPickleSettings["storage"]> = candidate.storage && typeof candidate.storage === "object" ? candidate.storage : {};
  const ai: Partial<PlotPickleSettings["ai"]> = candidate.ai && typeof candidate.ai === "object" ? candidate.ai : {};
  const privacy: Partial<PlotPickleSettings["privacy"]> = candidate.privacy && typeof candidate.privacy === "object" ? candidate.privacy : {};
  const accessibility: Partial<PlotPickleSettings["accessibility"]> = candidate.accessibility && typeof candidate.accessibility === "object" ? candidate.accessibility : {};
  const providerChoices: AiProviderKind[] = ["openai", "minimax", "openai-compatible", "ollama", "manual", "disabled"];
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

  const normalizedPlugins = Array.isArray(candidate.plugins)
    ? candidate.plugins.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const plugin = item as Partial<PluginSetting>;
      if (typeof plugin.id !== "string" || typeof plugin.label !== "string" || retiredPlaceholderIds.has(plugin.id)) return [];
      const status: PluginSetting["status"] = plugin.status === "enabled" || plugin.status === "disabled" ? plugin.status : "coming-soon";
      return [{ id: plugin.id, label: plugin.label, status }];
    })
    : structuredClone(defaultPlotPickleSettings.plugins);
  const plugins = normalizedPlugins;

  return {
    version: SETTINGS_VERSION,
    general: {
      language: typeof general.language === "string" && general.language.trim() ? general.language.trim() : defaultPlotPickleSettings.general.language,
      startupPage: general.startupPage === "simple-start" ? "simple-start" : "dashboard",
      confirmDestructiveActions: typeof general.confirmDestructiveActions === "boolean" ? general.confirmDestructiveActions : true,
    },
    appearance: {
      theme: appearance.theme === "system" || appearance.theme === "light" || appearance.theme === "dark"
        ? appearance.theme
        : defaultPlotPickleSettings.appearance.theme,
      density: appearance.density === "compact" ? "compact" : "comfortable",
      reduceTransparency: Boolean(appearance.reduceTransparency),
    },
    projectDefaults: {
      format: ["feature", "short", "series", "stage"].includes(String(projectDefaults.format))
        ? projectDefaults.format as PlotPickleSettings["projectDefaults"]["format"]
        : "feature",
      targetMinutes: Number.isFinite(projectDefaults.targetMinutes) ? Math.max(1, Math.min(600, Number(projectDefaults.targetMinutes))) : 105,
      autosaveSeconds: Number.isFinite(projectDefaults.autosaveSeconds) ? Math.max(5, Math.min(300, Number(projectDefaults.autosaveSeconds))) : 30,
    },
    storage: {
      backupOnSave: typeof storage.backupOnSave === "boolean" ? storage.backupOnSave : true,
      backupLimit: Number.isFinite(storage.backupLimit) ? Math.max(1, Math.min(100, Number(storage.backupLimit))) : 20,
    },
    ai: {
      provider,
      baseUrl: typeof ai.baseUrl === "string" ? ai.baseUrl : "",
      textModel: typeof ai.textModel === "string" ? ai.textModel : "",
      imageModel: typeof ai.imageModel === "string" ? ai.imageModel : "",
      videoModel: typeof ai.videoModel === "string" ? ai.videoModel : "",
    },
    privacy: {
      diagnosticReports: Boolean(privacy.diagnosticReports),
      confirmExternalSharing: typeof privacy.confirmExternalSharing === "boolean" ? privacy.confirmExternalSharing : true,
    },
    accessibility: {
      highContrast: Boolean(accessibility.highContrast),
      reducedMotion: Boolean(accessibility.reducedMotion),
      largeText: Boolean(accessibility.largeText),
    },
    music,
    plugins,
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
