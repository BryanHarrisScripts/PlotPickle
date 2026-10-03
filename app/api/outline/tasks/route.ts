import { getProfileExperienceRuntime } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { createOutlineTaskGateway } from "../../../../build/projects/outline-task-gateway";
import { createOutlineTaskHttpHandlers } from "../../../../build/projects/outline-task-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ProfileRuntime = Awaited<ReturnType<typeof getProfileExperienceRuntime>>;
const gateways = new WeakMap<ProfileRuntime, ReturnType<typeof createOutlineTaskGateway>>();
function gateway(state: ProfileRuntime) {
  let value = gateways.get(state);
  if (!value) { value = createOutlineTaskGateway(state); gateways.set(state, value); }
  return value;
}
const handlers = createOutlineTaskHttpHandlers(getProfileExperienceRuntime, gateway);
export const GET = handlers.GET;
export const POST = handlers.POST;
