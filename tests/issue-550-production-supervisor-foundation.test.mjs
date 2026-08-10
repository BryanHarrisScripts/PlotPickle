import assert from "node:assert/strict";
import test from "node:test";
import { createFullStoryProject } from "../lib/full-story-builder.mjs";
import { auditProjectCoverage, createCapabilitySnapshot, supervisorFoundationReport } from "../lib/production-supervisor.mjs";

const fixed = { now: "2026-08-09T20:00:00.000Z", jobId: "issue-550-foundation" };

function project() {
  return createFullStoryProject({ title: "Supervisor Test", originalitySeed: "issue-550" }, fixed);
}

test("#550 coverage audit refuses to call a structurally complete story a fully complete production", () => {
  const report = auditProjectCoverage(project());
  assert.equal(report.categories.storyStructureAndScreenplay.status, "Complete");
  assert.equal(report.categories.canonicalFieldCoverage.status, "Complete");
  assert.equal(report.categories.posterKeyArt.status, "Draft");
  assert.equal(report.categories.imageCoverage.status, "Draft");
  assert.equal(report.categories.videoAnimaticCoverage.status, "Draft");
  assert.equal(report.categories.uiContinuity.status, "Not requested");
  assert.equal(report.categories.inputAndEndToEndUat.status, "Not requested");
  assert.equal(report.summary.wholeProjectComplete, false);
  assert.equal(report.summary.totalCategories, 12);
});

test("#550 reports exact missing canonical paths instead of silently treating blanks as complete", () => {
  const story = project();
  story.story.theme = "";
  story.characters[0].voice = "";
  story.blocks[0].goal = "";
  const report = auditProjectCoverage(story);
  assert.ok(report.categories.canonicalFieldCoverage.missing.includes("story.theme"));
  assert.ok(report.categories.canonicalFieldCoverage.missing.includes("characters[0].voice"));
  assert.ok(report.categories.storyStructureAndScreenplay.missing.includes("blocks[0].goal"));
});

test("#550 capability snapshot is provider-aware but secret-free", () => {
  const snapshot = createCapabilitySnapshot({
    routes: { text: "ollama", image: "comfyui", video: "minimax" },
    maximumRequests: 3,
    maximumCost: 2.5,
    providers: {
      ollama: { enabled: true, reachable: true, endpoint: "http://127.0.0.1:11434", selectedModel: "qwen-small" },
      comfyui: { enabled: true, reachable: true, endpoint: "http://127.0.0.1:8188", autoStart: true },
      openai: { enabled: true, configured: true, apiKey: "sk-should-never-leak", kind: "cloud" },
      minimax: { enabled: true, configured: true, token: "never-leak", paid: true },
      buzz: { enabled: true, reachable: false, privateKey: "never-leak" },
    },
  });
  assert.equal(snapshot.routes.image, "comfyui");
  assert.equal(snapshot.providers.ollama.reachable, true);
  assert.equal(snapshot.providers.comfyui.autoStart, true);
  assert.equal(snapshot.providers.openai.paid, true);
  assert.equal(snapshot.policy.paidCloudRequiresPerJobConsent, true);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /sk-should-never-leak|never-leak|apiKey|privateKey|token/i);
});

test("#550 capability snapshot exposes only loopback endpoints", () => {
  const snapshot = createCapabilitySnapshot({ providers: {
    ollama: { reachable: true, endpoint: "http://localhost:11434" },
    comfyui: { reachable: true, endpoint: "http://192.168.1.50:8188" },
  }});
  assert.equal(snapshot.providers.ollama.endpoint, "http://localhost:11434");
  assert.equal(snapshot.providers.comfyui.endpoint, "");
});

test("#550 foundation report turns missing execution readiness into explicit blockers", () => {
  const report = supervisorFoundationReport(project(), { providers: { ollama: { reachable: true } } });
  assert.match(report.blockers.join(" "), /image\/video execution route/i);
  assert.equal(report.coverage.categories.integrationsAndBlockers.status, "Blocked");
});
