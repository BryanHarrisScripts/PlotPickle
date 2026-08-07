import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #387 defines one provider-neutral candidate model for text image video and audio", async () => {
  const candidates = await source("lib/creative-candidates.ts");
  for (const phrase of [
    '"text" | "image" | "video" | "audio"',
    "CreativeExplorationCandidate",
    "CreativeCandidateTarget",
    "CreativeCandidateLineage",
    "CreativeCandidateSource",
    "CreativeCandidatePayload",
    'canonStatus: "candidate"',
  ]) assert.ok(candidates.includes(phrase), `Missing candidate contract: ${phrase}`);

  assert.doesNotMatch(candidates, /openai|ollama|comfyui|minimax|h3/i);
});

test("issue #387 preserves alternatives and retry lineage instead of overwriting results", async () => {
  const candidates = await source("lib/creative-candidates.ts");
  assert.match(candidates, /candidates: \[\.\.\.current\.candidates, normalized\]/);
  assert.match(candidates, /createRetryCandidate/);
  assert.match(candidates, /parentCandidateId: sourceCandidate\.id/);
  assert.match(candidates, /retryOfCandidateId: sourceCandidate\.id/);
  assert.match(candidates, /derivedFromCandidateIds: \[sourceCandidate\.id\]/);
});

test("issue #387 distinguishes usable failed and cancelled attempts while never approving canon", async () => {
  const candidates = await source("lib/creative-candidates.ts");
  for (const status of ["ready", "failed", "cancelled", "shortlisted", "rejected"]) {
    assert.ok(candidates.includes(`"${status}"`), `Missing candidate status: ${status}`);
  }
  assert.match(candidates, /failureMessage: status === "failed"/);
  assert.doesNotMatch(candidates, /canonStatus:\s*"approved"/);
  assert.doesNotMatch(candidates, /status:\s*"approved"/);
});

test("issue #387 persists candidate history through the project extensions carried by PPF export and import", async () => {
  const [candidates, project] = await Promise.all([
    source("lib/creative-candidates.ts"),
    source("lib/project.ts"),
  ]);
  assert.match(project, /extensions\?: Record<string, unknown>/);
  assert.match(candidates, /const EXTENSION_KEY = "creativeExploration"/);
  assert.match(candidates, /project\.extensions/);
  assert.match(candidates, /extensions:/);
  assert.match(candidates, /readCreativeCandidateStore/);
  assert.match(candidates, /appendCreativeCandidate/);
});

test("issue #387 keeps routing metadata inspectable without storing endpoint or credential material", async () => {
  const candidates = await source("lib/creative-candidates.ts");
  assert.match(candidates, /routeId/);
  assert.match(candidates, /safeRouteId/);
  assert.match(candidates, /api\[_-\]\?key\|token\|secret\|password\|credential/);
  assert.match(candidates, /https\?:\\\/\\\//);
});

test("issue #387 remains registered in the AI-native programme after its dependencies", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 387/);
  assert.match(registry, /"id": "exploration-candidates"/);
  assert.match(registry, /"issue": 388[\s\S]*"exploration-candidates"/);
});
