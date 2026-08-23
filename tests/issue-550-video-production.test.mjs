import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { attachVideoCandidate, buildVideoProductionPlan, exactVideoConsentStatement } from "../lib/video-production.mjs";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

function project() {
  return {
    id: "story-550",
    metadata: { title: "The Test Signal" },
    story: { premise: "A conservator must restore a stolen public memory." },
    world: { visualLanguage: "Matte charcoal, hard window light and weathered brass." },
    blocks: [{ number: 1, storyboardDirection: "A slow push toward the evidence.", visuals: [{ id: "frame-1", miniBlockNumber: 1, src: "/api/local-ai/assets/frame.webp" }] }],
    assets: { assets: [] },
  };
}

test("#550 video planning never silently enables an H3 route without exact paid and data-sharing consent", () => {
  const status = { videoRoute: "minimax-direct", profiles: { minimax: { configured: true } } };
  const plan = buildVideoProductionPlan(status, project(), {});
  assert.equal(plan.allowed, false);
  assert.equal(plan.fallback, "none");
  assert.equal(plan.requestedCount, 1);
  assert.match(plan.reason, /No paid video request was sent/i);
  assert.equal(plan.expectedConsentStatement, exactVideoConsentStatement(1));
});

test("#550 video planning accepts only the exact bounded authorization and an existing first-frame candidate", () => {
  const status = { videoRoute: "minimax-direct", profiles: { minimax: { configured: true } } };
  const consent = { acknowledged: true, maximumRequests: 1, statement: exactVideoConsentStatement(1) };
  const plan = buildVideoProductionPlan(status, project(), { paidConsent: consent });
  assert.equal(plan.allowed, true);
  assert.equal(plan.sourceAssetUrl, "/api/local-ai/assets/frame.webp");
  assert.equal(plan.durationSeconds, 4);
  assert.equal(plan.aspectRatio, "16:9");
  assert.match(plan.prompt, /unreviewed candidate/i);
});

test("#550 hybrid H3 route stays blocked until its reviewed workflow gate is ready", () => {
  const blocked = buildVideoProductionPlan({ videoRoute: "minimax-comfyui", hybridGate: { ready: false } }, project(), { paidConsent: { acknowledged: true, maximumRequests: 1, statement: exactVideoConsentStatement(1) } });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /workflow gate is not ready/i);
});

test("#550 completed video attaches only a local MP4 or WebM as an unreviewed PPF candidate", () => {
  const value = project();
  const plan = buildVideoProductionPlan({ videoRoute: "minimax-direct", profiles: { minimax: { configured: true } } }, value, { paidConsent: { acknowledged: true, maximumRequests: 1, statement: exactVideoConsentStatement(1) } });
  assert.equal(attachVideoCandidate(value, plan, { id: "job-1", route: "minimax-direct", provider: "minimax", model: "MiniMax-H3", outputAssetUrl: "/api/local-ai/assets/animatic.mp4", updatedAt: "2026-08-10T12:00:00.000Z" }), true);
  const asset = value.assets.assets[0];
  assert.equal(asset.kind, "animatic");
  assert.equal(asset.approvalState, "candidate");
  assert.equal(asset.approvedVariationId, "");
  assert.equal(asset.variations[0].approval, "unreviewed");
  assert.equal(attachVideoCandidate(value, plan, { id: "job-2", outputAssetUrl: "https://example.com/video.mp4" }), false);
});

test("#550 supervisor discovers the video worker and launcher keeps it persistent without authorizing paid work", async () => {
  const [supervisor, launcher, worker] = await Promise.all([
    read("scripts/production-supervisor-agent.mjs"),
    read("Start-Production-Supervisor.bat"),
    read("scripts/video-production-agent.mjs"),
  ]);
  assert.match(supervisor, /video-production/);
  assert.match(supervisor, /video-and-animatic-production/);
  assert.match(launcher, /VIDEO_AGENT=scripts\\video-production-agent\.mjs/);
  assert.match(launcher, /start "PlotPickle Video Production Agent" node "%VIDEO_AGENT%" --server "%PLOTPICKLE_URL%" --stay-open/);
  assert.match(launcher, /does not authorize paid generation/i);
  assert.match(worker, /Automatic startup never grants paid consent or data-sharing consent/);
  assert.doesNotMatch(worker, /\/api\/local-ai\/generate\/video[^\n]*POST/);
});
