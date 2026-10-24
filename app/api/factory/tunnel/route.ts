import { authorizeLocalFactoryRequest as authorize } from "../../../../core/auth/profile-experience/local-factory-request";
import { dispatchTunnelRequest } from "../../../../scripts/engineering-team/windows/tunnel/tunnel-http.mjs";
import { observeOwnTunnel, startOwnedTunnel, stopOwnTunnel, clearStaleTunnelSession } from "../../../../scripts/engineering-team/windows/tunnel/owner-tunnel-launch.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return dispatchTunnelRequest({ request, authorize,
    status: observeOwnTunnel, start: startOwnedTunnel, stop: stopOwnTunnel, clearStaleSession: clearStaleTunnelSession });
}
export async function POST(request: Request) {
  return dispatchTunnelRequest({ request, authorize,
    status: observeOwnTunnel, start: startOwnedTunnel, stop: stopOwnTunnel, clearStaleSession: clearStaleTunnelSession });
}
