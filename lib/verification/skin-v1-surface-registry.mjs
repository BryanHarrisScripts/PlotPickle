import { readFileSync } from "node:fs";

const registryUrl = new URL("../../config/skin-v1-surface-registry.json", import.meta.url);

function loadCanonicalRegistry() {
  const registry = JSON.parse(readFileSync(registryUrl, "utf8"));
  if (registry?.schemaVersion !== 1 || registry?.contractId !== "skin-v1-surface-registry-v1") {
    throw new Error("Skin V1 canonical Surface Registry must provide schemaVersion 1 and contractId skin-v1-surface-registry-v1.");
  }
  if (registry?.designSystem !== "skin-v1-matrix" || registry?.referenceSurface !== "dashboard") {
    throw new Error("Skin V1 canonical Surface Registry must keep skin-v1-matrix with Dashboard as the reference surface.");
  }
  if (!Array.isArray(registry?.surfaces) || registry.surfaces.length === 0) {
    throw new Error("Skin V1 canonical Surface Registry must contain surfaces.");
  }
  const ids = registry.surfaces.map((surface) => surface.id);
  if (new Set(ids).size !== ids.length) throw new Error("Skin V1 canonical Surface Registry contains duplicate surface ids.");
  return registry;
}

export const SKIN_V1_SURFACE_REGISTRY = Object.freeze(loadCanonicalRegistry());
export const SKIN_V1_SURFACES = Object.freeze(SKIN_V1_SURFACE_REGISTRY.surfaces.map((surface) => Object.freeze({ ...surface })));

export function canonicalSurface(surfaceId) {
  return SKIN_V1_SURFACES.find((surface) => surface.id === surfaceId) || null;
}

export function canonicalWebMcpSurfaceIds() {
  return Object.freeze(SKIN_V1_SURFACES
    .filter((surface) => typeof surface.webmcpId === "string" && surface.webmcpId.trim())
    .map((surface) => surface.webmcpId));
}

export function canonicalContinuityIds() {
  return Object.freeze(SKIN_V1_SURFACES.flatMap((surface) => Array.isArray(surface.continuityIds) ? surface.continuityIds : []));
}

export function projectUiContinuityScreens(compatibilityRegistry) {
  if (!compatibilityRegistry || !Array.isArray(compatibilityRegistry.screens)) {
    throw new Error("UI Continuity compatibility metadata must provide a screens array.");
  }
  const compatibilityById = new Map(compatibilityRegistry.screens.map((screen) => [screen.id, screen]));
  const canonicalOwners = new Map();
  for (const surface of SKIN_V1_SURFACES) {
    for (const continuityId of surface.continuityIds || []) {
      if (canonicalOwners.has(continuityId)) throw new Error(`UI Continuity id ${continuityId} is mapped by more than one canonical surface.`);
      canonicalOwners.set(continuityId, surface);
    }
  }

  const compatibilityIds = new Set(compatibilityRegistry.screens.map((screen) => screen.id));
  const canonicalIds = [...canonicalOwners.keys()];
  const missing = canonicalIds.filter((id) => !compatibilityIds.has(id));
  const undeclared = [...compatibilityIds].filter((id) => !canonicalOwners.has(id));
  if (missing.length || undeclared.length) {
    throw new Error(`UI Continuity compatibility inventory drifted from the canonical Surface Registry. Missing metadata: ${missing.join(", ") || "none"}. Undeclared metadata: ${undeclared.join(", ") || "none"}.`);
  }

  return Object.freeze(canonicalIds.map((id) => {
    const metadata = compatibilityById.get(id);
    const surface = canonicalOwners.get(id);
    return Object.freeze({
      ...metadata,
      canonicalSurfaceId: surface.id,
      surfaceClass: surface.surfaceClass,
      family: surface.family,
      designSystem: SKIN_V1_SURFACE_REGISTRY.designSystem,
      canonicalRegistry: SKIN_V1_SURFACE_REGISTRY.contractId,
    });
  }));
}

export function assertWebMcpCompatibility(compatibilityRegistry, compatibilityTargets) {
  if (!compatibilityRegistry || typeof compatibilityRegistry !== "object") {
    throw new Error("WebMCP compatibility registry is missing.");
  }
  if (!Array.isArray(compatibilityTargets)) throw new Error("WebMCP compatibility targets must be an array.");

  const canonicalTargets = [...canonicalWebMcpSurfaceIds()];
  const compatibilityIds = Object.keys(compatibilityRegistry);
  const missing = canonicalTargets.filter((id) => !compatibilityRegistry[id]);
  const undeclared = compatibilityIds.filter((id) => !canonicalTargets.includes(id));
  const orderMatches = canonicalTargets.join("\u0000") === compatibilityTargets.join("\u0000");

  if (missing.length || undeclared.length || !orderMatches) {
    throw new Error(`WebMCP compatibility inventory drifted from the canonical Surface Registry. Missing definitions: ${missing.join(", ") || "none"}. Undeclared definitions: ${undeclared.join(", ") || "none"}. Target order matches: ${orderMatches}.`);
  }

  for (const id of canonicalTargets) {
    if (compatibilityRegistry[id]?.id !== id) throw new Error(`WebMCP compatibility definition ${id} does not preserve its canonical id.`);
  }
  return Object.freeze(canonicalTargets);
}
