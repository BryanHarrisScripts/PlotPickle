import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { dispatchSupervisorRequest } from "../../../../scripts/engineering-team/windows/supervisor/supervisor-http.mjs";
import {
  supervisorStatus, pauseSupervisor, resumeSupervisor,
} from "../../../../scripts/engineering-team/windows/supervisor/unattended-supervisor.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Exact consent remains server-side, never in client JavaScript or a remotely
// chosen shell/worker/PID. The real supervisor also checks host, actor and SHA.
const CONSENT = "ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR";
const lifecycle = Object.freeze({
  status: () => supervisorStatus(),
  pause: () => pauseSupervisor({ consent: CONSENT }),
  resume: () => resumeSupervisor({ consent: CONSENT }),
});

async function authorize(request: Request, mutation: boolean) {
  const state = await getProfileExperienceRuntime();
  if (state.accessMode !== "desktop-loopback") throw Error("NETWORK_MODE_NOT_AUTHORIZED");
  const boundary = state.boundaryFor(new URL(request.url).origin);
  await boundary.authorizeRequest(requestBoundary(request), mutation
    ? { mutation: true, recentReauthentication: true } : undefined);
}

export async function GET(request: Request) {
  return dispatchSupervisorRequest({ request, authorize, lifecycle });
}

export async function POST(request: Request) {
  return dispatchSupervisorRequest({ request, authorize, lifecycle });
}
