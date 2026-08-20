import os from "node:os";
import path from "node:path";
import {
  createJsonFileAuthStateStore,
  createPlotPickleAuthService,
  type AuthContext,
  type AuthStateStore,
  type BrowserSessionSummary,
  type PlotPickleAuthService,
  type ProfileSummary,
} from "../plotpickle-auth";
import {
  createServerSessionBoundary,
  type ServerSessionBoundary,
  type SessionRequest,
} from "../server-session/server-session-boundary";

type ProfileExperienceRuntime = {
  readonly auth: PlotPickleAuthService;
  readonly stateStore: AuthStateStore;
  boundaryFor(origin: string): ServerSessionBoundary;
  locateProfile(locator: string): Promise<string | null>;
  establishSession(authContext: AuthContext, origin: string): Readonly<{
    csrfToken: string;
    setCookie: string;
  }>;
};

let runtimePromise: Promise<ProfileExperienceRuntime> | null = null;

function authStatePath() {
  const override = process.env.PLOTPICKLE_AUTH_STATE_PATH?.trim();
  if (override) return path.resolve(override);
  const base = process.env.LOCALAPPDATA?.trim() || process.env.XDG_STATE_HOME?.trim() || path.join(os.homedir(), ".plotpickle");
  return path.join(base, "PlotPickle", "auth", "state.json");
}

function sessionCookie(cookieValue: string, maximumAgeSeconds: number) {
  return `ppsid=${cookieValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maximumAgeSeconds}`;
}

async function createRuntime(): Promise<ProfileExperienceRuntime> {
  const stateStore = createJsonFileAuthStateStore(authStatePath());
  const auth = await createPlotPickleAuthService({
    nodeId: process.env.PLOTPICKLE_NODE_ID?.trim() || "plotpickle-local-node",
    accessMode: "desktop-loopback",
    stateStore,
  });
  const boundaries = new Map<string, ServerSessionBoundary>();

  return Object.freeze({
    auth,
    stateStore,
    boundaryFor(origin: string) {
      const parsed = new URL(origin);
      if (!new Set(["127.0.0.1", "localhost", "[::1]"]).has(parsed.hostname)) {
        throw new Error("The desktop profile experience accepts loopback requests only.");
      }
      const key = parsed.origin;
      let boundary = boundaries.get(key);
      if (!boundary) {
        boundary = createServerSessionBoundary({
          authService: auth,
          exposure: {
            accessMode: "desktop-loopback",
            externalOrigin: key,
            allowedOrigins: [key],
            allowedHosts: [parsed.host],
          },
        });
        boundaries.set(key, boundary);
      }
      return boundary;
    },
    async locateProfile(locator: string) {
      const normalized = locator.trim().toLocaleLowerCase();
      if (!normalized) return null;
      const state = await stateStore.read();
      const matches = Object.values(state?.registry.profiles || {}).filter((profile) => (
        profile.status === "active"
        && (profile.profileId === locator || profile.displayName.toLocaleLowerCase() === normalized)
      ));
      return matches.length === 1 ? matches[0].profileId : null;
    },
    establishSession(authContext: AuthContext, origin: string) {
      const browser = auth.createBrowserSession(authContext, {
        deviceLabel: "PlotPickle browser",
        originLabel: new URL(origin).host,
      });
      return Object.freeze({
        csrfToken: browser.csrfToken,
        setCookie: sessionCookie(browser.cookieValue, Math.max(1, Math.floor((Date.parse(browser.absoluteExpiresAt) - Date.now()) / 1_000))),
      });
    },
  });
}

export function getProfileExperienceRuntime() {
  runtimePromise ??= createRuntime();
  return runtimePromise;
}

export function requestBoundary(request: Request): SessionRequest {
  const url = new URL(request.url);
  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    remoteAddress: url.hostname === "[::1]" ? "::1" : "127.0.0.1",
    secure: url.protocol === "https:",
  };
}

export type ProfileExperienceStatus = {
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly accessMode: "desktop-loopback";
  readonly profiles: ReadonlyArray<ProfileSummary>;
  readonly profile: ProfileSummary | null;
  readonly csrfToken: string | null;
  readonly sessions: ReadonlyArray<BrowserSessionSummary>;
};
