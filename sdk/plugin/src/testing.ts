import type { PlotPickleServices, PluginManifest, PluginPermission } from "../../types/src/index";
import {
  PluginActivationHost,
  TypedEventBus,
  type CommandRegistration,
  type Disposable,
  type MenuRegistration,
  type PanelRegistration,
  type PluginModule,
  type RegistrationHost,
  type WorkspaceRegistration,
  toDisposable,
} from "./index";

export class MockRegistrationHost implements RegistrationHost {
  readonly commands = new Map<string, CommandRegistration>();
  readonly menus: MenuRegistration[] = [];
  readonly panels = new Map<string, PanelRegistration>();
  readonly workspaces = new Map<string, WorkspaceRegistration>();

  registerCommand(registration: CommandRegistration): Disposable {
    if (this.commands.has(registration.id)) throw new Error(`Command ${registration.id} is already registered.`);
    this.commands.set(registration.id, registration);
    return toDisposable(() => this.commands.delete(registration.id));
  }

  registerMenu(registration: MenuRegistration): Disposable {
    this.menus.push(registration);
    return toDisposable(() => {
      const index = this.menus.indexOf(registration);
      if (index >= 0) this.menus.splice(index, 1);
    });
  }

  registerPanel(registration: PanelRegistration): Disposable {
    if (this.panels.has(registration.id)) throw new Error(`Panel ${registration.id} is already registered.`);
    this.panels.set(registration.id, registration);
    return toDisposable(() => this.panels.delete(registration.id));
  }

  registerWorkspace(registration: WorkspaceRegistration): Disposable {
    if (this.workspaces.has(registration.id)) throw new Error(`Workspace ${registration.id} is already registered.`);
    this.workspaces.set(registration.id, registration);
    return toDisposable(() => this.workspaces.delete(registration.id));
  }

  async executeCommand(id: string, ...args: unknown[]): Promise<unknown> {
    const command = this.commands.get(id);
    if (!command) throw new Error(`Command ${id} is not registered.`);
    return command.handler(...args);
  }
}

export type MockPluginHostOptions = {
  manifest: PluginManifest;
  services: PlotPickleServices;
  grantedPermissions?: PluginPermission[];
};

export class MockPluginHost {
  readonly events = new TypedEventBus();
  readonly registrations = new MockRegistrationHost();
  readonly activation: PluginActivationHost;

  constructor(options: MockPluginHostOptions) {
    this.activation = new PluginActivationHost({
      manifest: options.manifest,
      services: options.services,
      grantedPermissions: options.grantedPermissions ?? options.manifest.permissions,
      events: this.events,
      registrations: this.registrations,
    });
  }

  activate(module: PluginModule) { return this.activation.activate(module); }
  deactivate() { return this.activation.deactivate(); }
}

export function createMockServices(overrides: Partial<PlotPickleServices> = {}): PlotPickleServices {
  const empty = new Proxy({}, {
    get(_target, member) {
      return () => { throw new Error(`Mock service method ${String(member)} was not configured.`); };
    },
  });

  return {
    apiVersion: "1.0.0",
    project: empty,
    canon: empty,
    screenplay: empty,
    storyboard: empty,
    reports: empty,
    timeline: empty,
    ai: empty,
    assets: empty,
    storage: empty,
    git: empty,
    plugins: empty,
    ...overrides,
  } as PlotPickleServices;
}
