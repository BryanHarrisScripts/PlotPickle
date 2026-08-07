import registryJson from "../../config/ai-source-registry.json";

export type AiSourceCapability = "text" | "image" | "video";

type RegistryCapability = {
  id: AiSourceCapability;
  label: string;
  description: string;
};

type RegistryRoute = {
  id: string;
  capability: AiSourceCapability;
  label: string;
  description: string;
  providerIds: string[];
  selectableWhen: "always" | "ready";
};

type AiSourceRegistry = {
  schemaVersion: number;
  registryId: string;
  capabilities: RegistryCapability[];
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

  const routeIds = new Set<string>();
  for (const route of value.routes) {
    if (!capabilityIds.includes(route.capability) || !route.id.startsWith(`${route.capability}.`)) {
      throw new Error(`The AI source route ${route.id} has an invalid capability.`);
    }
    if (routeIds.has(route.id)) throw new Error(`The AI source route ${route.id} is duplicated.`);
    routeIds.add(route.id);
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
