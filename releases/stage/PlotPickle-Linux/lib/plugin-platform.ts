export const PLUGIN_API_VERSION = "1.0.0" as const;

export type PluginPermission =
  | "project:read" | "project:write" | "canon:read" | "canon:write"
  | "screenplay:read" | "screenplay:write" | "storyboard:read" | "storyboard:write"
  | "reports:read" | "reports:write" | "assets:read" | "assets:write"
  | "storage:read" | "storage:write" | "network" | "git" | "ai" | "audio" | "voice";

export type PluginCapability =
  | "github" | "ai-provider" | "music" | "image-generation" | "voice"
  | "pdf-export" | "final-draft-import" | "final-draft-export" | "fountain"
  | "report-export" | "panel" | "command";

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  apiVersion: typeof PLUGIN_API_VERSION;
  author: string;
  description: string;
  entryPoint: string;
  minimumPlotPickleVersion: string;
  permissions: PluginPermission[];
  capabilities: PluginCapability[];
  dependencies: Record<string, string>;
  commands: Array<{ id: string; title: string }>;
  menus: Array<{ location: string; command: string }>;
  panels: Array<{ id: string; title: string; location: "sidebar" | "workspace" | "settings" }>;
};

export type PluginState = "installed" | "enabled" | "disabled" | "incompatible" | "blocked" | "error";
export type PluginRegistration = {
  manifest: PluginManifest;
  state: PluginState;
  grantedPermissions: PluginPermission[];
  installedAt: string;
  updatedAt: string;
  error?: string;
};
export type PluginRegistry = { schemaVersion: "1.0.0"; apiVersion: typeof PLUGIN_API_VERSION; plugins: PluginRegistration[]; disabledUnknownModules: string[] };

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function validatePluginManifest(value: unknown): { valid: true; manifest: PluginManifest } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, errors: ["Plugin manifest must be an object."] };
  const manifest = value as Partial<PluginManifest>;
  if (!manifest.id || !ID_PATTERN.test(manifest.id)) errors.push("Plugin id must be a stable lowercase reverse-domain-style identifier.");
  if (!manifest.name?.trim()) errors.push("Plugin name is required.");
  if (!manifest.version || !VERSION_PATTERN.test(manifest.version)) errors.push("Plugin version must use semantic versioning.");
  if (manifest.apiVersion !== PLUGIN_API_VERSION) errors.push(`Plugin API ${String(manifest.apiVersion)} is not supported.`);
  if (!manifest.entryPoint?.trim()) errors.push("Plugin entryPoint is required.");
  if (!Array.isArray(manifest.permissions)) errors.push("Plugin permissions must be declared.");
  if (!Array.isArray(manifest.capabilities)) errors.push("Plugin capabilities must be declared.");
  return errors.length ? { valid: false, errors } : { valid: true, manifest: manifest as PluginManifest };
}

export function createPluginRegistry(): PluginRegistry {
  return { schemaVersion: "1.0.0", apiVersion: PLUGIN_API_VERSION, plugins: [], disabledUnknownModules: [] };
}

export class PluginHost {
  private registry: PluginRegistry;
  constructor(registry: PluginRegistry = createPluginRegistry()) { this.registry = structuredClone(registry); }
  snapshot(): PluginRegistry { return structuredClone(this.registry); }
  install(manifestValue: unknown, grantedPermissions: PluginPermission[] = []): PluginRegistration {
    const checked = validatePluginManifest(manifestValue);
    if (!checked.valid) throw new Error(checked.errors.join(" "));
    if (this.registry.plugins.some((plugin) => plugin.manifest.id === checked.manifest.id)) throw new Error(`Plugin ${checked.manifest.id} is already installed.`);
    const undeclared = grantedPermissions.filter((permission) => !checked.manifest.permissions.includes(permission));
    if (undeclared.length) throw new Error(`Cannot grant undeclared permissions: ${undeclared.join(", ")}`);
    const now = new Date().toISOString();
    const registration: PluginRegistration = { manifest: checked.manifest, state: "disabled", grantedPermissions, installedAt: now, updatedAt: now };
    this.registry.plugins.push(registration);
    return structuredClone(registration);
  }
  enable(id: string): PluginRegistration {
    const plugin = this.require(id);
    const missing = plugin.manifest.permissions.filter((permission) => !plugin.grantedPermissions.includes(permission));
    if (missing.length) throw new Error(`Plugin ${id} requires permission approval: ${missing.join(", ")}`);
    plugin.state = "enabled"; plugin.updatedAt = new Date().toISOString(); delete plugin.error;
    return structuredClone(plugin);
  }
  disable(id: string): PluginRegistration { const plugin = this.require(id); plugin.state = "disabled"; plugin.updatedAt = new Date().toISOString(); return structuredClone(plugin); }
  grant(id: string, permissions: PluginPermission[]): PluginRegistration {
    const plugin = this.require(id);
    for (const permission of permissions) if (!plugin.manifest.permissions.includes(permission)) throw new Error(`Permission ${permission} was not declared by ${id}.`);
    plugin.grantedPermissions = [...new Set([...plugin.grantedPermissions, ...permissions])]; plugin.updatedAt = new Date().toISOString();
    return structuredClone(plugin);
  }
  uninstall(id: string) { const before = this.registry.plugins.length; this.registry.plugins = this.registry.plugins.filter((plugin) => plugin.manifest.id !== id); return this.registry.plugins.length !== before; }
  pluginsFor(capability: PluginCapability) { return this.registry.plugins.filter((plugin) => plugin.state === "enabled" && plugin.manifest.capabilities.includes(capability)).map(structuredClone); }
  private require(id: string) { const plugin = this.registry.plugins.find((item) => item.manifest.id === id); if (!plugin) throw new Error(`Plugin ${id} is not installed.`); return plugin; }
}

export const corePluginManifests: PluginManifest[] = [
  { id: "org.plotpickle.github", name: "GitHub", version: "1.0.0", apiVersion: PLUGIN_API_VERSION, author: "PlotPickle", description: "Git-native collaboration and repository services.", entryPoint: "plugins/github/index.js", minimumPlotPickleVersion: "1.0.0-rc.4", permissions: ["project:read", "project:write", "network", "git"], capabilities: ["github", "command", "panel"], dependencies: {}, commands: [{ id: "github.sync", title: "Sync Project" }], menus: [{ location: "collaboration", command: "github.sync" }], panels: [{ id: "github", title: "GitHub", location: "settings" }] },
  { id: "org.plotpickle.ai-provider", name: "AI Provider", version: "1.0.0", apiVersion: PLUGIN_API_VERSION, author: "PlotPickle", description: "Provider-neutral AI connection for OpenAI and local models.", entryPoint: "plugins/ai-provider/index.js", minimumPlotPickleVersion: "1.0.0-rc.4", permissions: ["project:read", "canon:read", "ai", "network"], capabilities: ["ai-provider", "command", "panel"], dependencies: {}, commands: [{ id: "ai.configure", title: "Configure AI Provider" }], menus: [{ location: "settings", command: "ai.configure" }], panels: [{ id: "ai-provider", title: "AI Provider", location: "settings" }] },
  { id: "org.plotpickle.pdf-export", name: "PDF Export", version: "1.0.0", apiVersion: PLUGIN_API_VERSION, author: "PlotPickle", description: "Exports screenplay and reports to PDF.", entryPoint: "plugins/pdf-export/index.js", minimumPlotPickleVersion: "1.0.0-rc.4", permissions: ["project:read", "screenplay:read", "reports:read"], capabilities: ["pdf-export", "report-export", "command"], dependencies: {}, commands: [{ id: "pdf.export", title: "Export PDF" }], menus: [{ location: "export", command: "pdf.export" }], panels: [] },
  { id: "org.plotpickle.final-draft", name: "Final Draft Exchange", version: "1.0.0", apiVersion: PLUGIN_API_VERSION, author: "PlotPickle", description: "Imports and exports Final Draft FDX documents.", entryPoint: "plugins/final-draft/index.js", minimumPlotPickleVersion: "1.0.0-rc.4", permissions: ["project:read", "project:write", "screenplay:read", "screenplay:write"], capabilities: ["final-draft-import", "final-draft-export", "command"], dependencies: {}, commands: [{ id: "fdx.import", title: "Import Final Draft" }, { id: "fdx.export", title: "Export Final Draft" }], menus: [{ location: "import", command: "fdx.import" }, { location: "export", command: "fdx.export" }], panels: [] },
];
