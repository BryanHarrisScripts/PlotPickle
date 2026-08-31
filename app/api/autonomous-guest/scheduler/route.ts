import { getAutonomousGuestAuthority } from "../../../../core/auth/autonomous-guest/guest-authority";
import { getProfileExperienceRuntime } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import {
  applyAutonomousGuestSchedulerSettingsAction,
  readAutonomousGuestSchedulerSettings,
  unavailableAutonomousGuestSchedulerSettings,
} from "../../../../build/autonomous-guest/settings/scheduler-settings";

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

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "Autonomous Guest scheduler request failed.";
  return { code: "AUTONOMOUS_GUEST_SCHEDULER_REJECTED", message } as const;
}

export async function GET(request: Request) {
  try {
    const authority = await authorityFor(request);
    if (!authority) return response(unavailableAutonomousGuestSchedulerSettings());
    return response(await readAutonomousGuestSchedulerSettings(authority));
  } catch (error) {
    return response(publicError(error), 400);
  }
}

export async function POST(request: Request) {
  try {
    const authority = await authorityFor(request);
    if (!authority) return response({ code: "AUTONOMOUS_GUEST_UNAVAILABLE", message: "Autonomous Guest scheduling is not available for this local runtime." }, 409);
    const input = await request.json() as Record<string, unknown>;
    const result = await applyAutonomousGuestSchedulerSettingsAction(authority, {
      action: String(input.action || ""),
      enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
      taskId: typeof input.taskId === "string" ? input.taskId : undefined,
      cron: typeof input.cron === "string" ? input.cron : undefined,
      timezone: typeof input.timezone === "string" ? input.timezone : undefined,
    });
    return response(result);
  } catch (error) {
    return response(publicError(error), 400);
  }
}
