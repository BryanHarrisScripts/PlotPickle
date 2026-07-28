import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #177 makes Graphic Novel the visible product term including the splash screen", async () => {
  const [workspace, splash, terminology, operations] = await Promise.all([
    source("app/ai-pitch-deck-workspace.tsx"),
    source("app/marketing-splash.tsx"),
    source("app/graphic-novel-terminology.tsx"),
    source("lib/ai-pitch-deck.ts"),
  ]);
  for (const phrase of [
    "Complete Graphic Novel",
    "Generate all Graphic Novel images",
    "Graphic Novel replaces Comic Book and Comic Pitch",
    "Graphic Novel pages",
    "graphic-novel.html",
    "PlotPickle Graphic Novel",
  ]) assert.ok(`${workspace}\n${splash}\n${terminology}\n${operations}`.includes(phrase), `Graphic Novel terminology is missing: ${phrase}`);
  assert.match(terminology, /MutationObserver/);
  assert.match(terminology, /aria-label/);
  assert.match(splash, /MarketingSplashBase/);
});

test("issue #177 processes the full Graphic Novel queue one provider request at a time", async () => {
  const [hook, gateway] = await Promise.all([
    source("app/use-graphic-novel-queue.ts"),
    source("build/local-ai-gateway.ts"),
  ]);
  assert.match(hook, /while \(!stopRef\.current\)/);
  assert.match(hook, /await requestPanel\(panel, activeQueue\.id, target\.id, controller\.signal\)/);
  assert.match(hook, /requestCount: 1/);
  assert.match(hook, /X-PlotPickle-Image-Mode/);
  assert.doesNotMatch(hook, /Promise\.all\([^)]*requestPanel/s);
  assert.match(gateway, /let imageRequestActive = false/);
  assert.match(gateway, /if \(imageRequestActive\)/);
  assert.match(gateway, /MAX_SINGLE_IMAGE_REQUEST_BYTES/);
  assert.match(gateway, /Queue large Graphic Novel runs locally instead of sending a batch/);
  assert.match(gateway, /n: 1/);
});

test("issue #177 exposes progress, stopping, resuming, retry and skip without losing completed images", async () => {
  const [workspace, hook, contract] = await Promise.all([
    source("app/ai-pitch-deck-workspace.tsx"),
    source("app/use-graphic-novel-queue.ts"),
    source("lib/graphic-novel-queue.ts"),
  ]);
  for (const phrase of [
    '"queued" | "generating" | "completed" | "failed" | "stopped" | "retrying" | "skipped"',
    "Stop generation",
    "Resume remaining images",
    "Retry",
    "Skip",
    "Completed images were kept",
    "Every completed image is saved immediately",
  ]) assert.ok(`${workspace}\n${hook}\n${contract}`.includes(phrase), `Queue recovery contract is missing: ${phrase}`);
  assert.match(hook, /controllerRef\.current\?\.abort\(\)/);
  assert.match(hook, /state: "completed", assetUrl:/);
  assert.match(hook, /state: "skipped"/);
  assert.match(hook, /state: "retrying"/);
});

test("issue #177 persists only project-scoped non-secret queue metadata", async () => {
  const [hook, contract] = await Promise.all([
    source("app/use-graphic-novel-queue.ts"),
    source("lib/graphic-novel-queue.ts"),
  ]);
  const combined = `${hook}\n${contract}`;
  assert.match(contract, /plotpickle:graphic-novel-queue:\$\{projectId\}/);
  assert.match(hook, /value\.projectId === project\.id/);
  assert.match(hook, /window\.localStorage\.removeItem\(key\)/);
  assert.match(hook, /queueId,/);
  assert.match(hook, /projectId: projectRef\.current\.id/);
  assert.doesNotMatch(combined, /apiKey\s*:|accessToken\s*:|refreshToken\s*:|clientSecret\s*:/);
  assert.match(contract, /\[redacted\]/);
});

test("issue #177 preserves legacy project fields and implementation contracts for migration", async () => {
  const [project, workspaceBase, operationsBase, gatewayBase] = await Promise.all([
    source("lib/project.ts"),
    source("app/ai-pitch-deck-workspace-base.tsx"),
    source("lib/ai-pitch-deck-base.ts"),
    source("build/local-ai-gateway-base.ts"),
  ]);
  assert.match(project, /comicDeck\?: ComicPitchDeck/);
  assert.match(workspaceBase, /AiPitchDeckWorkspace/);
  assert.match(operationsBase, /createComicPitchDeckPlan/);
  assert.match(gatewayBase, /generateImage/);
});

test("issue #177 regression is included through the existing pitch test entry", async () => {
  const aggregator = await source("tests/issue-167-navigation-ai-pitch.test.mjs");
  assert.match(aggregator, /issue-167-navigation-ai-pitch-base\.test\.mjs/);
  assert.match(aggregator, /issue-177-graphic-novel-queue\.test\.mjs/);
});
