import { PlotPickleAuthError, toPublicAuthError, type BrowserSessionSummary, type ProfileSummary } from "../../../../core/auth/plotpickle-auth";
import { PlotPickleServerSessionError, toPublicServerSessionError } from "../../../../core/auth/server-session/server-session-boundary";
import {
  getProfileExperienceRuntime,
  requestBoundary,
  type ProfileExperienceStatus,
} from "../../../../core/auth/profile-experience/profile-experience-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(value: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...headers },
  });
}

function originOf(request: Request) {
  return new URL(request.url).origin;
}

export function publicProfileApiError(error: unknown) {
  if (error instanceof PlotPickleServerSessionError) return toPublicServerSessionError(error);
  if (error instanceof PlotPickleAuthError) return toPublicAuthError(error);
  return { code: "AUTH_REQUEST_REJECTED", message: "The authentication request could not be completed." } as const;
}

function errorResponse(error: unknown) {
  const detail = publicProfileApiError(error);
  const status = detail.code === "AUTHENTICATION_THROTTLED" ? 429 : detail.code === "ACCESS_DENIED" ? 403 : 400;
  return response(
    detail,
    status,
    "retryAfterMs" in detail ? { "Retry-After": String(Math.ceil(Number(detail.retryAfterMs || 1) / 1_000)) } : {},
  );
}

export async function GET(request: Request) {
  try {
    const runtimeState = await getProfileExperienceRuntime();
    const boundary = runtimeState.boundaryFor(originOf(request));
    const publicStatus = runtimeState.auth.getAuthStatus();
    const readiness = boundary.readiness();
    let profile: ProfileSummary | null = null;
    let csrfToken = null;
    let authContext = null;
    let sessions: ReadonlyArray<BrowserSessionSummary> = [];
    try {
      if (!readiness.ready) throw new Error("The server exposure boundary is not ready.");
      authContext = (await boundary.authorizeRequest(requestBoundary(request))).authContext;
      profile = runtimeState.auth.getAuthStatus(authContext).profile as ProfileSummary;
      csrfToken = runtimeState.auth.createBrowserSession(authContext).csrfToken;
      sessions = await boundary.listSessions(requestBoundary(request));
    } catch {
      // An absent, expired or revoked cookie is the normal locked state.
    }
    const result: ProfileExperienceStatus = {
      configured: publicStatus.configured === true,
      authenticated: Boolean(authContext),
      accessMode: runtimeState.accessMode,
      profiles: runtimeState.auth.listProfileSummaries(authContext),
      profile,
      csrfToken,
      sessions,
      serverReady: readiness.ready,
      readinessReasons: readiness.reasons,
    };
    return response(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const runtimeState = await getProfileExperienceRuntime();
    const origin = originOf(request);
    const boundary = runtimeState.boundaryFor(origin);
    const input = await request.json() as Record<string, unknown>;
    const action = typeof input.action === "string" ? input.action : "";

    if (action === "create-first-profile") {
      const created = await boundary.createFirstProfile({
        displayName: String(input.displayName || ""),
        password: String(input.password || ""),
        avatarRef: null,
      }, typeof input.bootstrapProof === "string" ? input.bootstrapProof : undefined, requestBoundary(request));
      const sessionId = created.headers["Set-Cookie"].match(/^(?:__Host-)?ppsid=([^;]+)/u)?.[1];
      if (sessionId) runtimeState.auth.lock(runtimeState.auth.resolveSession(sessionId));
      return response({ profile: created.profile, recoverySecret: created.recoverySecret });
    }

    if (action === "login") {
      const profileId = await runtimeState.locateProfile(String(input.locator || ""));
      const signedIn = await boundary.loginWithPassword({
        profileId: profileId || "profile_AAAAAAAAAAAAAAAAAAAAAA",
        password: String(input.password || ""),
      }, requestBoundary(request));
      return response({ profile: signedIn.profile, csrfToken: signedIn.csrfToken }, 200, { "Set-Cookie": signedIn.headers["Set-Cookie"] });
    }

    if (action === "create-profile") {
      const { authContext } = await boundary.authorizeRequest(requestBoundary(request), { mutation: true });
      const created = await runtimeState.auth.createProfile({
        displayName: String(input.displayName || ""),
        password: String(input.password || ""),
        avatarRef: null,
      }, authContext);
      runtimeState.auth.lock(created.authContext);
      return response({ profile: created.profile, recoverySecret: created.recoverySecret });
    }

    if (action === "change-password") {
      const { authContext } = await boundary.authorizeRequest(requestBoundary(request), { mutation: true, recentReauthentication: true });
      const changed = await runtimeState.auth.changePassword({
        currentPassword: String(input.currentPassword || ""),
        newPassword: String(input.newPassword || ""),
      }, authContext);
      const session = runtimeState.establishSession(changed.authContext, origin);
      return response({ profile: changed.profile, csrfToken: session.csrfToken }, 200, { "Set-Cookie": session.setCookie });
    }

    if (action === "revoke-other-sessions") {
      const count = await boundary.revokeOtherSessions(requestBoundary(request));
      return response({ revoked: count });
    }

    if (action === "logout" || action === "lock" || action === "switch-profile") {
      const loggedOut = await boundary.logout(requestBoundary(request));
      return response({ ok: true }, 200, loggedOut.headers);
    }

    return response({ code: "UNSUPPORTED_AUTH_ACTION", message: "That profile action is unavailable." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
