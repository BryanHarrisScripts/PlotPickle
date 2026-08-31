import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { getAutonomousGuestAuthority, type AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import type { AuthContext } from "../../core/auth/plotpickle-auth";
import { getProfileExperienceRuntime } from "../../core/auth/profile-experience/profile-experience-runtime";
import type { ProfilePrivateStorageService } from "../../core/storage/profile-private/profile-private-storage";

const PROFILE_SCOPED_API_PREFIXES = [
  "/api/local-buzz",
  "/api/story-workflow/buzz-bridge",
  "/api/story-decisions",
] as const;
const AUTONOMOUS_GUEST_SCOPED_API_PREFIXES = ["/api/story-decisions"] as const;

type ProfileRequestContext = Readonly<{
  authContext: AuthContext;
  profileId: string;
  privateStorage: ProfilePrivateStorageService;
}>;

type AutonomousGuestRequestContext = Readonly<{
  authority: AutonomousGuestAuthority;
}>;

export const profileRequestScope = new AsyncLocalStorage<ProfileRequestContext>();
export const autonomousGuestRequestScope = new AsyncLocalStorage<AutonomousGuestRequestContext>();

function headerRecord(headers: IncomingHttpHeaders) {
  const result: Record<string, string | readonly string[] | undefined> = {};
  for (const [name, value] of Object.entries(headers)) result[name] = value;
  return result;
}

function requestOrigin(request: IncomingMessage) {
  const host = request.headers.host;
  if (!host) throw new Error("PlotPickle rejected a profile-scoped request without a Host header.");
  if (request.headers.origin) return new URL(request.headers.origin).origin;
  const encrypted = Boolean((request.socket as typeof request.socket & { encrypted?: boolean }).encrypted);
  return `${encrypted ? "https" : "http"}://${host}`;
}

function sessionRequest(request: IncomingMessage, origin: string) {
  return {
    method: request.method,
    url: new URL(request.url || "/", origin).toString(),
    headers: headerRecord(request.headers),
    remoteAddress: request.socket.remoteAddress,
    secure: origin.startsWith("https:"),
    socketEncrypted: Boolean((request.socket as typeof request.socket & { encrypted?: boolean }).encrypted),
  };
}

function authorizationCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function rejectionMessage(error: unknown) {
  const code = authorizationCode(error);
  if (code === "CSRF_REJECTED") {
    return "PlotPickle rejected this request because the active Human session proof is missing or expired. Refresh the page or sign in again.";
  }
  const message = error instanceof Error && error.message ? error.message : "";
  return /session|auth|profile|unlock|cookie/i.test(message)
    ? "Unlock a PlotPickle Human profile before using this profile-scoped feature."
    : "PlotPickle could not authorize this request for the active Human profile.";
}

function sendRejected(response: ServerResponse, error: unknown) {
  const authCode = authorizationCode(error);
  const development = process.env.NODE_ENV !== "production";
  response.statusCode = 401;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify({
    ok: false,
    code: "plotpickle-profile-required",
    message: rejectionMessage(error),
    ...(development && authCode ? { authCode } : {}),
    ...(development && error instanceof Error && error.message ? { detail: error.message } : {}),
  }));
}

function requiresProfileScope(pathname: string) {
  return PROFILE_SCOPED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function allowsAutonomousGuestScope(pathname: string) {
  return AUTONOMOUS_GUEST_SCOPED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function currentProfileRequestContext() {
  return profileRequestScope.getStore() ?? null;
}

export function currentAutonomousGuestRequestContext() {
  return autonomousGuestRequestScope.getStore() ?? null;
}

export function profileScopedBuzzRequestContext(): Plugin {
  return {
    name: "plotpickle-profile-scoped-buzz-request-context",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!requiresProfileScope(url.pathname)) { next(); return; }

        void (async () => {
          const origin = requestOrigin(request);
          const runtime = await getProfileExperienceRuntime();
          const autonomousGuest = allowsAutonomousGuestScope(url.pathname)
            ? getAutonomousGuestAuthority(origin, runtime.accessMode)
            : null;
          if (autonomousGuest) {
            autonomousGuestRequestScope.run(Object.freeze({ authority: autonomousGuest }), next);
            return;
          }

          const boundary = runtime.boundaryFor(origin);
          const { authContext } = await boundary.authorizeRequest(sessionRequest(request, origin));
          const profileId = runtime.auth.getAuthStatus(authContext).profile?.profileId;
          if (!profileId) throw new Error("Authenticated Human profile could not be resolved.");
          profileRequestScope.run(Object.freeze({
            authContext,
            profileId,
            privateStorage: runtime.privateStorage,
          }), next);
        })().catch((error) => sendRejected(response, error));
      });
    },
  };
}
