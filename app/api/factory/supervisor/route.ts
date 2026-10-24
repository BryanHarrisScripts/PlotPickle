import { authorizeLocalFactoryRequest as authorize } from "../../../../core/auth/profile-experience/local-factory-request";
import { dispatchSupervisorRequest } from "../../../../scripts/engineering-team/windows/supervisor/supervisor-http.mjs";
import {
  supervisorStatus, pauseSupervisor, resumeSupervisor, disableSupervisor,
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
  // STOP is only a local marker request, never a PID-kill or cleanup proof.
  stop: () => disableSupervisor(),
});

export async function GET(request: Request) {
  return dispatchSupervisorRequest({ request, authorize, lifecycle });
}

export async function POST(request: Request) {
  return dispatchSupervisorRequest({ request, authorize, lifecycle });
}
