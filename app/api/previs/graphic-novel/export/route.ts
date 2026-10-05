import { getProfileExperienceRuntime, requestBoundary } from "../../../../../core/auth/profile-experience/profile-experience-runtime";
import { PlotPickleAuthError, toPublicAuthError } from "../../../../../core/auth/plotpickle-auth";
import { PlotPickleServerSessionError, toPublicServerSessionError } from "../../../../../core/auth/server-session/server-session-boundary";
import { readMediaRouteInteger } from "../../../../../core/media/media-route-input";
import { buildPrevisGraphicNovelWebp, type PrevisGraphicNovelWebpPanel } from "../../../../../build/previs-graphic-novel-webp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportInput = {
  projectTitle?: unknown;
  blockNumber?: unknown;
  miniBlockNumber?: unknown;
  panels?: unknown;
};

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

function publicAuthorizationError(error: unknown) {
  if (error instanceof PlotPickleServerSessionError) return toPublicServerSessionError(error);
  if (error instanceof PlotPickleAuthError) return toPublicAuthError(error);
  return { code: "PREVIS_EXPORT_AUTH_REJECTED", message: "The active PlotPickle Human session could not authorize this export." } as const;
}

async function authorize(request: Request) {
  const runtimeState = await getProfileExperienceRuntime();
  const origin = new URL(request.url).origin;
  const boundary = runtimeState.boundaryFor(origin);
  return boundary.authorizeRequest(requestBoundary(request), { mutation: true });
}

function cleanProjectTitle(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, 180) : "";
}

export async function POST(request: Request) {
  try {
    await authorize(request);
  } catch (error) {
    const detail = publicAuthorizationError(error);
    return json({ ok: false, code: detail.code, message: detail.message }, 403);
  }

  try {
    const input = await request.json() as ExportInput;
    const blockNumber = readMediaRouteInteger(input.blockNumber, { minimum: 1, maximum: 24 });
    const miniBlockNumber = readMediaRouteInteger(input.miniBlockNumber, { minimum: 1, maximum: 4 });
    if (!blockNumber || !miniBlockNumber) {
      return json({ ok: false, message: "Choose a valid Previs Block and Mini-Block before exporting." }, 400);
    }
    if (!Array.isArray(input.panels) || input.panels.length > 25) {
      return json({ ok: false, message: "WebP export accepts between 1 and 25 locked Storyboard panels." }, 400);
    }

    const result = await buildPrevisGraphicNovelWebp({
      projectTitle: cleanProjectTitle(input.projectTitle) || "Untitled Story",
      blockNumber,
      miniBlockNumber,
      panels: input.panels as PrevisGraphicNovelWebpPanel[],
    });

    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-PlotPickle-Graphic-Novel-Panels": String(result.panelCount),
      },
    });
  } catch (error) {
    return json({
      ok: false,
      message: error instanceof Error ? error.message : "WebP export failed.",
    }, 400);
  }
}
