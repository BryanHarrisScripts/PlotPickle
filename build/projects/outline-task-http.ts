import { requestBoundary, type getProfileExperienceRuntime } from "../../core/auth/profile-experience/profile-experience-runtime";
import type { createOutlineTaskGateway } from "./outline-task-gateway";
import { outlineAssessmentMaterialReceipt } from "../../modules/plan/outline-agent-assessment";
import type { LibraryPPFProject } from "../../core/storage/library-project";
type ProfileRuntime = Awaited<ReturnType<typeof getProfileExperienceRuntime>>;

/** The production route and executable fixture use the same auth/CSRF adapter. */
export function createOutlineTaskHttpHandlers(runtimeState: () => Promise<ProfileRuntime>, hostFor: (state: ProfileRuntime) => ReturnType<typeof createOutlineTaskGateway>) {
function response(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
async function authorized(request: Request, mutation: boolean) {
  const state = await runtimeState();
  const { authContext } = await state.boundaryFor(new URL(request.url).origin).authorizeRequest(requestBoundary(request), { mutation });
  state.auth.createProfileVaultCapability(authContext);
  return { state, authContext };
}
async function GET(request: Request) {
  try {
    const { state, authContext } = await authorized(request, false);
    return response({ tasks: await hostFor(state).list(authContext) });
  } catch { return response({ message: "Unlock the owning Human profile and load its project to read Story Architect recovery." }, 403); }
}
async function POST(request: Request) {
  try {
    const { state, authContext } = await authorized(request, true);
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 4096) return response({ message: "Outline task request is too large." }, 413);
    const input = JSON.parse(text) as { action?: string; blocks?: number[]; taskId?: string; projectId?: string; materialReceipt?: string };
    const project = await state.privateStorage.loadActiveProject(authContext) as LibraryPPFProject | null;
    if (!project || project.id !== input.projectId) return response({ message: "Load the approved project before changing its Outline task." }, 409);
    const host = hostFor(state);
    if (input.action === "start") {
      if (await outlineAssessmentMaterialReceipt(project) !== input.materialReceipt) return response({ message: "The saved story differs from the approved review input. Save it and retry." }, 409);
      return response({ task: await host.start(authContext, input.blocks!) }, 202);
    }
    if (typeof input.taskId !== "string") return response({ message: "Choose a valid Outline task." }, 400);
    if (input.action === "resume") return response({ task: await host.resume(authContext, input.taskId) }, 202);
    if (input.action === "cancel") return response({ task: await host.cancel(authContext, input.taskId) });
    return response({ message: "That Outline task action is unavailable." }, 400);
  } catch (error) {
    const message = error instanceof Error && /^(Outline |Story Architect recovery|Pi Durable|Load |Invalid |Protected |Select a configured|Story Architect grants)/u.test(error.message)
      ? error.message.slice(0, 500) : "Story Architect task access was denied. Check the unlocked profile, current story and configured provider.";
    return response({ message }, 400);
  }
}

return { GET, POST };
}
