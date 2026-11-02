import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { dispatchAgentMissionRequest } from "../../../../scripts/engineering-team/gateway/agent-mission-http.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The existing local Human profile boundary supplies the real session actor.
// POST requires CSRF and recent reauthentication, not merely an open browser.
async function authorize(request: Request, mutation: boolean) {
  const state = await getProfileExperienceRuntime();
  if (state.accessMode !== "desktop-loopback") throw Error("NETWORK_MODE_NOT_AUTHORIZED");
  const boundary = state.boundaryFor(new URL(request.url).origin);
  const { authContext } = await boundary.authorizeRequest(
    requestBoundary(request),
    mutation ? { mutation: true, recentReauthentication: true } : undefined,
  );
  return { profileId: authContext.profileId, nodeId: authContext.nodeId };
}
export async function GET(request: Request) {
  return dispatchAgentMissionRequest({ request, authorize });
}
export async function POST(request: Request) {
  return dispatchAgentMissionRequest({ request, authorize });
}
