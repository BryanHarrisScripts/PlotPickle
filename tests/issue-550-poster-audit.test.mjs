import assert from "node:assert/strict";
import test from "node:test";
import { createFullStoryProject } from "../lib/full-story-builder.mjs";
import { auditProjectCoverage } from "../lib/production-supervisor.mjs";
import { attachPosterCandidate } from "../lib/visual-production-agent.mjs";

test("#550 coverage audit recognizes a schema-safe unreviewed poster candidate", () => {
  const project = createFullStoryProject({ title: "Poster Audit", originalitySeed: "issue-550-poster-audit" }, { now: "2026-08-10T12:00:00.000Z", jobId: "poster-audit" });
  const before = auditProjectCoverage(project);
  assert.equal(before.categories.posterKeyArt.status, "Draft");
  assert.equal(attachPosterCandidate(project, {
    assetUrl: "/api/local-ai/assets/poster-audit.png",
    route: "comfyui",
    prompt: "Poster audit candidate",
    providerRequestId: "poster-audit-1",
    createdAt: "2026-08-10T12:00:00.000Z",
  }), true);
  const after = auditProjectCoverage(project);
  assert.equal(after.categories.posterKeyArt.status, "Needs review");
  assert.equal(after.categories.posterKeyArt.candidateCount, 1);
  assert.deepEqual(after.categories.posterKeyArt.missing, []);
});
