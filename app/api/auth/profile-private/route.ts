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

function normalizeRecoveryPoints(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim().slice(0, 360) : "";
    const projectId = typeof source.projectId === "string" ? source.projectId.trim().slice(0, 240) : "";
    const title = typeof source.title === "string" ? source.title.trim().slice(0, 500) : "";
    const createdAt = typeof source.createdAt === "string" ? source.createdAt.trim().slice(0, 80) : "";
    const reason = source.reason === "unload" || source.reason === "manual" || source.reason === "pre-restore" ? source.reason : null;
    if (!id || !projectId || !title || !createdAt || !reason || !source.project) return [];
    try {
      const project = normalizeLibraryProject(source.project);
      if (project.id !== projectId) return [];
      return [{
        id,
        projectId,
        title,
        revision: Number.isInteger(source.revision) ? Number(source.revision) : project.revision,
        createdAt,
        reason,
        project,
      }];
    } catch {
      return [];
    }
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
      for (const summary of summaries.filter((item) => !item.archivedAt)) {
        const candidate = await runtimeState.privateStorage.loadProject(authContext, summary.projectId).catch(() => null);
        if (!candidate) continue;
        await runtimeState.privateStorage.activateProject(authContext, summary.projectId);
        project = candidate;
        break;
      }
    }
    const [projects, wyrmwood, storyMapContexts, recoveryPoints] = await Promise.all([
      Promise.all(summaries.map(async (summary) => {
        const savedProject = await runtimeState.privateStorage.loadProject(authContext, summary.projectId).catch(() => null);
        return savedProject ? { project: savedProject, summary } : null;
      })),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "wyrmwood-state" }),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "story-map-contexts" }),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "library-recovery-points" }),
    ]);
    return response({
      project,
      activeProjectId: project && typeof project === "object" && !Array.isArray(project) && typeof (project as { id?: unknown }).id === "string" ? (project as { id: string }).id : null,
      projects: projects.filter((item): item is NonNullable<typeof item> => Boolean(item)),
      wyrmwood,
      storyMapContexts: normalizeStoryMapContextRegistry(storyMapContexts),
      recoveryPoints: normalizeRecoveryPoints(recoveryPoints),
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
      const saved = await runtimeState.privateStorage.saveProject(authContext, {
        project,
        summary,
        activate: input.activate === false ? false : true,
      });
      return response({ projectId: saved.summary.projectId });
    }
    if (input.action === "sync-library") {
      if (!Array.isArray(input.projects)) return response({ message: "Invalid Library inventory." }, 400);
      const projects = input.projects.map((entry) => {
        const value = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
        return {
          project: normalizeLibraryProject(value.project),
          summary: value.summary && typeof value.summary === "object" && !Array.isArray(value.summary)
            ? value.summary as Partial<ProfileProjectSummary> : undefined,
        };
      });
      return response(await runtimeState.privateStorage.syncLibrary(authContext, {
        activeProjectId: typeof input.activeProjectId === "string" ? input.activeProjectId : null,
        projects,
      }));
    }
    if (input.action === "sync-library-index") {
      if (!Array.isArray(input.summaries)) return response({ message: "Invalid Library index inventory." }, 400);
      const summaries = input.summaries.map((value) => (
        value && typeof value === "object" && !Array.isArray(value)
          ? value as Partial<ProfileProjectSummary>
          : {}
      ));
      return response(await runtimeState.privateStorage.syncLibraryIndex(authContext, {
        activeProjectId: typeof input.activeProjectId === "string" ? input.activeProjectId : null,
        summaries,
      }));
    }
    if (input.action === "delete-archived-project") {
      return response(await runtimeState.privateStorage.deleteArchivedProject(authContext, String(input.projectId || "")));
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
    if (input.action === "save-recovery-points") {
      const value = normalizeRecoveryPoints(input.value);
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: "library-recovery-points", value });
      return response({ ok: true, count: value.length });
    }
    return response({ code: "UNSUPPORTED_PRIVATE_ACTION", message: "That private profile action is unavailable." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
