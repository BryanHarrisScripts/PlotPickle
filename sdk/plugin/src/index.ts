import type {
  PlotPickleProject,
  PlotPickleServices,
  PluginManifest,
  PluginPermission,
} from "../../types/src/index";

export const PLOTPICKLE_PLUGIN_SDK_VERSION = "0.1.0" as const;

export type PlotPickleEventMap = {
  ProjectOpened: { project: Readonly<PlotPickleProject> };
  ProjectSaved: { projectId: string; savedAt: string; revisionId?: string };
  CanonChanged: { entryIds: string[]; reason: string };
  CharacterUpdated: { characterId: string; changedFields: string[] };
  SceneChanged: { sceneId: string; blockId?: string; changedFields: string[] };
  ScreenplayChanged: { elementIds: string[]; sceneIds: string[] };
  StoryboardChanged: { frameIds: string[]; blockIds: string[] };
  TimelineUpdated: { entryIds: string[] };
  ApprovalGranted: { targetType: string; targetId: string; approvedBy: string };
  AICompleted: { operationId: string; retained: boolean; provider?: string; model?: string };
  ExportCompleted: { exportId: string; format: string; path?: string; completedAt: string };
};

export type PlotPickleEventName = keyof PlotPickleEventMap;
export type EventListener<K extends PlotPickleEventName> = (event: Readonly<PlotPickleEventMap[K]>) => void | Promise<void>;

export interface Disposable { dispose(): void }

export function toDisposable(dispose: () => void): Disposable {
  let active = true;
  return { dispose() { if (!active) return; active = false; dispose(); } };
}

export class DisposableStore implements Disposable {
  private readonly items = new Set<Disposable>();
  private disposed = false;

  add<T extends Disposable>(item: T): T {
    if (this.disposed) { item.dispose(); return item; }
    this.items.add(item);
    return item;
  }

  delete(item: Disposable): boolean { return this.items.delete(item); }
  clear(): void { for (const item of [...this.items]) item.dispose(); this.items.clear(); }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.clear(); }
}

export interface EventBus {
  on<K extends PlotPickleEventName>(name: K, listener: EventListener<K>): Disposable;
  emit<K extends PlotPickleEventName>(name: K, event: PlotPickleEventMap[K]): Promise<void>;
}

export class TypedEventBus implements EventBus, Disposable {
  private readonly listeners = new Map<PlotPickleEventName, Set<EventListener<PlotPickleEventName>>>();
  private disposed = false;

  on<K extends PlotPickleEventName>(name: K, listener: EventListener<K>): Disposable {
    if (this.disposed) throw new Error("Event bus is disposed.");
    const listeners = this.listeners.get(name) ?? new Set<EventListener<PlotPickleEventName>>();
    listeners.add(listener as EventListener<PlotPickleEventName>);
    this.listeners.set(name, listeners);
    return toDisposable(() => {
      listeners.delete(listener as EventListener<PlotPickleEventName>);
      if (!listeners.size) this.listeners.delete(name);
    });
  }

  async emit<K extends PlotPickleEventName>(name: K, event: PlotPickleEventMap[K]): Promise<void> {
    if (this.disposed) throw new Error("Event bus is disposed.");
    const listeners = [...(this.listeners.get(name) ?? [])] as EventListener<K>[];
    for (const listener of listeners) await listener(Object.freeze(structuredClone(event)));
  }

  dispose(): void { this.disposed = true; this.listeners.clear(); }
}

export type CommandHandler = (...args: unknown[]) => unknown | Promise<unknown>;
export type CommandRegistration = { id: string; title: string; handler: CommandHandler };
export type MenuRegistration = { location: string; command: string; group?: string; order?: number };
export type PanelLocation = "sidebar" | "workspace" | "settings";
export type PanelRegistration = { id: string; title: string; location: PanelLocation; render: () => unknown };
export type WorkspaceRegistration = { id: string; title: string; route: string; render: () => unknown };

export interface RegistrationHost {
  registerCommand(registration: CommandRegistration): Disposable;
  registerMenu(registration: MenuRegistration): Disposable;
  registerPanel(registration: PanelRegistration): Disposable;
  registerWorkspace(registration: WorkspaceRegistration): Disposable;
}

export class PermissionError extends Error {
  constructor(public readonly pluginId: string, public readonly permission: PluginPermission) {
    super(`Plugin ${pluginId} requires granted permission ${permission}.`);
    this.name = "PermissionError";
  }
}

export type PermissionAwareServices = PlotPickleServices;
type ServiceName = keyof Omit<PlotPickleServices, "apiVersion">;

export function assertPermission(pluginId: string, granted: ReadonlySet<PluginPermission>, permission: PluginPermission): void {
  if (!granted.has(permission)) throw new PermissionError(pluginId, permission);
}

const methodPermissions: Record<ServiceName, Record<string, PluginPermission>> = {
  project: { get: "project:read", replace: "project:write", transact: "project:write" },
  canon: { binder: "canon:read", query: "canon:read", context: "canon:read" },
  screenplay: { read: "screenplay:read", update: "screenplay:write" },
  storyboard: { frames: "storyboard:read" },
  reports: { list: "reports:read", generate: "reports:read" },
  timeline: { events: "project:read" },
  ai: { providers: "ai", complete: "ai" },
  assets: { list: "assets:read", read: "assets:read", write: "assets:write" },
  storage: { readJson: "storage:read", writeJson: "storage:write" },
  git: { status: "git", history: "git", propose: "git" },
  plugins: { registry: "project:read", pluginsFor: "project:read" },
};

function permissionForCall(service: ServiceName, member: PropertyKey): PluginPermission {
  const permission = methodPermissions[service][String(member)];
  if (!permission) throw new Error(`Plugin service method ${service}.${String(member)} has no public permission mapping.`);
  return permission;
}

export function createPermissionAwareServices(
  pluginId: string,
  services: PlotPickleServices,
  grantedPermissions: Iterable<PluginPermission>,
): PermissionAwareServices {
  const granted = new Set(grantedPermissions);
  const wrapped = { apiVersion: services.apiVersion } as PlotPickleServices;
  const serviceNames: ServiceName[] = ["project", "canon", "screenplay", "storyboard", "reports", "timeline", "ai", "assets", "storage", "git", "plugins"];

  for (const serviceName of serviceNames) {
    const service = services[serviceName] as object;
    wrapped[serviceName] = new Proxy(service, {
      get(target, member, receiver) {
        const value = Reflect.get(target, member, receiver);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          assertPermission(pluginId, granted, permissionForCall(serviceName, member));
          return Reflect.apply(value, target, args);
        };
      },
    }) as never;
  }
  return wrapped;
}

export interface PluginContext {
  readonly manifest: Readonly<PluginManifest>;
  readonly services: PermissionAwareServices;
  readonly events: EventBus;
  readonly subscriptions: DisposableStore;
  registerCommand(registration: CommandRegistration): Disposable;
  registerMenu(registration: MenuRegistration): Disposable;
  registerPanel(registration: PanelRegistration): Disposable;
  registerWorkspace(registration: WorkspaceRegistration): Disposable;
}

export type PluginModule = {
  activate(context: PluginContext): void | Disposable | Promise<void | Disposable>;
  deactivate?(): void | Promise<void>;
};

export type ActivationHostOptions = {
  manifest: PluginManifest;
  services: PlotPickleServices;
  grantedPermissions: PluginPermission[];
  events?: EventBus;
  registrations: RegistrationHost;
};

export class PluginActivationHost implements Disposable {
  private subscriptions = new DisposableStore();
  private activeModule?: PluginModule;
  private active = false;

  constructor(private readonly options: ActivationHostOptions) {}

  async activate(module: PluginModule): Promise<PluginContext> {
    if (this.active) throw new Error(`Plugin ${this.options.manifest.id} is already active.`);
    if (this.subscriptions) this.subscriptions.dispose();
    this.subscriptions = new DisposableStore();
    const events = this.options.events ?? new TypedEventBus();
    const context: PluginContext = {
      manifest: Object.freeze(structuredClone(this.options.manifest)),
      services: createPermissionAwareServices(this.options.manifest.id, this.options.services, this.options.grantedPermissions),
      events,
      subscriptions: this.subscriptions,
      registerCommand: (registration) => this.subscriptions.add(this.options.registrations.registerCommand(registration)),
      registerMenu: (registration) => this.subscriptions.add(this.options.registrations.registerMenu(registration)),
      registerPanel: (registration) => this.subscriptions.add(this.options.registrations.registerPanel(registration)),
      registerWorkspace: (registration) => this.subscriptions.add(this.options.registrations.registerWorkspace(registration)),
    };
    this.activeModule = module;
    const result = await module.activate(context);
    if (result) this.subscriptions.add(result);
    this.active = true;
    return context;
  }

  async deactivate(): Promise<void> {
    if (!this.active) return;
    await this.activeModule?.deactivate?.();
    this.subscriptions.dispose();
    this.active = false;
    this.activeModule = undefined;
  }

  dispose(): void { void this.deactivate(); }
}

export type PluginDevelopmentSession = {
  readonly generation: number;
  reload(module: PluginModule): Promise<PluginContext>;
  dispose(): Promise<void>;
};

export function createDevelopmentSession(createHost: () => PluginActivationHost): PluginDevelopmentSession {
  let generation = 0;
  let host: PluginActivationHost | undefined;
  return {
    get generation() { return generation; },
    async reload(module) {
      await host?.deactivate();
      host = createHost();
      generation += 1;
      return host.activate(module);
    },
    async dispose() {
      await host?.deactivate();
      host = undefined;
    },
  };
}
