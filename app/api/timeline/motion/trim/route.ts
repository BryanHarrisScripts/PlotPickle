import { getProfileExperienceRuntime, requestBoundary } from "../../../../../core/auth/profile-experience/profile-experience-runtime";
import { assetsDirectory } from "../../../../../build/media-storage-common";
import { renderTimelineThreeSecondClip, timelineMotionTrimReadiness } from "../../../../../build/timeline-72-frame-clip.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Readiness is checked before billing acknowledgement; this endpoint creates no video. */
export async function GET(request: Request) {
  try {
    const experience = await getProfileExperienceRuntime();
    await experience.boundaryFor(new URL(request.url).origin)
      .authorizeRequest(requestBoundary(request), { mutation: false });
  } catch {
    return response({ ready: false, message: "Unlock your Human profile before testing local motion readiness." }, 403);
  }
  return response(await timelineMotionTrimReadiness());
}

export async function POST(request: Request) {
  try {
    const experience = await getProfileExperienceRuntime();
    await experience.boundaryFor(new URL(request.url).origin)
      .authorizeRequest(requestBoundary(request), { mutation: true });
  } catch {
    return response({ ok: false, message: "Unlock your Human profile before preparing the Timeline motion clip." }, 403);
  }
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)
      || typeof (input as { sourceAssetUrl?: unknown }).sourceAssetUrl !== "string") {
      return response({ ok: false, message: "A saved PlotPickle provider video URL is required." }, 400);
    }
    const result = await renderTimelineThreeSecondClip({
      sourceAssetUrl: (input as { sourceAssetUrl: string }).sourceAssetUrl,
      directory: assetsDirectory(),
    });
    return response({ ok: true, ...result });
  } catch (error) {
    return response({
      ok: false,
      message: error instanceof Error ? error.message : "Local three-second motion rendering was not verified. The original provider job remains available.",
    }, 422);
  }
}
