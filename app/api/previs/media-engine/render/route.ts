import { getProfileExperienceRuntime, requestBoundary } from "../../../../../core/auth/profile-experience/profile-experience-runtime";
import { PlotPickleAuthError, toPublicAuthError } from "../../../../../core/auth/plotpickle-auth";
import { PlotPickleServerSessionError, toPublicServerSessionError } from "../../../../../core/auth/server-session/server-session-boundary";
import { renderPrevisMiniBlockWithOptionalFFrames, type PrevisLockedStoryboardFrame } from "../../../../../build/previs-media-engine-handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
function mediaAuthorizationDetail(error: unknown) {
  let detail: { readonly code: string; readonly message: string } = {
    code: "PREVIS_MEDIA_AUTH_REJECTED",
    message: "The active PlotPickle Human session could not authorize this render.",
  };
  if (error instanceof PlotPickleServerSessionError) detail = toPublicServerSessionError(error);
  else if (error instanceof PlotPickleAuthError) detail = toPublicAuthError(error);
  return detail;
}
async function authorize(request: Request) {
  const runtimeState = await getProfileExperienceRuntime();
  return runtimeState.boundaryFor(new URL(request.url).origin).authorizeRequest(requestBoundary(request), { mutation: true });
}
function integer(value: unknown, minimum: number, maximum: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
}

export async function POST(request: Request) {
  try { await authorize(request); } catch (error) {
    const detail = mediaAuthorizationDetail(error);
    return json({ ok: false, code: detail.code, message: detail.message }, 403);
  }
  try {
    const input = await request.json() as Record<string, unknown>;
    const blockNumber = integer(input.blockNumber, 1, 24);
    const miniBlockNumber = integer(input.miniBlockNumber, 1, 4);
    if (!blockNumber || !miniBlockNumber || typeof input.projectId !== "string" || !Array.isArray(input.frames) || input.frames.length > 25) {
      return json({ ok: false, message: "Choose a valid Previs Mini-Block with up to 25 locked Storyboard frames." }, 400);
    }
    const result = await renderPrevisMiniBlockWithOptionalFFrames({
      requestId: `previs-${input.projectId}-${blockNumber}-${miniBlockNumber}-${Date.now()}`,
      projectId: input.projectId,
      blockNumber,
      miniBlockNumber,
      frames: input.frames as PrevisLockedStoryboardFrame[],
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : "Previs media render failed." }, 400);
  }
}
