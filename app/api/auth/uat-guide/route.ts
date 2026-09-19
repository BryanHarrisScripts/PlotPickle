import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PlotPickleAuthError, toPublicAuthError, type ProfileSummary } from "../../../../core/auth/plotpickle-auth";
import { PlotPickleServerSessionError, toPublicServerSessionError } from "../../../../core/auth/server-session/server-session-boundary";
import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import {
  REVIEW_STAGE_FEEDBACK_STATES,
  createReviewStageFeedback,
  deliverReviewStageFeedback,
  projectDeveloperReviewStage,
  queueReviewStageFeedback,
  reviewStageFeedbackInbox,
  type ReviewStageFeedback,
} from "../../../../lib/review-stage";

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
  events?: Array<Record<string, unknown>>;
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
  feedback: ReviewStageFeedback[];
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
  if (!value || typeof value !== "object" || Array.isArray(value)) return { version: 1, records: [], feedback: [] };
  const source = value as { version?: unknown; records?: unknown; feedback?: unknown };
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
  const feedbackStates = new Set<string>(REVIEW_STAGE_FEEDBACK_STATES);
  const feedback = Array.isArray(source.feedback)
    ? source.feedback.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
      const item = candidate as Partial<ReviewStageFeedback>;
      if (
        item.version !== 1
        || typeof item.feedbackId !== "string"
        || typeof item.sessionId !== "string"
        || typeof item.itemId !== "string"
        || typeof item.targetAgentId !== "string"
        || typeof item.actorId !== "string"
        || !feedbackStates.has(String(item.state))
      ) return [];
      return [{
        version: 1 as const,
        feedbackId: item.feedbackId.slice(0, 220),
        sessionId: item.sessionId.slice(0, 180),
        itemId: item.itemId.slice(0, 320),
        targetAgentId: item.targetAgentId.slice(0, 180),
        actorId: item.actorId.slice(0, 180),
        decision: typeof item.decision === "string" ? item.decision.slice(0, 120) : "",
        body: typeof item.body === "string" ? item.body.slice(0, 2400) : "",
        state: item.state as ReviewStageFeedback["state"],
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
        deliveredAt: typeof item.deliveredAt === "string" ? item.deliveredAt : "",
        acknowledgedAt: typeof item.acknowledgedAt === "string" ? item.acknowledgedAt : "",
        actedOnAt: typeof item.actedOnAt === "string" ? item.actedOnAt : "",
        answeredAt: typeof item.answeredAt === "string" ? item.answeredAt : "",
        resolvedAt: typeof item.resolvedAt === "string" ? item.resolvedAt : "",
        agentReply: typeof item.agentReply === "string" ? item.agentReply.slice(0, 2400) : "",
      }];
    }).slice(-500)
    : [];
  return { version: 1, records, feedback };
}

function guideEventKey(runId: string, event: Record<string, unknown>) {
  const value = [
    runId || "run",
    typeof event.at === "string" ? event.at : "time",
    typeof event.surface === "string" ? event.surface : "surface",
    typeof event.label === "string" ? event.label : "event",
  ].join("|");
  return value.slice(0, 320);
}

function developerReviewStage(status: GuideStatus | null, reviewState: ReviewState) {
  if (!status?.runId) return null;
  const events = (status.events ?? []).map((event) => ({
    key: guideEventKey(status.runId as string, event),
    label: typeof event.label === "string" ? event.label : "UAT event",
    result: typeof event.state === "string" ? event.state : "RUNNING",
    summary: typeof event.detail === "string" ? event.detail : "",
    evidenceRef: typeof event.surface === "string" ? event.surface : "uat",
    sourceRevision: status.runId as string,
    capturedAt: typeof event.at === "string" ? event.at : status.startedAt,
  }));
  return projectDeveloperReviewStage({
    sessionId: status.runId,
    title: "UAT Semantic Review",
    buildRef: status.runId,
    sourceRevision: status.runId,
    targetAgentId: "bram-gatewick",
    events,
    reviews: reviewState.records.map((review) => ({
      eventKey: review.eventKey,
      decision: review.decision,
      comment: review.comment,
      updatedAt: review.updatedAt,
    })),
    createdAt: status.startedAt,
  });
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
    const normalizedReviewState = normalizeReviewState(reviewState);
    return response({
      available: true,
      status,
      reviews: normalizedReviewState.records,
      reviewStage: developerReviewStage(status, normalizedReviewState),
      reviewStageFeedback: normalizedReviewState.feedback,
      agentFeedbackInbox: reviewStageFeedbackInbox(normalizedReviewState.feedback, "bram-gatewick"),
      isolation: "synthetic-human",
      providerSpendAllowed: false,
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
      const updatedAt = new Date().toISOString();
      const record: HumanReview = {
        runId,
        eventKey,
        decision: decision as HumanReview["decision"],
        comment,
        updatedAt,
      };
      const feedbackId = `uat-review:${createHash("sha256").update(`${runId}\n${eventKey}\n${decision}\n${comment}`).digest("hex").slice(0, 24)}`;
      const existingFeedback = existing.feedback.find((item) => item.feedbackId === feedbackId);
      const reviewStageFeedback = existingFeedback ?? deliverReviewStageFeedback(
        queueReviewStageFeedback(createReviewStageFeedback({
          feedbackId,
          sessionId: runId,
          itemId: eventKey,
          targetAgentId: "bram-gatewick",
          actorId: profile.profileId,
          decision,
          body: comment,
          createdAt: updatedAt,
        })),
        "bram-gatewick",
        updatedAt,
      );
      const next: ReviewState = {
        version: 1,
        records: [...existing.records.filter((item) => !(item.runId === runId && item.eventKey === eventKey)), record].slice(-100),
        feedback: [...existing.feedback.filter((item) => item.feedbackId !== feedbackId), reviewStageFeedback].slice(-500),
      };
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: REVIEW_OBJECT_ID, value: next });
      return response({ saved: true, review: record, reviewStageFeedback, deterministicResultUnchanged: true });
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
