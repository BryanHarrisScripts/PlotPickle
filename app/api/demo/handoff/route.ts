import { toPublicAuthError } from "@/core/auth/plotpickle-auth";
import {
  getProfileExperienceRuntime,
  requestBoundary,
} from "@/core/auth/profile-experience/profile-experience-runtime";
import { toPublicServerSessionError } from "@/core/auth/server-session/server-session-boundary";
import { createDemoBoundary } from "@/core/demo-onboarding/demo-boundary.mjs";
import { createEmptyProject, normalizeFoundationProject } from "@/core/project/project";
import { createStoryDemoStarterHandoff } from "@/modules/story-the-unwritten/demo/handoff.mjs";
import {
  DEMO_STORY_SCENARIO_ID,
  DEMO_STORY_SEED,
} from "@/modules/story-the-unwritten/demo/world.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function errorResponse(error: unknown) {
  const server = toPublicServerSessionError(error);
  const auth = toPublicAuthError(error);
  const detail = server.code !== "SERVER_SESSION_FAILED" ? server : auth;
  if (detail.code !== "AUTH_REQUEST_REJECTED") {
    return response(detail, detail.code === "ACCESS_DENIED" ? 403 : 400);
  }
  const message = error instanceof Error && error.message ? error.message : "The DEMO handoff could not be completed.";
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "DEMO_HANDOFF_REJECTED";
  return response({ code, message }, 400);
}

function normalizeDecisionIds(value: unknown) {
  if (!Array.isArray(value) || value.length !== 5
    || value.some((item) => typeof item !== "string" || !item.startsWith("demo:decision:"))) {
    const error = new Error("Make This Mine requires the completed five-scene DEMO path.");
    (error as Error & { code?: string }).code = "DEMO_HANDOFF_INCOMPLETE_PATH";
    throw error;
  }
  return value as string[];
}

function projectIdForHandoff(value: unknown) {
  const handoffId = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(handoffId)) {
    const error = new Error("The Make This Mine transaction id is invalid.");
    (error as Error & { code?: string }).code = "DEMO_HANDOFF_ID_INVALID";
    throw error;
  }
  return `demo-import-${handoffId}`;
}

function samePortableStarter(existing: ReturnType<typeof normalizeFoundationProject>, expected: ReturnType<typeof normalizeFoundationProject>) {
  return existing.title === expected.title
    && existing.foundations.brief.content === expected.foundations.brief.content;
}

export async function POST(request: Request) {
  try {
    const runtimeState = await getProfileExperienceRuntime();
    if (runtimeState.accessMode !== "desktop-loopback") {
      return response({ code: "DEMO_LOCAL_ONLY", message: "Make This Mine is available only from a local desktop PlotPickle DEMO." }, 403);
    }

    const boundary = runtimeState.boundaryFor(new URL(request.url).origin);
    const { authContext } = await boundary.authorizeRequest(requestBoundary(request), { mutation: true });
    const input = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (input.action !== "make-this-mine") {
      return response({ code: "DEMO_HANDOFF_ACTION_UNSUPPORTED", message: "That DEMO handoff action is unavailable." }, 400);
    }

    const decisionIds = normalizeDecisionIds(input.decisionIds);
    const projectId = projectIdForHandoff(input.handoffId);
    const demoBoundary = createDemoBoundary({ demoId: DEMO_STORY_SCENARIO_ID, seed: DEMO_STORY_SEED });
    const handoff = createStoryDemoStarterHandoff({
      boundary: demoBoundary,
      decisionIds,
      approved: input.approved === true,
    });
    const starter = handoff.starterContent as { readonly title: string; readonly foundationsBrief: string };
    const now = new Date().toISOString();
    const empty = createEmptyProject({ id: projectId, now, title: starter.title });
    const project = normalizeFoundationProject({
      ...empty,
      foundations: {
        ...empty.foundations,
        brief: { content: starter.foundationsBrief, savedAt: now },
      },
    });

    if (JSON.stringify(project).includes("demo:")) {
      const error = new Error("The portable DEMO handoff attempted to persist a synthetic runtime reference.");
      (error as Error & { code?: string }).code = "DEMO_HANDOFF_SYNTHETIC_REF";
      throw error;
    }

    const existing = await runtimeState.privateStorage.loadProject(authContext, projectId);
    if (existing) {
      const normalizedExisting = normalizeFoundationProject(existing);
      if (!samePortableStarter(normalizedExisting, project)) {
        const error = new Error("The Make This Mine transaction id already belongs to different Human project data.");
        (error as Error & { code?: string }).code = "DEMO_HANDOFF_ID_CONFLICT";
        throw error;
      }
      await runtimeState.privateStorage.activateProject(authContext, projectId);
      return response({ projectId, title: normalizedExisting.title, destination: handoff.destination, reused: true });
    }

    const saved = await runtimeState.privateStorage.saveProject(authContext, { project, activate: true });
    return response({
      projectId: saved.summary.projectId,
      title: saved.summary.title,
      destination: handoff.destination,
      reused: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
