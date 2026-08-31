import { getAutonomousGuestAuthority } from "../../../../../core/auth/autonomous-guest/guest-authority";
import { getProfileExperienceRuntime } from "../../../../../core/auth/profile-experience/profile-experience-runtime";
import {
  claimAutonomousGuestReferenceRouteTask,
  finishAutonomousGuestReferenceRouteTask,
  initializeAutonomousGuestReferenceTasks,
  readAutonomousGuestReferenceTaskStatus,
} from "../../../../../build/autonomous-guest/reference-route-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

async function authorityFor(request: Request) {
  const runtimeState = await getProfileExperienceRuntime();
  return getAutonomousGuestAuthority(new URL(request.url).origin, runtimeState.accessMode);
}

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry ?? "")]));
}

function publicError(error: unknown) {
  return {
    code: "AUTONOMOUS_GUEST_REFERENCE_TASK_REJECTED",
    message: error instanceof Error ? error.message : "Autonomous Guest reference task request failed.",
  } as const;
}

export async function GET(request: Request) {
  try {
    const authority = await authorityFor(request);
    if (!authority) return response({ available: false, tasks: [], allOperated: false }, 409);
    return response(await readAutonomousGuestReferenceTaskStatus(authority));
  } catch (error) {
    return response(publicError(error), 400);
  }
}

export async function POST(request: Request) {
  try {
    const authority = await authorityFor(request);
    if (!authority) return response({ code: "AUTONOMOUS_GUEST_UNAVAILABLE", message: "Autonomous Guest reference tasks are unavailable for this local runtime." }, 409);
    const input = await request.json() as Record<string, unknown>;
    const action = String(input.action || "");
    if (action === "initialize") {
      const routeIds = Array.isArray(input.routeIds) ? input.routeIds.map((routeId) => String(routeId)) : [];
      return response(await initializeAutonomousGuestReferenceTasks(authority, {
        projectId: String(input.projectId || ""),
        currentRevision: String(input.currentRevision || ""),
        routeIds,
        routeInputs: stringRecord(input.routeInputs),
      }));
    }
    if (action === "claim") {
      return response(await claimAutonomousGuestReferenceRouteTask(authority, String(input.routeId || "")));
    }
    if (action === "finish") {
      return response(await finishAutonomousGuestReferenceRouteTask(authority, {
        routeId: String(input.routeId || ""),
        taskId: String(input.taskId || ""),
        leaseId: String(input.leaseId || ""),
        disposition: String(input.disposition || ""),
        actionId: typeof input.actionId === "string" ? input.actionId : undefined,
        revision: typeof input.revision === "string" ? input.revision : undefined,
      }));
    }
    if (action === "status") return response(await readAutonomousGuestReferenceTaskStatus(authority));
    return response({ code: "AUTONOMOUS_GUEST_REFERENCE_ACTION_UNKNOWN", message: "Autonomous Guest reference task action is not supported." }, 400);
  } catch (error) {
    return response(publicError(error), 400);
  }
}
