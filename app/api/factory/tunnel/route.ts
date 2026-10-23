import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { dispatchTunnelRequest } from "../../../../scripts/engineering-team/windows/tunnel/tunnel-http.mjs";
import { tunnelLocalStatus, launchOwnTunnel } from "../../../../scripts/engineering-team/windows/tunnel/owner-tunnel-launch.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(request: Request, mutation: boolean) {
  const state = await getProfileExperienceRuntime();
  if (state.accessMode !== "desktop-loopback") throw Error("NETWORK_MODE_NOT_AUTHORIZED");
  const boundary = state.boundaryFor(new URL(request.url).origin);
  await boundary.authorizeRequest(requestBoundary(request), mutation
    ? { mutation: true, recentReauthentication: true } : undefined);
}

export async function GET(request: Request) {
  return dispatchTunnelRequest({ request, authorize,
    status: tunnelLocalStatus, start: launchOwnTunnel });
}
export async function POST(request: Request) {
  return dispatchTunnelRequest({ request, authorize,
    status: tunnelLocalStatus, start: launchOwnTunnel });
}
