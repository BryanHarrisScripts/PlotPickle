import process from "node:process";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { attachGeneratedVisual, createFullStoryProject, fullStorySummary } from "../lib/full-story-builder.mjs";
import { mergeLearnProjectWithFullStory } from "../lib/learn-full-story-merge.mjs";
import { agentCompleted, agentLoaded, agentNeedsAttention, agentStatus, keepAgentWindowOpen } from "../lib/agent-window-status.mjs";

const DEFAULT_SERVER = "http://127.0.0.1:4173";
const POLL_MS = 2_000;
const HEARTBEAT_MS = 10_000;

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function cleanServer(value) {
  const url = new URL(value || DEFAULT_SERVER);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Full Story Builder accepts only a local PlotPickle server address.");
  return url.origin;
}

function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function jsonRequest(server, pathname, method = "GET", body, fetchImpl = fetch) {
  const response = await fetchImpl(`${server}${pathname}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(method === "GET" ? 15_000 : 180_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `PlotPickle returned HTTP ${response.status}.`);
  return payload;
}

function safeFileName(title) {
  const stem = String(title || "untitled-story").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${stem || "untitled-story"}.ppf`;
}

export function visualRequestPlan(mediaStatus, options) {
  const route = mediaStatus && typeof mediaStatus.imageRoute === "string" ? mediaStatus.imageRoute : "manual";
  const maximum = Math.min(4, Math.max(0, Math.round(Number(options?.maximumVisuals) || 0)));
  if (options?.visualMode === "prompts-only" || maximum === 0) return { route, maximum: 0, allowed: false, reason: "Visual prompts only was selected." };
  if (route === "comfyui") {
    const ready = Boolean(mediaStatus?.comfyui?.reachable && (mediaStatus?.comfyui?.imageNodesReady ?? true));
    return { route, maximum: ready ? maximum : 0, allowed: ready, reason: ready ? "Local ComfyUI is ready." : "Local ComfyUI is not ready; visual prompts remain attached." };
  }
  if (route === "openai" || route === "minimax") {
    const consent = options?.paidVisualConsent;
    const valid = options?.visualMode === "paid-cloud" && consent?.acknowledged === true && Number(consent.maximumRequests) === maximum && consent.statement === `I authorize up to ${maximum} paid image requests for this Full Story Builder job.`;
    return { route, maximum: valid ? maximum : 0, allowed: valid, reason: valid ? "The user explicitly authorized this capped paid visual job." : "The configured image route may charge money, so it was skipped without exact per-job consent." };
  }
  return { route, maximum: 0, allowed: false, reason: "The configured image route is manual or unavailable; visual prompts remain attached." };
}

async function generateVisuals(server, project, options, fetchImpl = fetch) {
  const warnings = [];
  let status;
  try { status = await jsonRequest(server, "/api/media-routing/status", "GET", undefined, fetchImpl); }
  catch (error) {
    warnings.push(error instanceof Error ? `Visual route check skipped: ${error.message}` : "Visual route check skipped.");
    return { attempts: 0, attached: 0, route: "unavailable", warnings };
  }
  const plan = visualRequestPlan(status, options);
  if (!plan.allowed) {
    if (options?.visualMode !== "prompts-only") warnings.push(plan.reason);
    return { attempts: 0, attached: 0, route: plan.route, warnings };
  }
  const targets = [{ blockNumber: 1, miniBlockNumber: 1 }, { blockNumber: 6, miniBlockNumber: 4 }, { blockNumber: 12, miniBlockNumber: 4 }, { blockNumber: 24, miniBlockNumber: 4 }].slice(0, plan.maximum);
  let attached = 0;
  for (const target of targets) {
    const frame = project.blocks[target.blockNumber - 1].visuals.find((item) => item.miniBlockNumber === target.miniBlockNumber);
    try {
      const result = await jsonRequest(server, "/api/local-ai/generate/image", "POST", {
        prompt: frame.prompt,
        assetId: `full-story-${project.id}-${target.blockNumber}-${target.miniBlockNumber}`,
        aspect: "landscape",
        quality: "low",
        requestCount: 1,
        billingAcknowledged: plan.route === "openai" || plan.route === "minimax",
      }, fetchImpl);
      if (attachGeneratedVisual(project, { blockNumber: target.blockNumber, miniBlockNumber: target.miniBlockNumber, assetUrl: result.assetUrl, route: result.route || plan.route, provider: result.provider, model: result.model, createdAt: new Date().toISOString() })) attached += 1;
      else warnings.push(`The visual returned for Block ${target.blockNumber}.${target.miniBlockNumber} had no attachable local asset.`);
    } catch (error) {
      warnings.push(`Block ${target.blockNumber}.${target.miniBlockNumber} visual was skipped: ${error instanceof Error ? error.message : "generation failed"}`);
    }
  }
  return { attempts: targets.length, attached, route: plan.route, warnings };
}

async function updateJob(server, job, action, content, fetchImpl = fetch) {
  return jsonRequest(server, `/api/full-story-builder/jobs/${encodeURIComponent(job.id)}/${action}`, "POST", { workerId: job.workerId, workToken: job.workToken, ...content }, fetchImpl);
}

export async function processClaimedJob(server, claimed, workerId, fetchImpl = fetch) {
  const job = { ...claimed, workerId };
  const warnings = [];
  try {
    await updateJob(server, job, "progress", { progress: 12, stage: "Continuing the active Learn story without discarding entered material" }, fetchImpl);
    const generated = createFullStoryProject(job.brief, { jobId: job.id, now: new Date().toISOString() });
    let project = generated;
    const sourceFileName = typeof job.brief?.sourceFileName === "string" ? job.brief.sourceFileName : "";
    if (sourceFileName) {
      const loaded = await jsonRequest(server, `/api/local-projects/load?file=${encodeURIComponent(sourceFileName)}`, "GET", undefined, fetchImpl);
      if (!loaded.project || typeof loaded.project !== "object") throw new Error("The active Learn project could not be reloaded for continuation.");
      project = mergeLearnProjectWithFullStory(generated, loaded.project, { sourceFileName, now: new Date().toISOString() });
      warnings.push("Continued the same Learn project and preserved its existing story, character, world and learning material.");
    }
    await updateJob(server, job, "progress", { progress: 68, stage: "Completed missing 24 Blocks, 96 mini-blocks and screenplay material around the existing story" }, fetchImpl);

    const visuals = await generateVisuals(server, project, job.options, fetchImpl);
    warnings.push(...visuals.warnings);
    const builder = project.extensions.fullStoryBuilder;
    builder.visualRoute = visuals.route;
    builder.visualAttempts = visuals.attempts;
    builder.visualsAttached = visuals.attached;
    await updateJob(server, job, "progress", { progress: 88, stage: visuals.attached ? `Attached ${visuals.attached} generated visual candidates to the same story` : "Preserved all visual prompts on the same archived story", warnings }, fetchImpl);

    const fileName = sourceFileName || safeFileName(project.metadata.title);
    const saved = await jsonRequest(server, "/api/local-projects/save", "POST", { project, fileName, createRollingBackup: true }, fetchImpl);
    const savedFileName = typeof saved.fileName === "string" && saved.fileName ? saved.fileName : fileName;
    const result = { ...fullStorySummary(project), archived: true, continuedProjectId: project.id };
    await updateJob(server, job, "complete", { fileName: savedFileName, result, warnings }, fetchImpl);
    return { ok: true, fileName: savedFileName, result, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : "The Full Story Builder agent stopped unexpectedly.";
    try { await updateJob(server, job, "fail", { error: message, warnings }, fetchImpl); } catch { }
    return { ok: false, error: message, warnings };
  }
}

export async function runAgent({ server = DEFAULT_SERVER, once = false, fetchImpl = fetch } = {}) {
  server = cleanServer(server);
  const workerId = `full-story-builder-${os.hostname()}-${process.pid}`;
  let wasReady = false;
  let unavailableSince = 0;
  let nextHeartbeat = 0;
  agentLoaded({
    name: "PlotPickle Full Story Builder",
    purpose: "Continue the active Learn story into a complete local 120-page-target project across 24 Blocks and 96 mini-blocks.",
    instructions: "In PlotPickle, develop your story in Learn > Full Story Builder, then complete that same story and save it into the local Story Archive.",
  });
  process.stdout.write(`Local server: ${server}\n`);
  process.stdout.write("Cloud text generation is disabled. Paid visuals require exact per-job consent.\n\n");
  while (true) {
    try {
      const now = Date.now();
      if (now >= nextHeartbeat) {
        await jsonRequest(server, "/api/full-story-builder/worker/heartbeat", "POST", { workerId }, fetchImpl);
        nextHeartbeat = now + HEARTBEAT_MS;
      }
      if (!wasReady) agentStatus("WAITING FOR INSTRUCTIONS", "Open Learn > Full Story Builder, develop your story, then select Build the complete story. Do not type instructions into this window.");
      wasReady = true;
      unavailableSince = 0;
      const claimed = await jsonRequest(server, "/api/full-story-builder/jobs/claim", "POST", { workerId }, fetchImpl);
      if (claimed.job) {
        agentStatus("WORKING", `Completing ${claimed.job.brief?.title || "the active Learn story"}...`);
        const result = await processClaimedJob(server, claimed.job, workerId, fetchImpl);
        if (result.ok) agentCompleted(`Saved ${result.fileName} in the Story Archive. Return to Learn and select Open completed story.`);
        else agentNeedsAttention(`The story job stopped safely: ${result.error}`);
        if (once) return result.ok ? 0 : 1;
        agentStatus("WAITING FOR INSTRUCTIONS", "The completed archived result remains above. Continue another story in Learn when ready.");
      } else if (once) return 0;
    } catch {
      if (!unavailableSince) unavailableSince = Date.now();
      if (wasReady && Date.now() - unavailableSince > 60_000) {
        agentCompleted("PlotPickle stopped, so local story-job monitoring ended.");
        return 0;
      }
      wasReady = false;
    }
    await wait(POLL_MS);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  const stayOpen = process.argv.includes("--stay-open");
  runAgent({ server: argument("--server", DEFAULT_SERVER), once: process.argv.includes("--once") })
    .then(async (code) => { process.exitCode = code; if (stayOpen) await keepAgentWindowOpen("Full Story Builder"); })
    .catch(async (error) => { agentNeedsAttention(error instanceof Error ? error.message : String(error)); process.exitCode = 1; if (stayOpen) await keepAgentWindowOpen("Full Story Builder"); });
}
