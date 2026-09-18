import {
  SKIN_V1_RUNTIME_SELECTOR as COMPATIBILITY_SKIN_V1_RUNTIME_SELECTOR,
  WEBMCP_DASHBOARD_DESTINATION_COVERAGE as COMPATIBILITY_DASHBOARD_DESTINATION_COVERAGE,
  WEBMCP_STANDARD_SURFACE_LABELS as COMPATIBILITY_STANDARD_SURFACE_LABELS,
  WEBMCP_STANDARD_SURFACE_REGISTRY as COMPATIBILITY_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS as COMPATIBILITY_STANDARD_SURFACE_TARGETS,
} from "./webmcp-surface-capture-registry.mjs";
import {
  assertWebMcpCompatibility,
  canonicalEvidencePaths,
  canonicalSurface,
} from "./skin-v1-surface-registry.mjs";

const CANONICAL_TARGETS = assertWebMcpCompatibility(
  COMPATIBILITY_STANDARD_SURFACE_REGISTRY,
  COMPATIBILITY_STANDARD_SURFACE_TARGETS,
);

export const SKIN_V1_RUNTIME_SELECTOR = COMPATIBILITY_SKIN_V1_RUNTIME_SELECTOR;
export const WEBMCP_STANDARD_SURFACE_TARGETS = CANONICAL_TARGETS;
export const WEBMCP_STANDARD_SURFACE_REGISTRY = Object.freeze(Object.fromEntries(
  CANONICAL_TARGETS.map((id) => {
    const compatibility = COMPATIBILITY_STANDARD_SURFACE_REGISTRY[id];
    const surface = canonicalSurface(id);
    const evidence = canonicalEvidencePaths(id);
    if (!compatibility || !surface || !evidence) throw new Error(`Canonical WebMCP projection is incomplete for ${id}.`);
    return [id, Object.freeze({
      ...compatibility,
      candidate: evidence.candidate,
      baseline: evidence.baseline,
      navigationPath: surface.navigationPath,
      evidenceStem: evidence.stem,
      legacyCandidate: evidence.legacyCandidate,
      legacyBaseline: evidence.legacyBaseline,
    })];
  }),
));
export const WEBMCP_STANDARD_SURFACE_LABELS = Object.freeze(Object.fromEntries(
  CANONICAL_TARGETS.map((id) => [id, COMPATIBILITY_STANDARD_SURFACE_LABELS[id]]),
));
export const WEBMCP_DASHBOARD_DESTINATION_COVERAGE = COMPATIBILITY_DASHBOARD_DESTINATION_COVERAGE;
