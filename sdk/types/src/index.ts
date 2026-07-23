import type { PlotPickleProject } from "../../../lib/project";
import type { CanonBinder, CanonEntry, CanonSection, CanonStatus } from "../../../lib/canon-binder";
import type {
  PluginCapability,
  PluginManifest,
  PluginPermission,
  PluginRegistration,
  PluginRegistry,
} from "../../../lib/plugin-platform";
import type {
  AIService,
  AssetService,
  CanonService,
  GitService,
  PlotPickleServices,
  PluginService,
  ProjectService,
  ReportService,
  ScreenplayService,
  StorageService,
  StoryboardService,
  TimelineService,
} from "../../../lib/core-services";

export const PLOTPICKLE_SDK_VERSION = "0.1.0" as const;
export const PLOTPICKLE_SDK_API_VERSION = "1.0.0" as const;

export type PlotPickleSdkApiVersion = typeof PLOTPICKLE_SDK_API_VERSION;
export type PlotPickleSdkVersion = typeof PLOTPICKLE_SDK_VERSION;

export type SdkConnectionOptions = {
  apiVersion: PlotPickleSdkApiVersion;
  clientName: string;
  clientVersion: string;
};

export type SdkHost = {
  apiVersion: PlotPickleSdkApiVersion;
  services: PlotPickleServices;
};

export type SdkConnection = {
  apiVersion: PlotPickleSdkApiVersion;
  sdkVersion: PlotPickleSdkVersion;
  clientName: string;
  clientVersion: string;
  services: PlotPickleServices;
};

export type ProjectSnapshot = Readonly<PlotPickleProject>;
export type CanonQuery = { sections?: CanonSection[]; statuses?: CanonStatus[]; tags?: string[]; text?: string };

export type {
  AIService,
  AssetService,
  CanonBinder,
  CanonEntry,
  CanonSection,
  CanonService,
  CanonStatus,
  GitService,
  PlotPickleProject,
  PlotPickleServices,
  PluginCapability,
  PluginManifest,
  PluginPermission,
  PluginRegistration,
  PluginRegistry,
  PluginService,
  ProjectService,
  ReportService,
  ScreenplayService,
  StorageService,
  StoryboardService,
  TimelineService,
};
