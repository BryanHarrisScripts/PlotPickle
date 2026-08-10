import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createFullStoryProject } from "../lib/full-story-builder.mjs";
import {
  attachPosterCandidate,
  hasPosterCandidate,
  posterPrompt,
  processLatestFullStoryVisuals,
  runVisualProductionForProject,
  visualProductionPlan,
} from "../lib/visual-production-agent.mjs";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");
const fixed = { now: "2026-08-10T12:00:00.000Z", jobId: "issue-550-visuals" };

function response(body, ok = true, status = ok ? 200 : 400) {
  return { ok, status, async json() { return body; } };
}

function blankProject(seed = "visual-production") {
  return createFullStoryProject({ title: "The Visual Test", originalitySeed: seed }, fixed);
}

const readyComfy = {
  imageRoute: "comfyui",
  comfyui: { reachable: true, imageNodesReady: true, checkpoint: "local-image.safetensors" },
};

test("#550 plans a bounded local poster plus story-image job and never silently falls back to paid cloud", () => {
  const project = blankProject("plan");
  const local = visualProductionPlan(readyComfy, project, { poster: true, storyVisualCount: 1 });
  assert.equal(local.allowed, true);
  assert.equal(local.route, "comfyui");
  assert.equal(local.paid, false);
  assert.equal(local.requestedCount, 2);
  assert.equal(local.posterNeeded, true);
  assert.equal(local.storyTargets.length, 1);

  const cloud = visualProductionPlan({ imageRoute: "minimax" }, project, { poster: true, storyVisualCount: 1 });
  assert.equal(cloud.allowed, false);
  assert.equal(cloud.paid, true);
  assert.match(cloud.reason, /No request was sent/);
  assert.equal(cloud.expectedConsentStatement, "I authorize 2 paid image requests for this Production Supervisor visual job.");

  const authorized = visualProductionPlan({ imageRoute: "minimax" }, project, {
    poster: true,
    storyVisualCount: 1,
    paidConsent: { acknowledged: true, maximumRequests: 2, statement: cloud.expectedConsentStatement },
  });
  assert.equal(authorized.allowed, true);
});

test("#550 poster prompt uses story, visual language and human-review boundaries", () => {
  const project = blankProject("poster-prompt");
  const prompt = posterPrompt(project);
  assert.match(prompt, /The Visual Test/);
  assert.match(prompt, /Visual language:/);
  assert.match(prompt, /no text, no logos, no watermark/);
  assert.match(prompt, /unreviewed candidate, not approved canon/);
});

test("#550 attaches a schema-shaped poster candidate without approving canon", () => {
  const project = blankProject("attach-poster");
  const attached = attachPosterCandidate(project, {
    assetUrl: "/api/local-ai/assets/poster-test.png",
    route: "comfyui",
    providerRequestId: "local-prompt-1",
    prompt: "A poster candidate",
    createdAt: fixed.now,
  });
  assert.equal(attached, true);
  assert.equal(hasPosterCandidate(project), true);
  const poster = project.assets.assets.find((asset) => asset.extensions?.role === "poster");
  assert.ok(poster);
  assert.equal(poster.kind, "image");
  assert.equal(poster.label, "Poster / key art candidate");
  assert.equal(poster.approvedVariationId, "");
  assert.equal(poster.variations[0].approval, "unreviewed");
  assert.equal(poster.variations[0].extensions.canonApproved, false);
  assert.equal(Object.prototype.hasOwnProperty.call(poster, "role"), false);
  assert.equal(attachPosterCandidate(project, { assetUrl: "/api/local-ai/assets/duplicate.png" }), false);
  assert.equal(project.assets.assets.filter((asset) => asset.extensions?.role === "poster").length, 1);
});

test("#550 ready local ComfyUI creates one poster and one story visual with no billing acknowledgement", async () => {
  const project = blankProject("local-run");
  const calls = [];
  let generation = 0;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith("/api/media-routing/status")) return response(readyComfy);
    if (String(url).endsWith("/api/local-ai/generate/image")) {
      generation += 1;
      return response({
        ok: true,
        route: "comfyui",
        assetUrl: generation === 1 ? "/api/local-ai/assets/poster-local.png" : "/api/local-ai/assets/story-local.png",
        providerRequestId: `comfy-${generation}`,
      });
    }
    throw new Error(`Unexpected request ${url}`);
  };

  const result = await runVisualProductionForProject("http://127.0.0.1:4173", project, { poster: true, storyVisualCount: 1 }, fetchImpl);
  assert.equal(result.ok, true);
  assert.equal(result.generated.length, 2);
  assert.equal(result.failed.length, 0);
  assert.equal(hasPosterCandidate(project), true);
  assert.equal(project.blocks[0].visuals[0].src, "/api/local-ai/assets/story-local.png");
  const generationCalls = calls.filter((call) => call.url.endsWith("/api/local-ai/generate/image"));
  assert.equal(generationCalls.length, 2);
  assert.equal(generationCalls[0].body.aspect, "portrait");
  assert.equal(generationCalls[1].body.aspect, "landscape");
  assert.ok(generationCalls.every((call) => call.body.requestCount === 1 && call.body.billingAcknowledged === false));
});

test("#550 production worker loads and saves the same completed PPF with a rolling backup", async () => {
  const project = blankProject("load-save");
  const calls = [];
  let generation = 0;
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: target, method: init.method || "GET", body });
    if (target.endsWith("/api/full-story-builder/status")) return response({ jobs: [{ status: "completed", fileName: "the-visual-test.ppf" }] });
    if (target.includes("/api/local-projects/load?file=the-visual-test.ppf")) return response({ project });
    if (target.endsWith("/api/media-routing/status")) return response(readyComfy);
    if (target.endsWith("/api/local-ai/generate/image")) {
      generation += 1;
      return response({ ok: true, route: "comfyui", assetUrl: `/api/local-ai/assets/load-save-${generation}.png`, providerRequestId: `save-${generation}` });
    }
    if (target.endsWith("/api/local-projects/save")) return response({ ok: true, fileName: body.fileName });
    throw new Error(`Unexpected request ${target}`);
  };

  const result = await processLatestFullStoryVisuals("http://127.0.0.1:4173", { poster: true, storyVisualCount: 1 }, fetchImpl);
  assert.equal(result.changed, true);
  assert.equal(result.fileName, "the-visual-test.ppf");
  const save = calls.find((call) => call.url.endsWith("/api/local-projects/save"));
  assert.ok(save);
  assert.equal(save.body.fileName, "the-visual-test.ppf");
  assert.equal(save.body.createRollingBackup, true);
  assert.equal(save.body.project.id, project.id);
});

test("#550 failed generation preserves the exact prompt and gives a route-specific recovery action", async () => {
  const project = blankProject("failure-evidence");
  let generation = 0;
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/api/media-routing/status")) return response(readyComfy);
    if (String(url).endsWith("/api/local-ai/generate/image")) {
      generation += 1;
      if (generation === 1) return response({ ok: true, route: "comfyui", assetUrl: "/api/local-ai/assets/poster-success.png", providerRequestId: "poster-success" });
      return response({ message: "Selected checkpoint is unavailable." }, false, 400);
    }
    throw new Error(`Unexpected request ${url}`);
  };
  const result = await runVisualProductionForProject("http://127.0.0.1:4173", project, { poster: true, storyVisualCount: 1 }, fetchImpl);
  assert.equal(result.changed, true);
  assert.equal(result.failed.length, 1);
  assert.ok(result.failed[0].prompt.length > 20);
  assert.match(result.failed[0].error, /checkpoint is unavailable/i);
  assert.match(result.failed[0].recovery, /Settings > ComfyUI/);
});

test("#550 supervisor discovers and launches the persistent visual worker with safety copy", async () => {
  const [supervisor, worker, launcher] = await Promise.all([
    read("scripts/production-supervisor-agent.mjs"),
    read("scripts/visual-production-agent.mjs"),
    read("Start-Production-Supervisor.bat"),
  ]);
  assert.match(supervisor, /agentId: "visual-production"/);
  assert.match(supervisor, /poster-and-image-production/);
  assert.match(worker, /Visual Production Agent accepts only a local PlotPickle server address/);
  assert.match(worker, /Paid cloud image requests are never submitted without exact per-job consent/);
  assert.match(worker, /nothing was approved as canon/i);
  assert.match(launcher, /start "PlotPickle Visual Production Agent" node "%VISUAL_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open/);
  assert.match(launcher, /does not approve canon, expose credentials, publish, install software, or authorize paid generation/i);
});
