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
  type ServerExposureInput,
  type ServerSessionBoundary,
  type SessionRequest,
} from "../server-session/server-session-boundary";
import { normalizeFoundationProject } from "../../project/project";
import {
  createProfilePrivateStorageService,
  type ProfilePrivateStorageService,
} from "../../storage/profile-private/profile-private-storage";

type ProfileExperienceRuntime = {
  readonly auth: PlotPickleAuthService;
  readonly stateStore: AuthStateStore;
  readonly accessMode: "desktop-loopback" | "server-network";
  readonly home: string;
  readonly privateStorage: ProfilePrivateStorageService;
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
  const home = process.env.PLOTPICKLE_HOME?.trim();
  if (home) return path.join(path.resolve(home), "auth", "state.json");
  const base = process.env.LOCALAPPDATA?.trim() || process.env.XDG_STATE_HOME?.trim() || path.join(os.homedir(), ".plotpickle");
  return path.join(base, "PlotPickle", "auth", "state.json");
}

function persistentHome() {
  const override = process.env.PLOTPICKLE_HOME?.trim();
  if (override) return path.resolve(override);
  const base = process.env.LOCALAPPDATA?.trim() || process.env.XDG_STATE_HOME?.trim() || path.join(os.homedir(), ".plotpickle");
  return path.join(base, "PlotPickle");
}

function commaList(value: string | undefined) {
  return Object.freeze((value || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function accessMode() {
  if (process.env.PLOTPICKLE_ACCESS_MODE?.trim() !== "server-network") return "desktop-loopback" as const;
  const bindHost = process.env.PLOTPICKLE_BIND_HOST?.trim() || "";
  const externalOrigin = process.env.PLOTPICKLE_EXTERNAL_ORIGIN?.trim() || "";
  const explicitlyEnabled = enabled(process.env.PLOTPICKLE_SERVER_NETWORK_ENABLED);
  const hasNetworkIntent = Boolean(bindHost && externalOrigin && explicitlyEnabled);
  return hasNetworkIntent ? "server-network" as const : "desktop-loopback" as const;
}

function serverExposure(): ServerExposureInput {
  return {
    accessMode: "server-network",
    bindHost: process.env.PLOTPICKLE_BIND_HOST?.trim(),
    externalOrigin: process.env.PLOTPICKLE_EXTERNAL_ORIGIN?.trim(),
    allowedOrigins: commaList(process.env.PLOTPICKLE_ALLOWED_ORIGINS),
    allowedHosts: commaList(process.env.PLOTPICKLE_ALLOWED_HOSTS),
    serverNetworkEnabled: enabled(process.env.PLOTPICKLE_SERVER_NETWORK_ENABLED),
    tlsMode: process.env.PLOTPICKLE_TLS_MODE?.trim() === "trusted-proxy" ? "trusted-proxy" : process.env.PLOTPICKLE_TLS_MODE?.trim() === "direct" ? "direct" : undefined,
    trustedProxyAddresses: commaList(process.env.PLOTPICKLE_TRUSTED_PROXY_ADDRESSES),
    bootstrapComplete: enabled(process.env.PLOTPICKLE_BOOTSTRAP_COMPLETE),
    enableHsts: enabled(process.env.PLOTPICKLE_ENABLE_HSTS),
  };
}

function sessionCookie(cookieValue: string, maximumAgeSeconds: number, mode: "desktop-loopback" | "server-network") {
  const name = mode === "server-network" ? "__Host-ppsid" : "ppsid";
  return `${name}=${cookieValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maximumAgeSeconds}${mode === "server-network" ? "; Secure" : ""}`;
}

async function createRuntime(): Promise<ProfileExperienceRuntime> {
  const stateStore = createJsonFileAuthStateStore(authStatePath());
  const mode = accessMode();
  const home = persistentHome();
  const auth = await createPlotPickleAuthService({
    nodeId: process.env.PLOTPICKLE_NODE_ID?.trim() || "plotpickle-local-node",
    accessMode: mode,
    stateStore,
  });
  const privateStorage = createProfilePrivateStorageService({
    root: home,
    authService: auth,
    normalizeProject: normalizeFoundationProject,
  });
  const boundaries = new Map<string, ServerSessionBoundary>();

  return Object.freeze({
    auth,
    stateStore,
    accessMode: mode,
    home,
    privateStorage,
    boundaryFor(origin: string) {
      const parsed = new URL(origin);
      if (mode === "desktop-loopback" && !new Set(["127.0.0.1", "localhost", "[::1]"]).has(parsed.hostname)) {
        throw new Error("The desktop profile experience accepts loopback requests only.");
      }
      const exposure: ServerExposureInput = mode === "desktop-loopback" ? {
        accessMode: mode,
        externalOrigin: parsed.origin,
        allowedOrigins: [parsed.origin],
        allowedHosts: [parsed.host],
      } : serverExposure();
      const key = mode === "desktop-loopback" ? parsed.origin : "server-network";
      let boundary = boundaries.get(key);
      if (!boundary) {
        boundary = createServerSessionBoundary({
          authService: auth,
          exposure,
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
        setCookie: sessionCookie(browser.cookieValue, Math.max(1, Math.floor((Date.parse(browser.absoluteExpiresAt) - Date.now()) / 1_000)), mode),
      });
    },
  });
}

export function getProfileExperienceRuntime() {
  runtimePromise ??= createRuntime();
  return runtimePromise;
}

export async function resetProfileExperienceRuntime() {
  const currentPromise = runtimePromise;
  runtimePromise = null;
  if (!currentPromise) return false;
  try {
    const current = await currentPromise;
    current.privateStorage.close();
    current.auth.close();
  } catch {
    // A failed runtime creation has no live private state to close.
  }
  return true;
}

export function requestBoundary(request: Request): SessionRequest {
  const url = new URL(request.url);
  const trustedPeer = process.env.PLOTPICKLE_IMMEDIATE_PEER_ADDRESS?.trim();
  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    remoteAddress: accessMode() === "desktop-loopback" ? (url.hostname === "[::1]" ? "::1" : "127.0.0.1") : trustedPeer,
    secure: url.protocol === "https:",
  };
}

export type ProfileExperienceStatus = {
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly accessMode: "desktop-loopback" | "server-network";
  readonly profiles: ReadonlyArray<ProfileSummary>;
  readonly profile: ProfileSummary | null;
  readonly csrfToken: string | null;
  readonly sessions: ReadonlyArray<BrowserSessionSummary>;
  readonly serverReady: boolean;
  readonly readinessReasons: ReadonlyArray<string>;
};
