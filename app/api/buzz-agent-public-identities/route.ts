import {
  loadLocalBuzzAgentIdentityBindings,
  saveLocalBuzzAgentIdentityBinding,
} from "../../../build/buzz-agent-identity-binding-loader";
import {
  getProfileExperienceRuntime,
  requestBoundary,
} from "../../../core/auth/profile-experience/profile-experience-runtime";
import { PLOTPICKLE_COMMUNITY_EXTENSIONS } from "../../../plugins/plotpickle-playhouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFFICIAL_PROFILE_IDS = new Set(PLOTPICKLE_COMMUNITY_EXTENSIONS.agents.map((agent) => agent.profileId));

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

async function authorize(request: Request, mutation = false) {
  const runtimeState = await getProfileExperienceRuntime();
  const boundary = runtimeState.boundaryFor(new URL(request.url).origin);
  return boundary.authorizeRequest(requestBoundary(request), mutation ? { mutation: true } : undefined);
}

function messageOf(error: unknown) {
  return error instanceof Error && error.message ? error.message : "The BUZZ public-key binding request could not be completed.";
}

export async function GET(request: Request) {
  try {
    await authorize(request);
    return response({ bindings: await loadLocalBuzzAgentIdentityBindings() });
  } catch (error) {
    return response({ code: "BUZZ_AGENT_BINDINGS_UNAVAILABLE", message: messageOf(error) }, 403);
  }
}

export async function POST(request: Request) {
  try {
    await authorize(request, true);
    const input = await request.json() as Record<string, unknown>;
    const profileId = typeof input.profileId === "string" ? input.profileId.trim() : "";
    const pubkey = typeof input.pubkey === "string" ? input.pubkey.trim() : "";
    if (!OFFICIAL_PROFILE_IDS.has(profileId)) {
      return response({ code: "UNKNOWN_AGENT_PROFILE", message: "Choose an official PlotPickle Helper before saving a BUZZ public key." }, 400);
    }
    const bindings = await saveLocalBuzzAgentIdentityBinding(profileId, pubkey);
    return response({ bindings, profileId, pubkey: bindings[profileId] ?? "" });
  } catch (error) {
    return response({ code: "BUZZ_AGENT_BINDING_REJECTED", message: messageOf(error) }, 400);
  }
}
