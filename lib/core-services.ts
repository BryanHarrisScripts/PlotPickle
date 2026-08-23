import type { PlotPickleProject } from "./project";
import type { CanonBinder, CanonEntry, CanonSection, CanonStatus } from "./canon-binder";
import type { PluginCapability, PluginHost, PluginPermission, PluginRegistry } from "./plugin-platform";

export const CORE_SERVICES_API_VERSION = "1.0.0" as const;

export type ServiceContext = {
  pluginId: string;
  permissions: ReadonlySet<PluginPermission>;
};

export type ProjectService = {
  get(): Promise<Readonly<PlotPickleProject>>;
  replace(project: PlotPickleProject): Promise<void>;
  transact(update: (draft: PlotPickleProject) => void): Promise<Readonly<PlotPickleProject>>;
};

export type CanonService = {
  binder(): Promise<Readonly<CanonBinder>>;
  query(options?: { sections?: CanonSection[]; statuses?: CanonStatus[]; tags?: string[]; text?: string }): Promise<CanonEntry[]>;
  context(entryIds: string[], includeRelated?: boolean): Promise<unknown>;
};

export type ScreenplayService = {
  read(): Promise<Readonly<PlotPickleProject["screenplay"]>>;
  update(sourceText: string): Promise<void>;
};

export type StoryboardService = {
  frames(): Promise<ReadonlyArray<PlotPickleProject["blocks"][number]["visuals"][number]>>;
};

export type ReportService = {
  list(): Promise<string[]>;
  generate(reportId: string, options?: Record<string, unknown>): Promise<unknown>;
};

export type TimelineService = {
  events(): Promise<unknown[]>;
};

export type AIService = {
  providers(): Promise<Array<{ id: string; name: string; local: boolean }>>;
  complete(request: { providerId: string; purpose: string; canonEntryIds: string[]; prompt: string }): Promise<{ text: string; provenanceId: string }>;
};

export type AssetService = {
  list(): Promise<Array<{ id: string; path: string; mediaType: string }>>;
  read(id: string): Promise<Uint8Array>;
  write(input: { path: string; mediaType: string; bytes: Uint8Array }): Promise<{ id: string }>;
};

export type StorageService = {
  readJson<T = unknown>(path: string): Promise<T>;
  writeJson(path: string, value: unknown): Promise<void>;
};

export type GitService = {
  status(): Promise<unknown>;
  history(limit?: number): Promise<unknown[]>;
  propose(input: { title: string; description: string }): Promise<{ branch: string; url?: string }>;
};

export type PluginService = {
  registry(): PluginRegistry;
  pluginsFor(capability: PluginCapability): ReturnType<PluginHost["pluginsFor"]>;
};

export type PlotPickleServices = {
  apiVersion: typeof CORE_SERVICES_API_VERSION;
  project: ProjectService;
  canon: CanonService;
  screenplay: ScreenplayService;
  storyboard: StoryboardService;
  reports: ReportService;
  timeline: TimelineService;
  ai: AIService;
  assets: AssetService;
  storage: StorageService;
  git: GitService;
  plugins: PluginService;
};

const servicePermissions: Record<keyof Omit<PlotPickleServices, "apiVersion">, PluginPermission[]> = {
  project: ["project:read"],
  canon: ["canon:read"],
  screenplay: ["screenplay:read"],
  storyboard: ["storyboard:read"],
  reports: ["reports:read"],
  timeline: ["project:read"],
  ai: ["ai"],
  assets: ["assets:read"],
  storage: ["storage:read"],
  git: ["git"],
  plugins: [],
};

export function authorizeService<K extends keyof Omit<PlotPickleServices, "apiVersion">>(context: ServiceContext, service: K) {
  const missing = servicePermissions[service].filter((permission) => !context.permissions.has(permission));
  if (missing.length) throw new Error(`Plugin ${context.pluginId} cannot access ${service}: missing ${missing.join(", ")}.`);
}

export type PluginActivationContext = {
  pluginId: string;
  services: PlotPickleServices;
  registerCommand(commandId: string, handler: (input?: unknown) => unknown | Promise<unknown>): () => void;
  registerPanel(panelId: string, render: () => unknown): () => void;
  subscriptions: Array<() => void>;
};

export type PlotPicklePlugin = {
  activate(context: PluginActivationContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
};
