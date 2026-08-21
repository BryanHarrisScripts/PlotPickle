import { toPublicAuthError, type ProfileSummary } from "../../../../core/auth/plotpickle-auth";
import { toPublicServerSessionError } from "../../../../core/auth/server-session/server-session-boundary";
import {
  getProfileExperienceRuntime,
  requestBoundary,
} from "../../../../core/auth/profile-experience/profile-experience-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESENTATION_OBJECT_ID = "human-presentation";
const MAX_BIO_LENGTH = 500;
const MAX_AVATAR_URL_LENGTH = 2_048;

type StoredPresentation = {
  version: 1;
  avatarUrl: string;
  publicBio: string;
  updatedAt: string;
};

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

function publicBio(value: unknown) {
  if (typeof value !== "string") throw new Error("Public bio must be text.");
  const normalized = value.trim();
  if (normalized.length > MAX_BIO_LENGTH || /[\u0000-\u001f\u007f]/u.test(normalized)) throw new Error(`Public bio must be ${MAX_BIO_LENGTH} characters or fewer without control characters.`);
  return normalized;
}

function avatarUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw new Error("Avatar must be a web image address.");
  const normalized = value.trim();
  if (normalized.length > MAX_AVATAR_URL_LENGTH) throw new Error("Avatar image address is too long.");
  if (!URL.canParse(normalized)) throw new Error("Avatar must use a complete https:// image address.");
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:") throw new Error("Avatar must use a secure https:// image address.");
  if (parsed.username || parsed.password) throw new Error("Avatar image addresses cannot contain credentials.");
  return parsed.toString();
}

function storedPresentation(value: unknown): StoredPresentation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<StoredPresentation>;
  if (item.version !== 1 || typeof item.avatarUrl !== "string" || typeof item.publicBio !== "string" || typeof item.updatedAt !== "string") return null;
  return { version: 1, avatarUrl: item.avatarUrl, publicBio: item.publicBio, updatedAt: item.updatedAt };
}

export async function GET(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request);
    const profile = runtimeState.auth.getAuthStatus(authContext).profile as ProfileSummary;
    const stored = storedPresentation(await runtimeState.privateStorage.readPrivateJson(authContext, { domain: "settings", objectId: PRESENTATION_OBJECT_ID }));
    return response({
      profile: {
        displayName: profile.displayName,
        avatarUrl: stored?.avatarUrl || "",
        publicBio: stored?.publicBio || "",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request, true);
    const input = await request.json() as Record<string, unknown>;
    if (input.action !== "update") return response({ code: "UNSUPPORTED_PROFILE_PRESENTATION_ACTION", message: "That Profile presentation action is unavailable." }, 400);

    const current = runtimeState.auth.getAuthStatus(authContext).profile as ProfileSummary;
    const displayName = String(input.displayName || "").trim();
    const nextAvatarUrl = avatarUrl(input.avatarUrl);
    const nextPublicBio = publicBio(input.publicBio);
    const updated = await runtimeState.auth.updateProfilePresentation({
      profileId: current.profileId,
      displayName,
      avatarRef: current.avatarRef,
    }, authContext);
    const presentation: StoredPresentation = {
      version: 1,
      avatarUrl: nextAvatarUrl,
      publicBio: nextPublicBio,
      updatedAt: new Date().toISOString(),
    };
    await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "settings", objectId: PRESENTATION_OBJECT_ID, value: presentation });
    return response({
      profile: {
        displayName: updated.displayName,
        avatarUrl: presentation.avatarUrl,
        publicBio: presentation.publicBio,
      },
      localSaved: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}