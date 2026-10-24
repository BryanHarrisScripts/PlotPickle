import { getProfileExperienceRuntime, requestBoundary } from "./profile-experience-runtime";

// Factory HTTP adapters share the live profile boundary with identical local,
// CSRF and recent-reauthentication requirements. No transport token is exposed.
export async function authorizeLocalFactoryRequest(request: Request, mutation: boolean) {
  const state = await getProfileExperienceRuntime();
  if (state.accessMode !== "desktop-loopback") throw Error("NETWORK_MODE_NOT_AUTHORIZED");
  const boundary = state.boundaryFor(new URL(request.url).origin);
  await boundary.authorizeRequest(requestBoundary(request), mutation
    ? { mutation: true, recentReauthentication: true } : undefined);
}
