import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PlotPickleAuthError, toPublicAuthError, type ProfileSummary } from "../../../../core/auth/plotpickle-auth";
import { PlotPickleServerSessionError, toPublicServerSessionError } from "../../../../core/auth/server-session/server-session-boundary";
import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFERENCE_OBJECT_ID = "uat-guide-preferences";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

type Preference = {
  version: 1;
  enabled: boolean;
  updatedAt: string;
};

type GuideStatus = {
  schemaVersion?: number;
  runId?: string;
  pid?: number;
  status?: "running" | "pass" | "fail";
  startedAt?: string;
  completedAt?: string;
  current?: Record<string, unknown>;
  events?: unknown[];
  evidence?: Record<string, unknown>;
  privacy?: Record<string, unknown>;
};

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function errorResponse(error: unknown) {
  const detail = error instanceof PlotPickleServerSessionError
    ? toPublicServerSessionError(error)
    : error instanceof PlotPickleAuthError
      ? toPublicAuthError(error)
      : { code: "UAT_GUIDE_REQUEST_REJECTED", message: error instanceof Error ? error.message : "The UAT Guide request could not be completed." };
  return response(detail, detail.code === "ACCESS_DENIED" ? 403 : 400);
}

async function authorized(request: Request, mutation = false) {
  const url = new URL(request.url);
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)) throw new Error("UAT Guide is available only from the local PlotPickle Node.");
  const runtimeState = await getProfileExperienceRuntime();
  const boundary = runtimeState.boundaryFor(url.origin);
  const { authContext } = await boundary.authorizeRequest(requestBoundary(request), mutation ? { mutation: true } : undefined);
  const profile = runtimeState.auth.getAuthStatus(authContext).profile as ProfileSummary;
  return { runtimeState, authContext, profile, origin: url.origin };
}

function normalizePreference(value: unknown): Preference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { version: 1, enabled: false, updatedAt: "" };
  const item = value as Partial<Preference>;
  return {
    version: 1,
    enabled: item.version === 1 && item.enabled === true,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

function guidePaths(profileId: string) {
  const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const root = path.join(localRoot, "PlotPickle", "uat-guide");
  const profileScope = createHash("sha256").update(profileId).digest("hex").slice(0, 24);
  return {
    root,
    statusFile: path.join(root, "profiles", profileScope, "latest.json"),
    guideScript: path.join(process.cwd(), "scripts", "run-uat-guide.mjs"),
    windowScript: path.join(process.cwd(), "scripts", "start-uat-guide-window.ps1"),
  };
}

async function readStatus(statusFile: string): Promise<GuideStatus | null> {
  try {
    const value = JSON.parse(await readFile(statusFile, "utf8")) as GuideStatus;
    if (!value || value.schemaVersion !== 1 || typeof value.runId !== "string") return null;
    return value;
  } catch {
    return null;
  }
}

function processAlive(pid: unknown) {
  if (!Number.isInteger(pid) || Number(pid) <= 0) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function launchGuide({ origin, statusFile, mirrorWindows }: { origin: string; statusFile: string; mirrorWindows: boolean }) {
  const { guideScript, windowScript } = guidePaths("launcher-placeholder");
  if (!existsSync(guideScript)) throw new Error("The local UAT Guide runner is unavailable in this PlotPickle build.");

  const runId = `uat-${randomUUID()}`;
  let child;
  if (process.platform === "win32" && mirrorWindows && existsSync(windowScript)) {
    child = spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", windowScript,
      "-Node", process.execPath,
      "-Script", guideScript,
      "-Server", origin,
      "-RunId", runId,
      "-StatusFile", statusFile,
    ], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      shell: false,
    });
  } else {
    child = spawn(process.execPath, [
      guideScript,
      "--server", origin,
      "--run-id", runId,
      "--status-file", statusFile,
    ], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
  }
  child.unref();
  return runId;
}

export async function GET(request: Request) {
  try {
    const { runtimeState, authContext, profile } = await authorized(request);
    const preference = normalizePreference(await runtimeState.privateStorage.readPrivateJson(authContext, { domain: "settings", objectId: PREFERENCE_OBJECT_ID }));
    const { statusFile } = guidePaths(profile.profileId);
    const status = await readStatus(statusFile);
    return response({
      enabled: preference.enabled,
      status,
      canMirrorWindows: process.platform === "win32",
      isolation: "synthetic-human",
      providerSpendAllowed: false,
      verificationInbox: "/verification-inbox",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { runtimeState, authContext, profile, origin } = await authorized(request, true);
    const input = await request.json() as Record<string, unknown>;

    if (input.action === "set-enabled") {
      const preference: Preference = {
        version: 1,
        enabled: input.enabled === true,
        updatedAt: new Date().toISOString(),
      };
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "settings", objectId: PREFERENCE_OBJECT_ID, value: preference });
      return response({ enabled: preference.enabled, saved: true });
    }

    if (input.action !== "start") return response({ code: "UNSUPPORTED_UAT_GUIDE_ACTION", message: "That UAT Guide action is unavailable." }, 400);

    const preference = normalizePreference(await runtimeState.privateStorage.readPrivateJson(authContext, { domain: "settings", objectId: PREFERENCE_OBJECT_ID }));
    if (!preference.enabled) return response({ code: "UAT_GUIDE_OPT_IN_REQUIRED", message: "Enable UAT tools in Settings before starting the UAT Guide." }, 403);

    const { statusFile } = guidePaths(profile.profileId);
    const current = await readStatus(statusFile);
    if (current?.status === "running" && processAlive(current.pid)) {
      return response({ started: false, runId: current.runId, status: current, message: "The UAT Guide is already running." }, 409);
    }

    const runId = launchGuide({ origin, statusFile, mirrorWindows: input.mirrorWindows === true });
    return response({
      started: true,
      runId,
      message: input.mirrorWindows === true && process.platform === "win32"
        ? "UAT Guide started in an isolated synthetic session and mirrored to a Windows status window."
        : "UAT Guide started in an isolated synthetic session.",
    }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
