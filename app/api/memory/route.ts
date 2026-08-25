import { toPublicAuthError, type AuthContext } from "../../../core/auth/plotpickle-auth";
import { toPublicServerSessionError } from "../../../core/auth/server-session/server-session-boundary";
import {
  getProfileExperienceRuntime,
  requestBoundary,
} from "../../../core/auth/profile-experience/profile-experience-runtime";
import {
  createMemoryService,
  createProfilePrivateMemoryStore,
  type MemoryService,
  type MemorySessionProof,
} from "../../../core/memory/memory-service";
import {
  retrieveAveryContinuity,
  retrieveSageContinuity,
} from "../../../core/memory/agent-memory-continuity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_PROOF: MemorySessionProof = Object.freeze({ sessionId: "authorized-memory-request" });
const ALLOWED_AGENT_IDS = new Set(["sage-brinewick", "avery-north"]);

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

async function memoryServiceFor(
  runtimeState: Awaited<ReturnType<typeof getProfileExperienceRuntime>>,
  authContext: AuthContext,
): Promise<MemoryService> {
  const projects = await runtimeState.privateStorage.listProjects(authContext);
  const projectIds = new Set(projects.map((project) => project.projectId));
  return createMemoryService({
    resolveSession(sessionId) {
      if (sessionId !== REQUEST_PROOF.sessionId) throw new Error("Memory request proof is invalid.");
      return authContext;
    },
    store: createProfilePrivateMemoryStore(runtimeState.privateStorage),
    authorizeProject: ({ projectId }) => projectIds.has(projectId),
    authorizeAgent: ({ agentId }) => ALLOWED_AGENT_IDS.has(agentId),
  });
}

function projectIdFrom(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export async function GET(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request);
    const url = new URL(request.url);
    const projectId = projectIdFrom(url.searchParams.get("projectId"));
    const query = (url.searchParams.get("q") || "").trim().slice(0, 2_000);
    const agentId = url.searchParams.get("agentId") || "sage-brinewick";
    if (!projectId) return response({ code: "MEMORY_PROJECT_REQUIRED", message: "Choose an active project before using project memory." }, 400);
    if (!ALLOWED_AGENT_IDS.has(agentId)) return response({ code: "MEMORY_AGENT_DENIED", message: "That agent cannot request Memory v1 context." }, 403);

    const service = await memoryServiceFor(runtimeState, authContext);
    const retrieval = agentId === "avery-north"
      ? await retrieveAveryContinuity(service, REQUEST_PROOF, { projectId, text: query })
      : await retrieveSageContinuity(service, REQUEST_PROOF, { projectId, text: query });
    return response({
      ok: true,
      agentId,
      projectId,
      retrieval,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request, true);
    const body = await request.json() as Record<string, unknown>;
    const service = await memoryServiceFor(runtimeState, authContext);
    const projectId = projectIdFrom(body.projectId);

    if (body.action === "remember") {
      const scope = body.scope === "human" ? "human" : "project";
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) return response({ code: "MEMORY_CONTENT_REQUIRED", message: "Tell Sage what should be remembered." }, 400);
      if (scope === "project" && !projectId) return response({ code: "MEMORY_PROJECT_REQUIRED", message: "Choose an active project before saving project memory." }, 400);
      const record = await service.saveMemory(REQUEST_PROOF, {
        scope,
        ...(scope === "project" ? { projectId } : {}),
        content,
        source: "human",
        tags: ["explicit"],
      });
      return response({ ok: true, action: "remember", memory: { id: record.id, scope: record.scope, projectId: record.projectId } });
    }

    if (body.action === "forget") {
      const memoryId = typeof body.memoryId === "string" ? body.memoryId.trim() : "";
      const query = typeof body.query === "string" ? body.query.trim().slice(0, 2_000) : "";
      if (memoryId) {
        const forgotten = await service.forgetMemory(REQUEST_PROOF, memoryId);
        return response({ ok: true, action: "forget", memory: { id: forgotten.id } });
      }
      if (query) {
        if (!projectId) return response({ code: "MEMORY_PROJECT_REQUIRED", message: "Choose an active project before forgetting contextual memory." }, 400);
        const retrieval = await retrieveSageContinuity(service, REQUEST_PROOF, { projectId, text: query });
        const target = retrieval.items[0];
        if (!target) return response({ code: "MEMORY_NOT_FOUND", message: "I could not find a remembered item matching that." }, 404);
        const forgotten = await service.forgetMemory(REQUEST_PROOF, target.id);
        return response({ ok: true, action: "forget", memory: { id: forgotten.id } });
      }
      if (!projectId) return response({ code: "MEMORY_PROJECT_REQUIRED", message: "Choose an active project before using ‘forget this’." }, 400);
      const projectMemories = await service.listMemories(REQUEST_PROOF, { scope: "project", projectId });
      const target = [...projectMemories].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))[0];
      if (!target) return response({ code: "MEMORY_NOT_FOUND", message: "There is no current-project memory to forget." }, 404);
      const forgotten = await service.forgetMemory(REQUEST_PROOF, target.id);
      return response({ ok: true, action: "forget", memory: { id: forgotten.id } });
    }

    return response({ code: "UNSUPPORTED_MEMORY_ACTION", message: "That Memory v1 action is unavailable." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
