import { normalizeFoundationProject } from "../../../../core/project/project";
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
    let project = await runtimeState.privateStorage.loadActiveProject(authContext);
    if (!project) {
      const projects = await runtimeState.privateStorage.listProjects(authContext);
      if (projects[0]) {
        await runtimeState.privateStorage.activateProject(authContext, projects[0].projectId);
        project = await runtimeState.privateStorage.loadActiveProject(authContext);
      }
    }
    const wyrmwood = await runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "wyrmwood-state" });
    return response({ project, wyrmwood });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request, true);
    const input = await request.json() as Record<string, unknown>;
    if (input.action === "save-project") {
      const project = normalizeFoundationProject(input.project);
      const saved = await runtimeState.privateStorage.saveProject(authContext, { project });
      return response({ projectId: saved.summary.projectId });
    }
    if (input.action === "save-wyrmwood") {
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: "wyrmwood-state", value: input.value });
      return response({ ok: true });
    }
    return response({ code: "UNSUPPORTED_PRIVATE_ACTION", message: "That private profile action is unavailable." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
