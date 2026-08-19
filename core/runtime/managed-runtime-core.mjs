const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const SECRET_PATTERN = /(password|secret|private[_ -]?key|api[_ -]?key|token)/i;
const ALLOWED_COMPONENT_FIELDS = Object.freeze([
  "id",
  "displayName",
  "version",
  "launchStrategy",
  "platforms",
  "stageLocation",
  "launcher",
  "healthProbe",
  "readinessProbe",
  "startupDependencies",
  "startupTimeoutMs",
  "shutdown",
  "restartPolicy",
  "capabilities",
  "updatePolicy",
  "source",
  "developerOverride",
  "enabled",
]);
const ALLOWED_MANIFEST_FIELDS = Object.freeze(["schemaVersion", "authority", "productionPolicy", "components"]);

export const RUNTIME_PROCESS_STATES = Object.freeze([
  "not-installed",
  "installed",
  "starting",
  "running",
  "stopped",
  "failed",
]);
export const RUNTIME_READINESS_STATES = Object.freeze([
  "unknown",
  "checking",
  "ready",
  "degraded",
  "failed",
]);
export const RUNTIME_UPDATE_STATES = Object.freeze([
  "current",
  "update-available",
  "incompatible",
]);

function assertAllowedFields(input, allowed, label) {
  for (const key of Object.keys(input || {})) {
    if (!allowed.includes(key)) throw new Error(`${label} field is outside the allowlist: ${key}`);
  }
}

function stableId(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (!ID_PATTERN.test(normalized)) throw new Error(`${label} must be a stable 2-128 character identifier.`);
  return normalized;
}

function text(value, label, max = 240) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  if (SECRET_PATTERN.test(normalized) || /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(normalized)) {
    throw new Error(`${label} cannot contain secret material.`);
  }
  return normalized;
}

function stringList(values, label, max = 32) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  if (values.length > max) throw new Error(`${label} may contain at most ${max} entries.`);
  return [...new Set(values.map((value) => stableId(value, label)))].sort();
}

function assertLoopbackTarget(target) {
  if (!target) return;
  let url;
  try { url = new URL(target); } catch { throw new Error("HTTP runtime probes must use a valid URL."); }
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error("Managed runtime HTTP probes must remain loopback-only by default.");
  }
}

function normalizeProbe(input, label) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} is required.`);
  assertAllowedFields(input, ["kind", "target"], label);
  const kind = stableId(input.kind, `${label} kind`);
  const target = text(input.target, `${label} target`, 500);
  if (kind === "http-loopback") assertLoopbackTarget(target);
  return { kind, target };
}

function normalizeShutdown(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Runtime shutdown contract is required.");
  assertAllowedFields(input, ["strategy"], "Runtime shutdown");
  return { strategy: stableId(input.strategy, "Runtime shutdown strategy") };
}

function normalizeSource(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Runtime source metadata is required.");
  assertAllowedFields(input, ["name", "license"], "Runtime source");
  return {
    name: text(input.name, "Runtime source name"),
    license: text(input.license, "Runtime source license"),
  };
}

function normalizeProductionPolicy(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Runtime production policy is required.");
  assertAllowedFields(input, ["allowPathFallback", "developerOverrides", "defaultListenerHost", "hideManagedConsoles", "preserveProjectAndIdentityState"], "Runtime production policy");
  if (input.allowPathFallback !== false) throw new Error("Production runtime must not silently fall back to arbitrary PATH executables.");
  if (input.developerOverrides !== "explicit-only") throw new Error("Developer runtime overrides must be explicit-only.");
  if (!["127.0.0.1", "localhost", "::1"].includes(input.defaultListenerHost)) throw new Error("Managed runtime default listener must be loopback-only.");
  if (input.hideManagedConsoles !== true) throw new Error("Managed runtime must hide normal-user helper consoles.");
  if (input.preserveProjectAndIdentityState !== true) throw new Error("Runtime lifecycle must preserve project and identity state.");
  return {
    allowPathFallback: false,
    developerOverrides: "explicit-only",
    defaultListenerHost: input.defaultListenerHost,
    hideManagedConsoles: true,
    preserveProjectAndIdentityState: true,
  };
}

function normalizeComponent(input) {
  assertAllowedFields(input, ALLOWED_COMPONENT_FIELDS, "Runtime component");
  const launchStrategy = stableId(input.launchStrategy, "Runtime launch strategy");
  const launcher = input.launcher === null || input.launcher === undefined ? null : String(input.launcher).trim();
  if (launcher && (/^[A-Za-z]:\\/.test(launcher) || launcher.startsWith("/") || launcher.includes(".."))) {
    throw new Error("Managed runtime launcher paths must be repository/package relative, not arbitrary absolute paths.");
  }
  if (launcher && SECRET_PATTERN.test(launcher)) throw new Error("Managed runtime launcher path cannot contain secret-like material.");
  const timeout = Number(input.startupTimeoutMs);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 10 * 60 * 1000) {
    throw new Error("Runtime startup timeout must be between 1 second and 10 minutes.");
  }
  const restartPolicy = String(input.restartPolicy || "").trim();
  if (!["never", "on-failure"].includes(restartPolicy)) throw new Error("Runtime restart policy must be never or on-failure.");
  const developerOverride = String(input.developerOverride || "").trim();
  if (!["not-applicable", "explicit-only"].includes(developerOverride)) throw new Error("Runtime developer override must be not-applicable or explicit-only.");
  return {
    id: stableId(input.id, "Runtime component id"),
    displayName: text(input.displayName, "Runtime component display name"),
    version: text(input.version, "Runtime component version"),
    launchStrategy,
    platforms: stringList(input.platforms, "Runtime platform"),
    stageLocation: stableId(input.stageLocation, "Runtime stage location"),
    launcher,
    healthProbe: normalizeProbe(input.healthProbe, "Runtime health probe"),
    readinessProbe: normalizeProbe(input.readinessProbe, "Runtime readiness probe"),
    startupDependencies: stringList(input.startupDependencies, "Runtime dependency"),
    startupTimeoutMs: timeout,
    shutdown: normalizeShutdown(input.shutdown),
    restartPolicy,
    capabilities: stringList(input.capabilities, "Runtime capability"),
    updatePolicy: stableId(input.updatePolicy, "Runtime update policy"),
    source: normalizeSource(input.source),
    developerOverride,
    enabled: input.enabled === true,
  };
}

function assertNoDependencyCycles(components) {
  const byId = new Map(components.map((component) => [component.id, component]));
  for (const component of components) {
    for (const dependency of component.startupDependencies) {
      if (!byId.has(dependency)) throw new Error(`Runtime component ${component.id} depends on unknown component ${dependency}.`);
      if (dependency === component.id) throw new Error(`Runtime component ${component.id} cannot depend on itself.`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Runtime manifest contains a dependency cycle at ${id}.`);
    visiting.add(id);
    const component = byId.get(id);
    for (const dependency of component.startupDependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const component of components) visit(component.id);
}

export function validateRuntimeManifest(input) {
  assertAllowedFields(input, ALLOWED_MANIFEST_FIELDS, "Runtime manifest");
  if (input?.schemaVersion !== 1) throw new Error("Unsupported runtime manifest schema version.");
  if (input?.authority !== "plotpickle-runtime-supervisor") throw new Error("Runtime manifest authority must remain PlotPickle-owned.");
  if (!Array.isArray(input.components) || input.components.length === 0 || input.components.length > 64) {
    throw new Error("Runtime manifest requires 1-64 managed components.");
  }
  const components = input.components.map(normalizeComponent);
  if (new Set(components.map((component) => component.id)).size !== components.length) throw new Error("Runtime component IDs must be unique.");
  assertNoDependencyCycles(components);
  return {
    schemaVersion: 1,
    authority: "plotpickle-runtime-supervisor",
    productionPolicy: normalizeProductionPolicy(input.productionPolicy),
    components,
  };
}

export function createRuntimeSupervisor(manifestInput) {
  const manifest = validateRuntimeManifest(manifestInput);
  const services = Object.fromEntries(manifest.components.map((component) => [component.id, {
    componentId: component.id,
    enabled: component.enabled,
    installed: component.launchStrategy === "current-process" || component.launchStrategy === "in-process-gateway",
    processState: "stopped",
    readinessState: "unknown",
    updateState: "current",
    restartCount: 0,
    lastError: "",
    observedAt: null,
  }]));
  return { version: 1, manifest, services };
}

function serviceSummary(service) {
  if (!service.enabled) return "stopped";
  if (!service.installed) return "not-installed";
  if (service.updateState === "incompatible") return "incompatible";
  if (service.processState === "failed" || service.readinessState === "failed") return "failed";
  if (service.processState === "starting") return "starting";
  if (service.processState === "stopped") return "stopped";
  if (service.processState === "running" && service.readinessState === "ready") return "ready";
  if (service.processState === "running" && service.readinessState === "degraded") return "degraded";
  if (service.processState === "running") return "running";
  if (service.updateState === "update-available") return "update-available";
  return "installed";
}

export function observeRuntimeComponent(supervisor, componentId, observation) {
  const id = stableId(componentId, "Runtime component id");
  const current = supervisor.services[id];
  if (!current) throw new Error(`Unknown managed runtime component: ${id}.`);
  assertAllowedFields(observation, ["installed", "processRunning", "starting", "healthOk", "capabilityReady", "failed", "updateState", "error", "observedAt"], "Runtime observation");
  const updateState = observation.updateState || "current";
  if (!RUNTIME_UPDATE_STATES.includes(updateState)) throw new Error("Runtime update state is invalid.");
  const installed = observation.installed === true;
  let processState = "installed";
  if (!installed) processState = "not-installed";
  else if (observation.failed === true) processState = "failed";
  else if (observation.starting === true) processState = "starting";
  else if (observation.processRunning === true) processState = "running";
  else processState = "stopped";

  let readinessState = "unknown";
  if (processState === "starting") readinessState = "checking";
  else if (processState === "failed") readinessState = "failed";
  else if (processState === "running") {
    if (observation.healthOk !== true) readinessState = "degraded";
    else if (observation.capabilityReady === true) readinessState = "ready";
    else readinessState = "degraded";
  }

  const next = {
    ...current,
    installed,
    processState,
    readinessState,
    updateState,
    lastError: observation.error ? text(observation.error, "Runtime error", 700) : "",
    observedAt: observation.observedAt ? new Date(observation.observedAt).toISOString() : new Date().toISOString(),
  };
  return {
    ...supervisor,
    services: {
      ...supervisor.services,
      [id]: { ...next, summaryState: serviceSummary(next) },
    },
  };
}

export function planRuntimeStart(supervisor, componentId, options = {}) {
  const id = stableId(componentId, "Runtime component id");
  const component = supervisor.manifest.components.find((candidate) => candidate.id === id);
  if (!component) throw new Error(`Unknown managed runtime component: ${id}.`);
  if (!component.enabled) throw new Error(`Managed runtime component ${id} is disabled.`);
  if (options.developerOverridePath) {
    if (component.developerOverride !== "explicit-only") throw new Error(`Managed runtime component ${id} does not allow developer overrides.`);
    if (options.developerMode !== true) throw new Error("Developer runtime overrides require explicit developer mode.");
  }
  const dependencies = component.startupDependencies.map((dependencyId) => {
    const state = supervisor.services[dependencyId];
    if (!state || state.readinessState !== "ready") throw new Error(`Managed runtime dependency ${dependencyId} is not ready.`);
    return dependencyId;
  });
  return {
    componentId: id,
    launchStrategy: component.launchStrategy,
    launcher: options.developerOverridePath || component.launcher,
    developerOverride: Boolean(options.developerOverridePath),
    hideConsole: supervisor.manifest.productionPolicy.hideManagedConsoles,
    dependencies,
    timeoutMs: component.startupTimeoutMs,
  };
}

export function recordRuntimeRestart(supervisor, componentId) {
  const id = stableId(componentId, "Runtime component id");
  const service = supervisor.services[id];
  if (!service) throw new Error(`Unknown managed runtime component: ${id}.`);
  const component = supervisor.manifest.components.find((candidate) => candidate.id === id);
  if (component.restartPolicy !== "on-failure") throw new Error(`Managed runtime component ${id} is not configured for automatic restart.`);
  if (service.restartCount >= 3) throw new Error(`Managed runtime component ${id} exceeded the bounded restart limit.`);
  return {
    ...supervisor,
    services: {
      ...supervisor.services,
      [id]: {
        ...service,
        restartCount: service.restartCount + 1,
        processState: "starting",
        readinessState: "checking",
        summaryState: "starting",
      },
    },
  };
}

export function runtimeSettingsProjection(supervisor) {
  return supervisor.manifest.components.map((component) => {
    const service = supervisor.services[component.id];
    return {
      componentId: component.id,
      displayName: component.displayName,
      enabled: component.enabled,
      summaryState: service.summaryState || serviceSummary(service),
      processState: service.processState,
      readinessState: service.readinessState,
      updateState: service.updateState,
      capabilities: [...component.capabilities],
      restartCount: service.restartCount,
      lastError: service.lastError,
      observedAt: service.observedAt,
    };
  });
}

export function assertNoOrphanableManagedLauncher(plan) {
  if (plan.launchStrategy === "managed-script" && !plan.launcher) throw new Error("Managed-script runtime plan requires a pinned launcher path.");
  if (plan.launcher && (/^[A-Za-z]:\\/.test(plan.launcher) || plan.launcher.startsWith("/") || plan.launcher.includes(".."))) {
    throw new Error("Managed launcher cannot escape the packaged/application-relative runtime boundary.");
  }
  return plan;
}

export const RUNTIME_MANIFEST_COMPONENT_ALLOWLIST = ALLOWED_COMPONENT_FIELDS;
