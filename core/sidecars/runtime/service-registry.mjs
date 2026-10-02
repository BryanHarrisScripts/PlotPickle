import path from "node:path";

const ID = /^[a-z0-9][a-z0-9-]{1,63}$/u;

function normalizeService(service) {
  const id = String(service?.id ?? "").trim();
  const label = String(service?.label ?? "").trim();
  const entrypoint = String(service?.entrypoint ?? "").trim().replaceAll("\\", "/");
  if (!ID.test(id)) throw new Error(`Invalid runtime service id: ${id || "missing"}`);
  if (!label) throw new Error(`Runtime service ${id} requires a label.`);
  if (!entrypoint || path.posix.isAbsolute(entrypoint) || entrypoint.startsWith("../") || entrypoint.includes("/../")) {
    throw new Error(`Runtime service ${id} has an unsafe entrypoint.`);
  }
  if (!entrypoint.startsWith("scripts/sidecars/") || !entrypoint.endsWith(".mjs")) {
    throw new Error(`Runtime service ${id} must use a reviewed scripts/sidecars/*.mjs entrypoint.`);
  }
  return Object.freeze({
    id,
    label,
    entrypoint,
    defaultEnabled: service.defaultEnabled !== false,
    requiredForCore: service.requiredForCore === true,
  });
}

export function createRuntimeServiceRegistry(config) {
  if (config?.schemaVersion !== 1) throw new Error("Unsupported runtime sidecar registry schema.");
  if (config?.startupPolicy !== "after-core-ready") throw new Error("Runtime sidecars must remain product-first.");
  const services = (Array.isArray(config.services) ? config.services : []).map(normalizeService);
  if (services.length === 0) throw new Error("Runtime sidecar registry requires at least one service.");
  const ids = services.map((service) => service.id);
  if (new Set(ids).size !== ids.length) throw new Error("Runtime sidecar registry contains duplicate ids.");
  if (services.some((service) => service.requiredForCore)) {
    throw new Error("Runtime sidecars cannot be required for core PlotPickle readiness.");
  }
  const byId = new Map(services.map((service) => [service.id, service]));
  return Object.freeze({
    schemaVersion: 1,
    startupPolicy: "after-core-ready",
    statusFile: String(config.statusFile || "node/runtime/sidecars/status.json"),
    services: Object.freeze(services),
    get(id) {
      return byId.get(id) ?? null;
    },
  });
}

export function registeredServiceLaunch(registry, id, { repoRoot, node = process.execPath } = {}) {
  const service = registry.get(id);
  if (!service) throw new Error(`Runtime service is not registered: ${id}`);
  const root = path.resolve(repoRoot || process.cwd());
  const entrypoint = path.resolve(root, service.entrypoint);
  if (!entrypoint.startsWith(root + path.sep)) throw new Error(`Runtime service escaped repository root: ${id}`);
  return Object.freeze({
    id: service.id,
    command: node,
    args: Object.freeze(["--experimental-strip-types", entrypoint]),
    enabled: service.defaultEnabled,
    label: service.label,
    entrypoint,
  });
}
