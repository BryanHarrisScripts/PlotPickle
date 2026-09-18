import { readFileSync } from "node:fs";

const registryUrl = new URL("../../config/skin-v1-surface-registry.json", import.meta.url);
const NAVIGATION_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function navigationStemFrom(surface, registry) {
  if (!Array.isArray(surface?.navigationPath) || surface.navigationPath.length === 0) {
    throw new Error(`Canonical standard surface ${surface?.id || "unknown"} must define navigationPath.`);
  }
  const width = Number(registry.navigationIdentity?.orderWidth || 2);
  const separator = String(registry.navigationIdentity?.segmentSeparator || "__");
  return surface.navigationPath.map((segment) => {
    if (!Number.isInteger(segment?.order) || segment.order < 0) {
      throw new Error(`Canonical surface ${surface.id} has an invalid navigation order.`);
    }
    if (!NAVIGATION_SLUG.test(String(segment?.slug || ""))) {
      throw new Error(`Canonical surface ${surface.id} has an invalid navigation slug.`);
    }
    return `${String(segment.order).padStart(width, "0")}-${segment.slug}`;
  }).join(separator);
}

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

  const navigation = registry.navigationIdentity;
  if (
    navigation?.issue !== 2226
    || navigation?.orderWidth !== 2
    || navigation?.segmentSeparator !== "__"
    || navigation?.migrationPolicy !== "derived-canonical-paths-with-legacy-aliases"
  ) {
    throw new Error("Skin V1 canonical Surface Registry must define the Issue #2226 navigation identity contract.");
  }

  const standards = registry.surfaces.filter((surface) => surface.capturePolicy === "standard");
  const stems = standards.map((surface) => navigationStemFrom(surface, registry));
  if (new Set(stems).size !== stems.length) throw new Error("Skin V1 canonical standard surfaces contain duplicate navigation evidence stems.");
  for (const surface of standards) {
    if (!surface.legacyEvidence?.candidate || !surface.legacyEvidence?.baseline) {
      throw new Error(`Canonical standard surface ${surface.id} must preserve legacy evidence aliases during the Issue #2226 migration.`);
    }
  }
  return registry;
}

export const SKIN_V1_SURFACE_REGISTRY = Object.freeze(loadCanonicalRegistry());
export const SKIN_V1_SURFACES = Object.freeze(SKIN_V1_SURFACE_REGISTRY.surfaces.map((surface) => Object.freeze({ ...surface })));

export function canonicalSurface(surfaceId) {
  return SKIN_V1_SURFACES.find((surface) => surface.id === surfaceId) || null;
}

export function canonicalNavigationEvidenceStem(surfaceId) {
  const surface = canonicalSurface(surfaceId);
  if (!surface || surface.capturePolicy !== "standard") return null;
  return navigationStemFrom(surface, SKIN_V1_SURFACE_REGISTRY);
}

export function canonicalEvidencePaths(surfaceId) {
  const surface = canonicalSurface(surfaceId);
  const stem = canonicalNavigationEvidenceStem(surfaceId);
  if (!surface || !stem) return null;
  const identity = SKIN_V1_SURFACE_REGISTRY.navigationIdentity;
  return Object.freeze({
    stem,
    candidate: `${identity.candidateRoot}/${stem}${identity.candidateSuffix}`,
    baseline: `${identity.baselineRoot}/${stem}${identity.baselineSuffix}`,
    legacyCandidate: surface.legacyEvidence.candidate,
    legacyBaseline: surface.legacyEvidence.baseline,
  });
}

export function canonicalWebMcpSurfaceIds() {
  return Object.freeze(SKIN_V1_SURFACES
    .filter((surface) => typeof surface.webmcpId === "string" && surface.webmcpId.trim())
    .map((surface) => ({ id: surface.webmcpId, stem: navigationStemFrom(surface, SKIN_V1_SURFACE_REGISTRY) }))
    .sort((left, right) => left.stem.localeCompare(right.stem))
    .map(({ id }) => id));
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
  const compatibilityTargetSet = new Set(compatibilityTargets);
  const missing = canonicalTargets.filter((id) => !compatibilityRegistry[id] || !compatibilityTargetSet.has(id));
  const undeclared = compatibilityIds.filter((id) => !canonicalTargets.includes(id));
  const undeclaredTargets = compatibilityTargets.filter((id) => !canonicalTargets.includes(id));

  if (missing.length || undeclared.length || undeclaredTargets.length) {
    throw new Error(`WebMCP compatibility inventory drifted from the canonical Surface Registry. Missing definitions: ${missing.join(", ") || "none"}. Undeclared definitions: ${undeclared.join(", ") || "none"}. Undeclared targets: ${undeclaredTargets.join(", ") || "none"}.`);
  }

  for (const id of canonicalTargets) {
    if (compatibilityRegistry[id]?.id !== id) throw new Error(`WebMCP compatibility definition ${id} does not preserve its canonical id.`);
  }
  return Object.freeze(canonicalTargets);
}
