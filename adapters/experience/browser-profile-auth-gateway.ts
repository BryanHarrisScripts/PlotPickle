import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "../../core/storage/project-library-browser";
import {
  hydrateProfilePrivateBrowser,
  migrateLegacyBrowserProjects,
} from "../../core/storage/profile-private-browser";
import type {
  ExperienceAuthGateway,
  ExperienceAuthSnapshot,
  ExperienceHumanProfile,
} from "../../lib/experience/logon-use-case";

type RawProfileStatus = Readonly<{
  configured: boolean;
  authenticated: boolean;
  accessMode: "desktop-loopback" | "server-network";
  profiles: readonly ExperienceHumanProfile[];
  profile: ExperienceHumanProfile | null;
  csrfToken: string | null;
  serverReady: boolean;
  readinessReasons: readonly string[];
}>;

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof body.message === "string" ? body.message : "The PlotPickle profile service is unavailable.");
  }
  return body as T;
}

async function readRawProfileStatus() {
  return json<RawProfileStatus>(await fetch("/api/auth/profile", {
    credentials: "same-origin",
    cache: "no-store",
  }));
}

function safeSnapshot(status: RawProfileStatus): ExperienceAuthSnapshot {
  return {
    configured: status.configured,
    authenticated: status.authenticated,
    accessMode: status.accessMode,
    profiles: status.profiles,
    profile: status.profile,
    serverReady: status.serverReady,
    readinessReasons: status.readinessReasons,
  };
}

export const browserProfileAuthGateway: ExperienceAuthGateway = {
  async read() {
    return safeSnapshot(await readRawProfileStatus());
  },

  async authenticate(locator, credential) {
    const before = await readRawProfileStatus();
    const login = await json<Readonly<{
      profile: ExperienceHumanProfile;
      csrfToken: string;
    }>>(await fetch("/api/auth/profile", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", locator, password: credential }),
    }));

    const token = String(login.csrfToken || "");
    if (!token || !login.profile?.profileId) throw new Error("AUTHENTICATION_SESSION_NOT_ESTABLISHED");

    if (before.accessMode === "desktop-loopback" && before.profiles.length === 1) {
      await migrateLegacyBrowserProjects(token);
    }

    window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, login.profile.profileId);
    await hydrateProfilePrivateBrowser(login.profile.profileId, token);
    return safeSnapshot(await readRawProfileStatus());
  },
};
