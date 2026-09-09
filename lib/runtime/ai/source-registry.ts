import registryJson from "../../../config/ai-source-registry.json";

export type AiSourceCapability = "text" | "image" | "video";

type RegistryCapability = {
  id: AiSourceCapability;
  label: string;
  description: string;
};

type RegistryProvider = {
  id: string;
  kind: "none" | "manual" | "local" | "cloud";
};

type RegistryRoute = {
  id: string;
  capability: AiSourceCapability;
  label: string;
  description: string;
  providerIds: string[];
  selectableWhen: "always" | "ready";
};

export type AiLocalPluginDefinition = {
  id: string;
  capability: AiSourceCapability;
  label: string;
  description: string;
  runtimeProviderId: string;
  adapterId: string;
  modes: string[];
  hardwarePriority: Record<string, number>;
  advanced: boolean;
  preset: string;
};

export type AiLocalPluginRecommendation = {
  plugin: AiLocalPluginDefinition;
  hardwareProfileId: string;
  priority: number;
};

type AiSourceRegistry = {
  schemaVersion: number;
  registryId: string;
  capabilities: RegistryCapability[];
  providers: RegistryProvider[];
  plugins?: AiLocalPluginDefinition[];
  routes: RegistryRoute[];
};

const registry = registryJson as AiSourceRegistry;

function assertRegistry(value: AiSourceRegistry) {
  if (value.schemaVersion !== 1 || value.registryId !== "plotpickle.global-ai-sources") {
    throw new Error("The AI source registry version is not supported.");
  }

  const capabilityIds = value.capabilities.map(({ id }) => id);
  if (capabilityIds.join(",") !== "text,image,video") {
    throw new Error("The AI source registry capability order is invalid.");
  }

  const providers = new Map(value.providers.map((provider) => [provider.id, provider]));
  const routeIds = new Set<string>();
  for (const route of value.routes) {
    if (!capabilityIds.includes(route.capability) || !route.id.startsWith(`${route.capability}.`)) {
      throw new Error(`The AI source route ${route.id} has an invalid capability.`);
    }
    if (routeIds.has(route.id)) throw new Error(`The AI source route ${route.id} is duplicated.`);
    routeIds.add(route.id);
  }

  const pluginIds = new Set<string>();
  for (const plugin of value.plugins ?? []) {
    if (!capabilityIds.includes(plugin.capability) || !plugin.id.startsWith(`${plugin.capability}.`)) {
      throw new Error(`The local AI plug-in ${plugin.id} has an invalid capability.`);
    }
    if (pluginIds.has(plugin.id)) throw new Error(`The local AI plug-in ${plugin.id} is duplicated.`);
    pluginIds.add(plugin.id);
    if (providers.get(plugin.runtimeProviderId)?.kind !== "local") {
      throw new Error(`The local AI plug-in ${plugin.id} must use a registered local runtime provider.`);
    }
    if (!plugin.adapterId.trim()) throw new Error(`The local AI plug-in ${plugin.id} has no adapter.`);
    if (!plugin.modes.length) throw new Error(`The local AI plug-in ${plugin.id} has no capability mode.`);
    for (const [profileId, priority] of Object.entries(plugin.hardwarePriority)) {
      if (!profileId.trim() || !Number.isFinite(priority) || priority <= 0) {
        throw new Error(`The local AI plug-in ${plugin.id} has an invalid hardware priority.`);
      }
    }
  }
}

assertRegistry(registry);

export const AI_SOURCE_GROUPS = registry.capabilities.map(({ id, label, description }) => ({
  capability: id,
  title: label,
  description,
}));

export const AI_SOURCE_OPTION_LABELS = Object.fromEntries(
  registry.capabilities.map(({ id }) => [
    id,
    Object.fromEntries(
      registry.routes
        .filter((route) => route.capability === id)
        .map((route) => [route.id.slice(id.length + 1), { title: route.label, description: route.description }]),
    ),
  ]),
) as Record<AiSourceCapability, Record<string, { title: string; description: string }>>;

export const AI_LOCAL_PLUGINS: readonly AiLocalPluginDefinition[] = Object.freeze(
  (registry.plugins ?? []).map((plugin) => ({
    ...plugin,
    modes: [...plugin.modes],
    hardwarePriority: { ...plugin.hardwarePriority },
  })),
);

export function localPluginsForCapability(capability: AiSourceCapability) {
  return AI_LOCAL_PLUGINS.filter((plugin) => plugin.capability === capability);
}

export function recommendLocalPlugin(
  capability: AiSourceCapability,
  hardwareProfileId: string,
): AiLocalPluginRecommendation | null {
  const ranked = localPluginsForCapability(capability)
    .map((plugin) => ({ plugin, hardwareProfileId, priority: plugin.hardwarePriority[hardwareProfileId] }))
    .filter((candidate): candidate is AiLocalPluginRecommendation => Number.isFinite(candidate.priority))
    .sort((left, right) => left.priority - right.priority || left.plugin.id.localeCompare(right.plugin.id));
  return ranked[0] ?? null;
}
