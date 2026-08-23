#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { agentCompleted, agentLoaded, agentNeedsAttention, agentStatus, keepAgentWindowOpen } from "../lib/agent-window-status.mjs";
import { publishAgentEvent } from "../lib/production-supervisor-bus.mjs";
import { processLatestFullStoryVisuals } from "../lib/visual-production-agent.mjs";

const DEFAULT_SERVER = "http://127.0.0.1:4173";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function cleanServer(value) {
  const url = new URL(value || DEFAULT_SERVER);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Visual Production Agent accepts only a local PlotPickle server address.");
  }
  return url.origin;
}

export async function runAgent({ server = DEFAULT_SERVER, fetchImpl = fetch } = {}) {
  server = cleanServer(server);
  agentLoaded({
    name: "PlotPickle Visual Production Agent",
    purpose: "Create missing poster/key-art and story-image candidates through the image route already selected in Settings.",
    instructions: "No prompt entry is required here. Local ComfyUI may run automatically when it is already enabled and ready. Paid cloud image requests are never submitted without exact per-job consent.",
    automatic: true,
  });
  await publishAgentEvent({
    agentId: "visual-production",
    state: "loaded",
    capability: "poster-and-image-production",
    ready: true,
    acceptedJobTypes: ["image", "follow-up"],
    detail: "Visual Production Agent loaded. Generated media remains an unreviewed candidate until a person approves it.",
  });
  agentStatus("WORKING AUTOMATICALLY", "Checking the newest completed Full Story Builder project and the active image route.");
  const result = await processLatestFullStoryVisuals(server, { poster: true, storyVisualCount: 1 }, fetchImpl);

  if (!result.changed && result.reason === "Poster and requested story visuals are already present.") {
    await publishAgentEvent({
      agentId: "visual-production",
      state: "completed",
      capability: "poster-and-image-production",
      ready: true,
      acceptedJobTypes: ["image", "follow-up"],
      progress: 100,
      detail: `Poster/key-art and requested story-image coverage are already present in ${result.fileName}. Existing candidates remain subject to human review.`,
      evidence: { fileName: result.fileName, projectId: result.projectId, reason: result.reason },
    });
    agentCompleted(`Poster/key-art and requested story-image coverage are already present in ${result.fileName}. Nothing was approved as canon.`);
    return 0;
  }

  if (result.changed) {
    const posterCount = result.generated.filter((item) => item.kind === "poster").length;
    const storyCount = result.generated.filter((item) => item.kind === "story-visual").length;
    await publishAgentEvent({
      agentId: "visual-production",
      state: result.failed.length ? "needs-attention" : "completed",
      capability: "poster-and-image-production",
      ready: result.failed.length === 0,
      acceptedJobTypes: ["image", "follow-up"],
      progress: 100,
      detail: `Saved ${posterCount} poster candidate and ${storyCount} story visual candidate${storyCount === 1 ? "" : "s"} to ${result.fileName}. Human review is still required.`,
      evidence: { fileName: result.fileName, projectId: result.projectId, route: result.plan.route, generated: result.generated, failed: result.failed },
    });
    if (result.failed.length) {
      agentNeedsAttention(`Saved the successful visual candidates, but ${result.failed.length} requested image job${result.failed.length === 1 ? "" : "s"} needs attention. Prompts and recovery actions were preserved.`);
      return 1;
    }
    agentCompleted(`Saved poster/key-art and story-image candidates to ${result.fileName}. They are candidates only; nothing was approved as canon.`);
    return 0;
  }

  await publishAgentEvent({
    agentId: "visual-production",
    state: "needs-attention",
    capability: "poster-and-image-production",
    ready: false,
    acceptedJobTypes: ["image", "follow-up"],
    progress: 100,
    detail: result.reason || "Visual production is waiting for a ready image route or completed story project.",
    evidence: { reason: result.reason || "", fileName: result.fileName || "", plan: result.plan || {} },
  });
  agentNeedsAttention(result.reason || "Visual production is waiting for a ready image route or completed story project.");
  return 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  const stayOpen = process.argv.includes("--stay-open");
  runAgent({ server: argument("--server", DEFAULT_SERVER) })
    .then(async (code) => {
      process.exitCode = code;
      if (stayOpen) await keepAgentWindowOpen("Visual Production Agent");
    })
    .catch(async (error) => {
      agentNeedsAttention(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      if (stayOpen) await keepAgentWindowOpen("Visual Production Agent");
    });
}
