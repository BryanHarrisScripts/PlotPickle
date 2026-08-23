import { attachGeneratedVisual } from "./full-story-builder.mjs";

const LOCAL_ASSET = /^\/api\/local-ai\/assets\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/i;

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 30_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function integer(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback;
}

function safeId(value, fallback = "asset") {
  const normalized = text(value, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function mediaType(source) {
  if (/\.png$/i.test(source)) return "image/png";
  if (/\.jpe?g$/i.test(source)) return "image/jpeg";
  return "image/webp";
}

function candidateRole(asset) {
  return text(asset?.extensions?.role, 80).toLowerCase();
}

export function hasPosterCandidate(project) {
  return Array.isArray(project?.assets?.assets) && project.assets.assets.some((asset) => candidateRole(asset) === "poster");
}

export function storyVisualTargets(project, requested = 1) {
  const maximum = integer(requested, 1, 0, 4);
  const targets = [];
  for (const block of Array.isArray(project?.blocks) ? project.blocks : []) {
    for (const frame of Array.isArray(block?.visuals) ? block.visuals : []) {
      if (targets.length >= maximum) return targets;
      if (text(frame?.src, 2_000)) continue;
      targets.push({
        blockNumber: integer(block?.number, targets.length + 1, 1, 24),
        miniBlockNumber: integer(frame?.miniBlockNumber, 1, 1, 4),
        frameId: text(frame?.id, 200),
        prompt: text(frame?.prompt),
        caption: text(frame?.caption, 500),
      });
    }
  }
  return targets;
}

export function posterPrompt(project) {
  const metadata = object(project?.metadata);
  const story = object(project?.story);
  const world = object(project?.world);
  const characters = Array.isArray(project?.characters) ? project.characters.slice(0, 3) : [];
  const cast = characters.map((character) => `${text(character?.name, 100)} — ${text(character?.description, 400)}`).filter(Boolean).join("; ");
  return [
    `Cinematic poster key art candidate for ${text(metadata.title, 300) || "an original story"}.`,
    text(story.logline, 1_200) || text(story.premise, 1_200),
    text(world.visualLanguage, 1_200) ? `Visual language: ${text(world.visualLanguage, 1_200)}.` : "",
    cast ? `Character identity context: ${cast}.` : "",
    "Create one striking visual-first composition with a strong focal subject, story tension, readable silhouette, cinematic depth, no text, no logos, no watermark. Preserve established character and world identity where references are available. This is an unreviewed candidate, not approved canon.",
  ].filter(Boolean).join(" ").slice(0, 30_000);
}

export function visualProductionPlan(mediaStatus, project, options = {}) {
  const status = object(mediaStatus);
  const route = text(status.imageRoute, 40) || "manual";
  const posterNeeded = options.poster !== false && !hasPosterCandidate(project);
  const storyTargets = storyVisualTargets(project, options.storyVisualCount ?? 1);
  const requestedCount = (posterNeeded ? 1 : 0) + storyTargets.length;
  if (!requestedCount) {
    return { allowed: false, route, paid: false, posterNeeded, storyTargets, requestedCount: 0, reason: "Poster and requested story visuals are already present." };
  }
  if (route === "comfyui") {
    const comfy = object(status.comfyui);
    const ready = comfy.reachable === true && comfy.imageNodesReady === true && Boolean(text(comfy.checkpoint || comfy.selectedCheckpoint, 500));
    return {
      allowed: ready,
      route,
      paid: false,
      posterNeeded,
      storyTargets,
      requestedCount,
      reason: ready ? "Local ComfyUI is ready for the bounded visual job." : "Local ComfyUI is selected but is not generation-ready. Open Settings > ComfyUI and complete the connection, checkpoint and image-workflow checks.",
    };
  }
  if (route === "openai" || route === "minimax") {
    const expectedStatement = `I authorize ${requestedCount} paid image request${requestedCount === 1 ? "" : "s"} for this Production Supervisor visual job.`;
    const consent = object(options.paidConsent);
    const allowed = consent.acknowledged === true
      && Number(consent.maximumRequests) === requestedCount
      && text(consent.statement, 500) === expectedStatement;
    return {
      allowed,
      route,
      paid: true,
      posterNeeded,
      storyTargets,
      requestedCount,
      expectedConsentStatement: expectedStatement,
      reason: allowed ? "Exact per-job paid consent is present." : `The active image route may charge money. No request was sent. Required consent: ${expectedStatement}`,
    };
  }
  return { allowed: false, route, paid: false, posterNeeded, storyTargets, requestedCount, reason: "Image routing is Manual Import or Off. Choose a ready image route in Settings or import candidates manually." };
}

export function attachPosterCandidate(project, result = {}) {
  const source = text(result.assetUrl, 2_000);
  if (!LOCAL_ASSET.test(source)) return false;
  if (!project.assets || typeof project.assets !== "object") project.assets = { version: "1.0.0", assets: [], extensions: {} };
  if (!Array.isArray(project.assets.assets)) project.assets.assets = [];
  if (hasPosterCandidate(project)) return false;
  const now = text(result.createdAt, 100) || new Date().toISOString();
  const projectId = safeId(project.id, "project");
  const assetId = `poster-${projectId}`;
  const variationId = `poster-candidate-${safeId(result.providerRequestId || now, "candidate")}`;
  const prompt = text(result.prompt);
  project.assets.assets.push({
    id: assetId,
    kind: "image",
    label: "Poster / key art candidate",
    targets: [{ kind: "other", id: `poster:${text(project.id, 200) || projectId}` }],
    variations: [{
      id: variationId,
      source,
      portablePath: "",
      sourceFingerprint: `poster-${safeId(source, "asset")}`,
      contentHash: "",
      mediaType: mediaType(source),
      bytes: 0,
      provider: text(result.provider, 100) || text(result.route, 100) || "configured image route",
      model: text(result.model, 200),
      prompt,
      generatedAt: now,
      provenanceIds: ["production-supervisor-visual-agent"],
      approval: "unreviewed",
      extensions: { role: "poster", candidate: true, canonApproved: false, providerRequestId: text(result.providerRequestId, 300) },
    }],
    approvedVariationId: "",
    createdAt: now,
    updatedAt: now,
    extensions: { role: "poster", candidate: true, canonApproved: false },
  });
  return true;
}

async function jsonRequest(server, pathname, method = "GET", body, fetchImpl = fetch) {
  const response = await fetchImpl(`${server}${pathname}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(method === "GET" ? 15_000 : 240_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : `PlotPickle returned HTTP ${response.status}.`;
    throw new Error(message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]"));
  }
  return payload;
}

function generationBody(job, plan) {
  return {
    prompt: job.prompt,
    assetId: job.assetId,
    aspect: job.kind === "poster" ? "portrait" : "landscape",
    quality: "low",
    requestCount: 1,
    billingAcknowledged: plan.paid,
  };
}

export async function runVisualProductionForProject(server, project, options = {}, fetchImpl = fetch) {
  const mediaStatus = await jsonRequest(server, "/api/media-routing/status", "GET", undefined, fetchImpl);
  const plan = visualProductionPlan(mediaStatus, project, options);
  if (!plan.allowed) return { ok: false, changed: false, plan, generated: [], failed: [], reason: plan.reason };

  const jobs = [];
  if (plan.posterNeeded) jobs.push({ kind: "poster", assetId: `poster-${safeId(project.id, "project")}`, prompt: posterPrompt(project) });
  for (const target of plan.storyTargets) {
    jobs.push({
      kind: "story-visual",
      assetId: `supervisor-story-${safeId(project.id, "project")}-${target.blockNumber}-${target.miniBlockNumber}`,
      prompt: target.prompt,
      target,
    });
  }

  const generated = [];
  const failed = [];
  for (const job of jobs) {
    try {
      const result = await jsonRequest(server, "/api/local-ai/generate/image", "POST", generationBody(job, plan), fetchImpl);
      if (!LOCAL_ASSET.test(text(result.assetUrl, 2_000))) throw new Error("The image route did not return a saved local PlotPickle asset.");
      const createdAt = new Date().toISOString();
      const attached = job.kind === "poster"
        ? attachPosterCandidate(project, { ...result, prompt: job.prompt, createdAt })
        : attachGeneratedVisual(project, {
          blockNumber: job.target.blockNumber,
          miniBlockNumber: job.target.miniBlockNumber,
          assetUrl: result.assetUrl,
          route: result.route || plan.route,
          provider: result.provider,
          model: result.model,
          createdAt,
        });
      if (!attached) throw new Error("The generated local asset could not be attached to the intended PPF identity.");
      generated.push({ kind: job.kind, assetUrl: result.assetUrl, prompt: job.prompt, target: job.target || null, route: result.route || plan.route, providerRequestId: result.providerRequestId || "" });
    } catch (error) {
      failed.push({
        kind: job.kind,
        target: job.target || null,
        prompt: job.prompt,
        error: error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : "Image generation failed.",
        recovery: plan.route === "comfyui" ? "Open Settings > ComfyUI, repair the selected checkpoint/workflow, then rerun the visual job." : "Review the active image provider and exact paid-consent scope, then rerun only this failed candidate.",
      });
    }
  }
  if (project.metadata && typeof project.metadata === "object") project.metadata.updatedAt = new Date().toISOString();
  return { ok: generated.length > 0 && failed.length === 0, changed: generated.length > 0, plan, generated, failed };
}

export async function processLatestFullStoryVisuals(server, options = {}, fetchImpl = fetch) {
  const status = await jsonRequest(server, "/api/full-story-builder/status", "GET", undefined, fetchImpl);
  const completed = Array.isArray(status.jobs) ? status.jobs.find((job) => job?.status === "completed" && text(job?.fileName, 200)) : null;
  if (!completed) return { ok: false, changed: false, reason: "No completed Full Story Builder project is available yet." };
  const fileName = text(completed.fileName, 200);
  const loaded = await jsonRequest(server, `/api/local-projects/load?file=${encodeURIComponent(fileName)}`, "GET", undefined, fetchImpl);
  const project = loaded.project;
  if (!project || typeof project !== "object" || Array.isArray(project)) throw new Error("The completed Full Story Builder project could not be loaded.");
  const result = await runVisualProductionForProject(server, project, options, fetchImpl);
  if (result.changed) {
    await jsonRequest(server, "/api/local-projects/save", "POST", { project, fileName, createRollingBackup: true }, fetchImpl);
  }
  return { ...result, fileName, projectId: text(project.id, 200), title: text(project.metadata?.title, 300) };
}
