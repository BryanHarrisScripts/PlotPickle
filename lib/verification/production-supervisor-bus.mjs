import { appendFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const STATES = new Set(["loaded", "waiting", "working", "completed", "needs-attention"]);
const JOB_TYPES = new Set(["audit", "story-build", "ui-continuity", "uat", "integration-readiness", "image", "video", "follow-up"]);

export function supervisorHome(env = process.env) {
  const root = env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(root, "PlotPickle", "supervisor");
}

export function sanitizeEvidence(value) {
  if (typeof value === "string") {
    return value
      .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
      .replace(/(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
  }
  if (Array.isArray(value)) return value.map(sanitizeEvidence);
  if (!value || typeof value !== "object") return value;
  const safe = {};
  for (const [key, child] of Object.entries(value)) {
    if (/(api.?key|token|secret|password|credential|private.?key)/i.test(key)) continue;
    safe[key] = sanitizeEvidence(child);
  }
  return safe;
}

export function normalizeAgentEvent(input = {}) {
  const state = STATES.has(input.state) ? input.state : "needs-attention";
  const event = {
    version: 1,
    timestamp: typeof input.timestamp === "string" && input.timestamp ? input.timestamp : new Date().toISOString(),
    agentId: String(input.agentId || "unknown-agent").slice(0, 100),
    agentVersion: String(input.agentVersion || "1").slice(0, 40),
    state,
    capability: String(input.capability || "unknown").slice(0, 120),
    ready: Boolean(input.ready),
    acceptedJobTypes: Array.isArray(input.acceptedJobTypes) ? input.acceptedJobTypes.filter((item) => JOB_TYPES.has(item)) : [],
    progress: Math.max(0, Math.min(100, Math.round(Number(input.progress) || 0))),
    detail: String(input.detail || "").slice(0, 2_000),
    evidence: sanitizeEvidence(input.evidence || {}),
    proposedJobs: Array.isArray(input.proposedJobs) ? sanitizeEvidence(input.proposedJobs).slice(0, 20) : [],
  };
  return event;
}

export async function publishAgentEvent(input, options = {}) {
  const event = normalizeAgentEvent(input);
  const directory = options.directory || supervisorHome(options.env);
  await mkdir(directory, { recursive: true });
  await appendFile(path.join(directory, "events.ndjson"), `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function readAgentEvents(options = {}) {
  const directory = options.directory || supervisorHome(options.env);
  try {
    const text = await readFile(path.join(directory, "events.ndjson"), "utf8");
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export function latestAgentStates(events = []) {
  const latest = new Map();
  for (const event of events) latest.set(event.agentId, event);
  return [...latest.values()].sort((a, b) => a.agentId.localeCompare(b.agentId));
}

export function supervisorSummary(events = []) {
  const agents = latestAgentStates(events);
  const counts = { loaded: 0, waiting: 0, working: 0, completed: 0, "needs-attention": 0 };
  for (const agent of agents) counts[agent.state] += 1;
  return {
    agents,
    counts,
    needsAttention: agents.filter((agent) => agent.state === "needs-attention"),
    working: agents.filter((agent) => agent.state === "working"),
  };
}
