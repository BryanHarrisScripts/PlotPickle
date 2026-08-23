#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { agentCompleted, agentLoaded, agentNeedsAttention, agentStatus, keepAgentWindowOpen } from "../lib/agent-window-status.mjs";
import { publishAgentEvent } from "../lib/production-supervisor-bus.mjs";
import { buildVideoProductionPlan } from "../lib/video-production.mjs";

const DEFAULT_SERVER = "http://127.0.0.1:4173";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function cleanServer(value) {
  const url = new URL(value || DEFAULT_SERVER);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Video Production Agent accepts only a local PlotPickle server address.");
  }
  return url.origin;
}

async function jsonRequest(server, pathname, fetchImpl = fetch) {
  const response = await fetchImpl(`${server}${pathname}`, { signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `PlotPickle returned HTTP ${response.status}.`);
  return payload;
}

async function latestCompletedProject(server, fetchImpl = fetch) {
  const status = await jsonRequest(server, "/api/full-story-builder/status", fetchImpl);
  const completed = Array.isArray(status.jobs) ? status.jobs.find((job) => job?.status === "completed" && typeof job?.fileName === "string" && job.fileName) : null;
  if (!completed) return { project: null, fileName: "" };
  const fileName = completed.fileName;
  const loaded = await jsonRequest(server, `/api/local-projects/load?file=${encodeURIComponent(fileName)}`, fetchImpl);
  return { project: loaded.project || null, fileName };
}

export async function runAgent({ server = DEFAULT_SERVER, fetchImpl = fetch } = {}) {
  server = cleanServer(server);
  agentLoaded({
    name: "PlotPickle Video Production Agent",
    purpose: "Prepare bounded H3 animatic jobs from approved local story context without silently authorizing paid generation.",
    instructions: "Use PlotPickle Settings to select and test a video route. Paid MiniMax H3 generation remains blocked until the exact per-job authorization is provided through the production workflow.",
    automatic: true,
  });
  await publishAgentEvent({
    agentId: "video-production",
    state: "loaded",
    capability: "video-and-animatic-production",
    ready: true,
    acceptedJobTypes: ["video", "follow-up"],
    detail: "Video Production Agent loaded. Automatic startup never grants paid consent or data-sharing consent.",
  });
  agentStatus("WORKING AUTOMATICALLY", "Checking the newest completed story, first-frame candidate and configured H3 route.");

  const [{ project, fileName }, mediaStatus] = await Promise.all([
    latestCompletedProject(server, fetchImpl),
    jsonRequest(server, "/api/media-routing/status", fetchImpl),
  ]);
  if (!project) {
    const detail = "No completed Full Story Builder project is available yet, so no animatic job can be prepared.";
    await publishAgentEvent({ agentId: "video-production", state: "needs-attention", capability: "video-and-animatic-production", ready: false, acceptedJobTypes: ["video", "follow-up"], progress: 100, detail });
    agentNeedsAttention(detail);
    return 1;
  }

  const plan = buildVideoProductionPlan(mediaStatus, project, {});
  await publishAgentEvent({
    agentId: "video-production",
    state: plan.allowed ? "waiting" : "needs-attention",
    capability: "video-and-animatic-production",
    ready: plan.allowed,
    acceptedJobTypes: ["video", "follow-up"],
    progress: 100,
    detail: plan.reason,
    proposedJobs: [{ type: "video", route: plan.route, fileName, sourceAssetId: plan.sourceAssetId, durationSeconds: plan.durationSeconds, aspectRatio: plan.aspectRatio, prompt: plan.prompt }],
    evidence: { fileName, route: plan.route, sourceAssetId: plan.sourceAssetId, sourceAssetUrl: plan.sourceAssetUrl, requestedCount: plan.requestedCount, fallback: plan.fallback, expectedConsentStatement: plan.expectedConsentStatement },
  });

  if (!plan.allowed) {
    agentNeedsAttention(plan.reason);
    return 1;
  }
  agentCompleted("A bounded H3 animatic job is fully prepared and authorized. Submission remains a separate explicit production action so automatic agent startup cannot create a paid job.");
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  const stayOpen = process.argv.includes("--stay-open");
  runAgent({ server: argument("--server", DEFAULT_SERVER) })
    .then(async (code) => {
      process.exitCode = code;
      if (stayOpen) await keepAgentWindowOpen("Video Production Agent");
    })
    .catch(async (error) => {
      agentNeedsAttention(error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : String(error));
      process.exitCode = 1;
      if (stayOpen) await keepAgentWindowOpen("Video Production Agent");
    });
}
