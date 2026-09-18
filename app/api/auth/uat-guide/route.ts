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

const REVIEW_OBJECT_ID = "uat-semantic-review";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
const REVIEW_DECISIONS = new Set(["acknowledge", "needs-review", "continue"]);

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

type HumanReview = {
  runId: string;
  eventKey: string;
  decision: "acknowledge" | "needs-review" | "continue";
  comment: string;
  updatedAt: string;
};

type ReviewState = {
  version: 1;
  records: HumanReview[];
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
      : { code: "UAT_REVIEW_REQUEST_REJECTED", message: error instanceof Error ? error.message : "The UAT Semantic Review request could not be completed." };
  return response(detail, detail.code === "ACCESS_DENIED" ? 403 : 400);
}

async function authorized(request: Request, mutation = false) {
  const url = new URL(request.url);
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)) throw new Error("UAT Semantic Review is available only from the local PlotPickle Node.");
  const runtimeState = await getProfileExperienceRuntime();
  const boundary = runtimeState.boundaryFor(url.origin);
  const { authContext } = await boundary.authorizeRequest(requestBoundary(request), mutation ? { mutation: true } : undefined);
  const profile = runtimeState.auth.getAuthStatus(authContext).profile as ProfileSummary;
  return { runtimeState, authContext, profile, origin: url.origin };
}

function guidePaths(profileId: string) {
  const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const root = path.join(localRoot, "PlotPickle", "uat-guide");
  const profileScope = createHash("sha256").update(profileId).digest("hex").slice(0, 24);
  return {
    root,
    statusFile: path.join(root, "profiles", profileScope, "latest.json"),
    guideScript: path.join(process.cwd(), "scripts", "run-uat-guide.mjs"),
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

function normalizeReviewState(value: unknown): ReviewState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { version: 1, records: [] };
  const source = value as { version?: unknown; records?: unknown };
  const records = Array.isArray(source.records)
    ? source.records.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
      const item = candidate as Partial<HumanReview>;
      if (typeof item.runId !== "string" || typeof item.eventKey !== "string" || !REVIEW_DECISIONS.has(String(item.decision))) return [];
      return [{
        runId: item.runId.slice(0, 180),
        eventKey: item.eventKey.slice(0, 320),
        decision: item.decision as HumanReview["decision"],
        comment: typeof item.comment === "string" ? item.comment.slice(0, 1200) : "",
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
      }];
    }).slice(-100)
    : [];
  return { version: 1, records };
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

function launchGuide({ origin, statusFile }: { origin: string; statusFile: string }) {
  const guideScript = path.join(process.cwd(), "scripts", "run-uat-guide.mjs");
  if (!existsSync(guideScript)) throw new Error("The local UAT Semantic Review runner is unavailable in this PlotPickle build.");

  const runId = `uat-${randomUUID()}`;
  const child = spawn(process.execPath, [
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
  child.unref();
  return runId;
}

export async function GET(request: Request) {
  try {
    const { runtimeState, authContext, profile } = await authorized(request);
    const { statusFile } = guidePaths(profile.profileId);
    const [status, reviewState] = await Promise.all([
      readStatus(statusFile),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: REVIEW_OBJECT_ID }),
    ]);
    return response({
      available: true,
      status,
      reviews: normalizeReviewState(reviewState).records,
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
    const { statusFile } = guidePaths(profile.profileId);

    if (input.action === "review-event") {
      const current = await readStatus(statusFile);
      const runId = typeof input.runId === "string" ? input.runId.trim() : "";
      const eventKey = typeof input.eventKey === "string" ? input.eventKey.trim() : "";
      const decision = typeof input.decision === "string" ? input.decision : "";
      const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 1200) : "";
      if (!current?.runId || current.runId !== runId) return response({ code: "UAT_REVIEW_RUN_MISMATCH", message: "That review item no longer belongs to the current UAT run." }, 409);
      if (!eventKey || eventKey.length > 320 || !REVIEW_DECISIONS.has(decision)) return response({ code: "INVALID_UAT_REVIEW", message: "Choose a valid UAT review response." }, 400);

      const existing = normalizeReviewState(await runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: REVIEW_OBJECT_ID }));
      const record: HumanReview = {
        runId,
        eventKey,
        decision: decision as HumanReview["decision"],
        comment,
        updatedAt: new Date().toISOString(),
      };
      const next: ReviewState = {
        version: 1,
        records: [...existing.records.filter((item) => !(item.runId === runId && item.eventKey === eventKey)), record].slice(-100),
      };
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: REVIEW_OBJECT_ID, value: next });
      return response({ saved: true, review: record, deterministicResultUnchanged: true });
    }

    if (input.action !== "start") return response({ code: "UNSUPPORTED_UAT_REVIEW_ACTION", message: "That UAT Semantic Review action is unavailable." }, 400);

    const current = await readStatus(statusFile);
    if (current?.status === "running" && processAlive(current.pid)) {
      return response({ started: false, runId: current.runId, status: current, message: "UAT Semantic Review is already running." }, 409);
    }

    const runId = launchGuide({ origin, statusFile });
    return response({
      started: true,
      runId,
      message: "UAT Semantic Review started in an isolated synthetic verification session. Live status remains on this page.",
    }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
