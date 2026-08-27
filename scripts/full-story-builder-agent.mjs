import process from "node:process";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { attachGeneratedVisual, createFullStoryProject, fullStorySummary } from "../modules/learn/full-story-builder.mjs";
import { mergeLearnProjectWithFullStory } from "../modules/learn/learn-full-story-merge.mjs";
import { agentCompleted, agentLoaded, agentNeedsAttention, agentStatus, keepAgentWindowOpen } from "../lib/agents/agent-window-status.mjs";

const DEFAULT_SERVER = "http://127.0.0.1:4173";
const POLL_MS = 2_000;
const HEARTBEAT_MS = 10_000;

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function cleanServer(value) {
  const url = new URL(value || DEFAULT_SERVER);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Full Story Builder accepts only a local PlotPickle server address.");
  }
  return url.origin;
}

async function jsonRequest(server, pathname, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(`${server}${pathname}`, {
    ...options,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `PlotPickle returned HTTP ${response.status}.`);
  return payload;
}

async function loadLearnProject(server, projectId) {
  return jsonRequest(server, `/api/projects/${encodeURIComponent(projectId)}/learn`);
}

async function saveLearnProject(server, projectId, learnProject) {
  return jsonRequest(server, `/api/projects/${encodeURIComponent(projectId)}/learn`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(learnProject),
  });
}

async function requestVisual(server, projectId, payload) {
  return jsonRequest(server, `/api/projects/${encodeURIComponent(projectId)}/visuals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function buildFullStory(server, projectId, options = {}) {
  const original = await loadLearnProject(server, projectId);
  const fullStory = createFullStoryProject(original, options);
  const merged = mergeLearnProjectWithFullStory(original, fullStory);
  await saveLearnProject(server, projectId, merged);
  return { original, fullStory, merged };
}

async function generateVisuals(server, projectId, fullStory, options = {}) {
  if (!options.visuals) return fullStory;
  let current = fullStory;
  for (const card of current.cards) {
    if (!card.visualPrompt) continue;
    const visual = await requestVisual(server, projectId, {
      prompt: card.visualPrompt,
      purpose: "full-story-builder",
      preferredProvider: options.visualProvider || undefined,
    });
    current = attachGeneratedVisual(current, card.id, visual);
  }
  return current;
}

export async function runFullStoryBuilder(options = {}) {
  const server = cleanServer(options.server || DEFAULT_SERVER);
  const projectId = String(options.projectId || "").trim();
  if (!projectId) throw new Error("Full Story Builder requires --project <project-id>.");

  const label = `Full Story Builder — ${projectId}`;
  agentLoaded(label);
  agentStatus(label, "Building a complete story draft from the current LEARN project.");

  try {
    const { original, fullStory } = await buildFullStory(server, projectId, options);
    const withVisuals = await generateVisuals(server, projectId, fullStory, options);
    const merged = mergeLearnProjectWithFullStory(original, withVisuals);
    await saveLearnProject(server, projectId, merged);
    const summary = fullStorySummary(withVisuals);
    agentCompleted(label, summary);
    return summary;
  } catch (error) {
    agentNeedsAttention(label, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function main() {
  const projectId = argument("--project");
  const server = cleanServer(argument("--server", DEFAULT_SERVER));
  const visuals = process.argv.includes("--visuals");
  const visualProvider = argument("--visual-provider");
  const unattended = process.argv.includes("--unattended");

  await runFullStoryBuilder({ projectId, server, visuals, visualProvider });
  if (!unattended) await keepAgentWindowOpen("Full Story Builder", { pollMs: POLL_MS, heartbeatMs: HEARTBEAT_MS });
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entryUrl === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  });
}
