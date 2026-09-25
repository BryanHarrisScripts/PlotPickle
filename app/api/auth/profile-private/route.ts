import { normalizeStoryMapContextRegistry } from "../../../../core/storage/story-map-context";
import type { ProfileProjectSummary } from "../../../../core/storage/profile-private/profile-private-storage";
import { normalizeLibraryProject } from "../../../../core/storage/library-project";
import { toPublicAuthError } from "../../../../core/auth/plotpickle-auth";
import { toPublicServerSessionError } from "../../../../core/auth/server-session/server-session-boundary";
import {
  getProfileExperienceRuntime,
  requestBoundary,
} from "../../../../core/auth/profile-experience/profile-experience-runtime";

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
  return response(detail, detail.code === "ACCESS_DENIED" ? 403 : 400);
}

async function authorized(request: Request, mutation = false) {
  const runtimeState = await getProfileExperienceRuntime();
  const boundary = runtimeState.boundaryFor(new URL(request.url).origin);
  const { authContext } = await boundary.authorizeRequest(requestBoundary(request), mutation ? { mutation: true } : undefined);
  return { runtimeState, authContext };
}

export async function GET(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request);
    const summaries = await runtimeState.privateStorage.listProjects(authContext);
    let project = await runtimeState.privateStorage.loadActiveProject(authContext).catch(() => null);
    if (!project) {
      for (const summary of summaries) {
        const candidate = await runtimeState.privateStorage.loadProject(authContext, summary.projectId).catch(() => null);
        if (!candidate) continue;
        await runtimeState.privateStorage.activateProject(authContext, summary.projectId);
        project = candidate;
        break;
      }
    }
    const [projects, wyrmwood, storyMapContexts] = await Promise.all([
      Promise.all(summaries.map(async (summary) => {
        const savedProject = await runtimeState.privateStorage.loadProject(authContext, summary.projectId).catch(() => null);
        return savedProject ? { project: savedProject, summary } : null;
      })),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "wyrmwood-state" }),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "story-map-contexts" }),
    ]);
    return response({
      project,
      activeProjectId: project && typeof project === "object" && !Array.isArray(project) && typeof project.id === "string" ? project.id : null,
      projects: projects.filter((item): item is NonNullable<typeof item> => Boolean(item)),
      wyrmwood,
      storyMapContexts: normalizeStoryMapContextRegistry(storyMapContexts),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request, true);
    const input = await request.json() as Record<string, unknown>;
    if (input.action === "save-project") {
      const project = normalizeLibraryProject(input.project);
      const summary = input.summary && typeof input.summary === "object" && !Array.isArray(input.summary)
        ? input.summary as Partial<ProfileProjectSummary>
        : undefined;
      const saved = await runtimeState.privateStorage.saveProject(authContext, { project, summary });
      return response({ projectId: saved.summary.projectId });
    }
    if (input.action === "save-wyrmwood") {
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: "wyrmwood-state", value: input.value });
      return response({ ok: true });
    }
    if (input.action === "save-story-map-contexts") {
      const value = normalizeStoryMapContextRegistry(input.value);
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: "story-map-contexts", value });
      return response({ ok: true });
    }
    return response({ code: "UNSUPPORTED_PRIVATE_ACTION", message: "That private profile action is unavailable." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
