#!/usr/bin/env node

import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { agentCompleted, agentLoaded, agentNeedsAttention, agentStatus, keepAgentWindowOpen } from "../lib/agents/agent-window-status.mjs";
import { publishAgentEvent, readAgentEvents, supervisorSummary } from "../lib/verification/production-supervisor-bus.mjs";
import { PRODUCTION_SUPERVISOR_WORKERS } from "../lib/agents/production-supervisor-workers.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
};
const server = new URL(argument("--server", "http://127.0.0.1:4173"));
if (server.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(server.hostname)) {
  throw new Error("Production Supervisor accepts only a local PlotPickle server address.");
}

const registry = PRODUCTION_SUPERVISOR_WORKERS;

async function exists(relativePath) {
  return access(path.join(repoRoot, relativePath)).then(
    () => true,
    (error) => {
      // An absent optional worker is an honest readiness result. Permission,
      // disk and other filesystem faults must not be misreported as "missing".
      if (error?.code === "ENOENT") return false;
      throw error;
    },
  );
}

async function discoverAgents() {
  const discovered = [];
  for (const item of registry) {
    const installed = await exists(item.script);
    const event = await publishAgentEvent({
      agentId: item.agentId,
      agentVersion: "1",
      state: installed ? "loaded" : "needs-attention",
      capability: item.capability,
      ready: installed,
      acceptedJobTypes: item.acceptedJobTypes,
      progress: 0,
      detail: installed ? `Discovered ${item.script}.` : `Missing ${item.script}.`,
      evidence: { script: item.script, installed },
    });
    discovered.push(event);
  }
  return discovered;
}

async function builderHealth() {
  try {
    const response = await fetch(`${server.origin}/api/full-story-builder/status`, { signal: AbortSignal.timeout(3_000) });
    const payload = await response.json().catch(() => ({}));
    return { reachable: response.ok, worker: Boolean(payload.worker) };
  } catch {
    return { reachable: false, worker: false };
  }
}

export async function runSupervisor({ once = false } = {}) {
  agentLoaded({
    name: "PlotPickle Production Supervisor",
    purpose: "Coordinate local companion agents and report what is complete, missing, blocked or awaiting a human decision.",
    instructions: "No instructions are required to start. Use PlotPickle normally; the supervisor reports agent readiness and evidence without approving canon or paid work.",
    automatic: true,
  });
  await publishAgentEvent({
    agentId: "production-supervisor",
    state: "loaded",
    capability: "coordination",
    ready: true,
    acceptedJobTypes: ["audit", "follow-up", "integration-readiness", "image", "video"],
    detail: "Supervisor loaded with local-only coordination bus.",
  });
  agentStatus("WORKING AUTOMATICALLY", "Discovering local agents and collecting evidence.");
  await discoverAgents();
  const health = await builderHealth();
  await publishAgentEvent({
    agentId: "full-story-builder",
    state: health.worker ? "waiting" : health.reachable ? "loaded" : "needs-attention",
    capability: "story-build",
    ready: health.worker,
    acceptedJobTypes: ["story-build", "follow-up"],
    progress: 0,
    detail: health.worker ? "Worker is registered and waiting for Learn instructions." : health.reachable ? "PlotPickle is reachable but the story worker is not registered yet." : "PlotPickle or the story-builder status endpoint is not reachable yet.",
    evidence: health,
  });
  const events = await readAgentEvents();
  const summary = supervisorSummary(events);
  process.stdout.write(`\nAgents discovered: ${summary.agents.length}\n`);
  for (const item of summary.agents) process.stdout.write(`- ${item.agentId}: ${item.state}${item.detail ? ` - ${item.detail}` : ""}\n`);
  if (summary.needsAttention.length) {
    agentNeedsAttention(`${summary.needsAttention.length} agent state${summary.needsAttention.length === 1 ? "" : "s"} need attention. The supervisor will not mark the production complete while blockers remain.`);
  } else {
    agentCompleted("All currently discovered agent states are available for coordination. Production completeness is still decided by the full project audit, not agent availability alone.");
  }
  await publishAgentEvent({
    agentId: "production-supervisor",
    state: summary.needsAttention.length ? "needs-attention" : "waiting",
    capability: "coordination",
    ready: summary.needsAttention.length === 0,
    acceptedJobTypes: ["audit", "follow-up", "integration-readiness", "image", "video"],
    progress: 100,
    detail: summary.needsAttention.length ? "Waiting for local agent readiness issues to be resolved." : "Waiting for the next project or follow-up audit.",
    evidence: { agentCount: summary.agents.length, needsAttention: summary.needsAttention.map((item) => item.agentId) },
  });
  return summary.needsAttention.length ? 1 : 0;
}

const stayOpen = argv.includes("--stay-open");
runSupervisor({ once: argv.includes("--once") }).then(async (code) => {
  process.exitCode = code;
  if (stayOpen) await keepAgentWindowOpen("Production Supervisor");
}).catch(async (error) => {
  agentNeedsAttention(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
  if (stayOpen) await keepAgentWindowOpen("Production Supervisor");
});
