import { SKIN_V1_SURFACE_REGISTRY, SKIN_V1_SURFACES } from "./skin-v1-surface-registry.mjs";

function freezeRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

export function skinV1RouteMigrationLedger() {
  const orchestratedDirect = SKIN_V1_SURFACES
    .filter((surface) => surface.orchestrated && typeof surface.runtimeRoute === "string" && surface.runtimeRoute)
    .map((surface) => ({
      id: surface.id,
      route: surface.runtimeRoute,
      status: "canonical-orchestrated",
    }));

  const routedCompatibilityDebt = SKIN_V1_SURFACES
    .filter((surface) => surface.capturePolicy === "census-only" && !surface.orchestrated && typeof surface.route === "string" && surface.route)
    .map((surface) => ({
      id: surface.id,
      route: surface.route,
      parent: surface.parent ?? null,
      status: "compatibility-route-debt",
      migrationHold: surface.migrationHold ?? null,
    }));

  const stateCompatibilityDebt = SKIN_V1_SURFACES
    .filter((surface) => surface.capturePolicy === "census-only" && !surface.orchestrated && !surface.route)
    .map((surface) => ({
      id: surface.id,
      stateKey: surface.stateKey ?? null,
      parent: surface.parent ?? null,
      status: "compatibility-state-debt",
    }));

  const publicExceptions = SKIN_V1_SURFACES
    .filter((surface) => surface.capturePolicy === "public-exception")
    .map((surface) => ({
      id: surface.id,
      route: surface.route ?? null,
      status: "declared-public-exception",
    }));

  return Object.freeze({
    schemaVersion: 1,
    contractId: "skin-v1-route-migration-ledger-v1",
    issue: 2226,
    sourceRegistry: SKIN_V1_SURFACE_REGISTRY.contractId,
    policy: "derived-only-no-second-route-authority",
    counts: Object.freeze({
      canonicalOrchestratedDirect: orchestratedDirect.length,
      routedCompatibilityDebt: routedCompatibilityDebt.length,
      stateCompatibilityDebt: stateCompatibilityDebt.length,
      publicExceptions: publicExceptions.length,
    }),
    canonicalOrchestratedDirect: freezeRows(orchestratedDirect),
    routedCompatibilityDebt: freezeRows(routedCompatibilityDebt),
    stateCompatibilityDebt: freezeRows(stateCompatibilityDebt),
    publicExceptions: freezeRows(publicExceptions),
  });
}
