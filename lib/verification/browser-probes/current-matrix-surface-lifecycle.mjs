import { readFileSync } from "node:fs";

const lifecycleUrl = new URL("../../../config/verification/current-matrix-surface-lifecycle.json", import.meta.url);
const parsed = JSON.parse(readFileSync(lifecycleUrl, "utf8"));

if (parsed?.schemaVersion !== 1 || parsed?.contractId !== "current-matrix-surface-lifecycle-v1") {
  throw new Error("Current Matrix surface lifecycle requires schemaVersion 1 and contractId current-matrix-surface-lifecycle-v1.");
}

export const CURRENT_MATRIX_SURFACE_LIFECYCLE = Object.freeze({
  schemaVersion: 1,
  contractId: parsed.contractId,
  issue: parsed.issue,
  standardGovernancePolicy: parsed.standardGovernancePolicy,
  censusOnlyDefaultLifecycle: parsed.censusOnlyDefaultLifecycle,
  activeGovernedAdditional: Object.freeze([...(parsed.activeGovernedAdditional || [])]),
  aliases: Object.freeze({ ...(parsed.aliases || {}) }),
});

const ACTIVE_ADDITIONAL = new Set(CURRENT_MATRIX_SURFACE_LIFECYCLE.activeGovernedAdditional);

export function isCurrentMatrixSupplementalGoverned(surfaceId) {
  return ACTIVE_ADDITIONAL.has(String(surfaceId || ""));
}

export function lifecycleForSurface({ surfaceId, capturePolicy, standardGoverned, currentNavigationReachable }) {
  if (capturePolicy === "public-exception") return "public-exception";
  if (standardGoverned) return "active-governed";
  if (currentNavigationReachable && isCurrentMatrixSupplementalGoverned(surfaceId)) return "active-governed";
  if (currentNavigationReachable) return "active-missing-governance";
  if (capturePolicy === "census-only") return "in-transit";
  return "inventory-only";
}
