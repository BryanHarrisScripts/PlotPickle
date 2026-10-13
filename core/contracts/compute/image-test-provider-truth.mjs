// PP-IMG-PROVIDER-001: a provider test cannot silently select another route.
// Keep this independent of the UI and server so the negative controls execute as code.
const validImageRoutes = new Set(["comfyui", "openai", "minimax", "manual"]);

export function resolveImageTestRoute(requestedRoute, selectedRoute) {
  const route = requestedRoute === undefined ? selectedRoute : requestedRoute;
  if (!validImageRoutes.has(route)) {
    throw new Error("Choose a supported image-test route. No provider was tested.");
  }
  return route;
}

export function assertCloudImageTestProof(expected, receipt, status) {
  if (expected !== "openai" && expected !== "minimax") throw new Error("Invalid cloud image provider.");
  if (!receipt || receipt.ok !== true || receipt.route !== expected || receipt.provider !== expected
    || typeof receipt.assetUrl !== "string" || !receipt.assetUrl.startsWith("/api/local-ai/assets/")) {
    throw new Error(`${expected} image verification rejected: the returned route, provider or saved asset does not match the requested provider. No cloud success is claimed.`);
  }
  const proof = status?.profiles?.[expected];
  if (proof?.imageReady !== true || !proof.imageVerifiedAt) {
    throw new Error(`${expected} image test returned an asset, but provider readiness was not independently persisted. Verification remains unproven.`);
  }
  return { provider: expected, assetUrl: receipt.assetUrl, verifiedAt: proof.imageVerifiedAt };
}
