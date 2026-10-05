import { getProfileExperienceRuntime, requestBoundary } from "../../../../../core/auth/profile-experience/profile-experience-runtime";
import { PlotPickleAuthError, toPublicAuthError } from "../../../../../core/auth/plotpickle-auth";
import { PlotPickleServerSessionError, toPublicServerSessionError } from "../../../../../core/auth/server-session/server-session-boundary";
import { readMediaRouteInteger } from "../../../../../core/media/media-route-input";
import {
  renderTimelineRangeWithOptionalFFrames,
  type TimelineLockedStoryboardFrame,
} from "../../../../../build/timeline-media-engine-handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function mediaAuthorizationDetail(error: unknown) {
  let detail: { readonly code: string; readonly message: string } = {
    code: "TIMELINE_MEDIA_AUTH_REJECTED",
    message: "The active PlotPickle Human session could not authorize this Timeline export.",
  };
  if (error instanceof PlotPickleServerSessionError) detail = toPublicServerSessionError(error);
  else if (error instanceof PlotPickleAuthError) detail = toPublicAuthError(error);
  return detail;
}

async function authorize(request: Request) {
  const runtimeState = await getProfileExperienceRuntime();
  return runtimeState.boundaryFor(new URL(request.url).origin).authorizeRequest(requestBoundary(request), { mutation: true });
}

export async function POST(request: Request) {
  try {
    await authorize(request);
  } catch (error) {
    const detail = mediaAuthorizationDetail(error);
    return json({ ok: false, code: detail.code, message: detail.message }, 403);
  }

  try {
    const input = await request.json() as Record<string, unknown>;
    const blockNumber = readMediaRouteInteger(input.blockNumber, { minimum: 1, maximum: 24 });
    const miniBlockNumber = readMediaRouteInteger(input.miniBlockNumber, { minimum: 1, maximum: 4 });
    const frameCount = Array.isArray(input.frames) ? input.frames.length : 0;
    if (
      !blockNumber
      || !miniBlockNumber
      || typeof input.projectId !== "string"
      || !frameCount
      || frameCount > 100
      || frameCount % 25 !== 0
    ) {
      return json({
        ok: false,
        message: "Choose one to four complete Timeline Mini-Blocks: 25, 50, 75 or 100 locked Storyboard frames.",
      }, 400);
    }

    const result = await renderTimelineRangeWithOptionalFFrames({
      requestId: `timeline-range-${input.projectId}-${blockNumber}-${miniBlockNumber}-${Date.now()}`,
      projectId: input.projectId,
      blockNumber,
      miniBlockNumber,
      frames: input.frames as TimelineLockedStoryboardFrame[],
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return json({
      ok: false,
      message: error instanceof Error ? error.message : "Timeline range render failed.",
    }, 400);
  }
}
