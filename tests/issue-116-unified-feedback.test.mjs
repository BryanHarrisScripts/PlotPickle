import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #116 establishes the required Feedback submenu", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const section of [
    '"overview"',
    '"ai-review"',
    '"human-review"',
    '"writers-room"',
    '"shooting-script"',
    '"table-read"',
  ]) assert.ok(model.includes(section), `Unified Feedback is missing section: ${section}`);
  assert.match(model, /export const FEEDBACK_SECTIONS/);
  assert.match(model, /bySection: Record<FeedbackSection, number>/);
});

test("issue #116 defines every required status and maps the legacy review state", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const status of [
    '"open"',
    '"under-review"',
    '"accepted"',
    '"partially-accepted"',
    '"rejected"',
    '"resolved"',
    '"deferred"',
  ]) assert.ok(model.includes(status), `Unified Feedback is missing status: ${status}`);
  assert.match(model, /status === "in-review"[\s\S]*return "under-review"/);
  assert.match(model, /export const FEEDBACK_STATUSES/);
});

test("issue #116 covers every required stable target kind", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const kind of [
    "project",
    "act",
    "sequence",
    "block",
    "mini-block",
    "character",
    "relationship",
    "world",
    "treatment",
    "screenplay",
    "scene",
    "dialogue-passage",
    "action-passage",
    "storyboard-frame",
    "visual-identity",
    "production-item",
  ]) assert.ok(model.includes(`\"${kind}\"`), `Unified Feedback is missing target kind: ${kind}`);
  for (const id of [
    "targetId",
    "blockId",
    "miniBlockId",
    "sceneId",
    "characterId",
    "frameId",
    "screenplayElementId",
    "productionItemId",
  ]) assert.ok(model.includes(id), `Unified Feedback target reference is missing: ${id}`);
});

test("issue #116 record model includes authorship source proposal resolution and revision history", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const contract of [
    "UnifiedFeedbackRecord",
    "author",
    "role",
    "source",
    "body",
    "status",
    "priority",
    "category",
    "proposedChange",
    "thread",
    "resolution",
    "createdAt",
    "updatedAt",
    "resolvedAt",
    "linkedRevisionId",
    "originId",
  ]) assert.ok(model.includes(contract), `Unified Feedback record is missing: ${contract}`);
});

test("issue #116 reuses canonical review threads specialist passes revisions and diagnostics", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const contract of [
    "project.review.threads.map",
    "recordFromThread",
    "savedSpecialistPasses(project)",
    "recordFromSpecialistPass",
    "revisionForPass",
    "project.revisions.find",
    "createMiniBlockWallModel(project, DEFAULT_MINI_BLOCK_WALL_STATE)",
    "recordFromDiagnostic",
  ]) assert.ok(model.includes(contract), `Unified Feedback adapter is missing: ${contract}`);
  assert.doesNotMatch(model, /feedbackDatabase|feedbackRecords\s*=\s*\[|localStorage|sessionStorage|indexedDB|fetch\(/);
});

test("issue #116 resolves stable IDs instead of positional Block links", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const contract of [
    "resolveFeedbackTarget",
    "candidate.id === target.blockId",
    "entry.miniBlock.id === target.miniBlockId",
    "entry.scene.id === target.sceneId",
    "element.id === target.screenplayElementId",
    "candidate.id === target.characterId",
    "entry.visual.id === target.frameId",
    "item.id === target.productionItemId",
  ]) assert.ok(model.includes(contract), `Stable feedback target resolution is missing: ${contract}`);
  assert.doesNotMatch(model, /target\.blockNumber\s*===|target\.miniBlockNumber\s*===/);
});

test("issue #116 supports searchable resolved history and target-specific filters", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const contract of [
    "FeedbackFilters",
    "includeResolved",
    "filters.statuses",
    "filters.sources",
    "filters.priorities",
    "filters.categories",
    "filters.targetKinds",
    "filters.targetId",
    "filters.query",
    "visibleRecords",
  ]) assert.ok(model.includes(contract), `Unified Feedback filtering is missing: ${contract}`);
  assert.match(model, /record\.proposedChange/);
  assert.match(model, /record\.resolution/);
  assert.match(model, /record\.target\.label/);
});

test("issue #116 creates badge counts for Blocks mini-blocks scenes characters visuals and screenplay", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const key of [
    "feedbackBadgeKey",
    "block:",
    "mini-block:",
    "scene:",
    "character:",
    "storyboard-frame:",
    "screenplay:",
    "badges.set",
  ]) assert.ok(model.includes(key), `Unified Feedback badges are missing: ${key}`);
});

test("issue #116 keeps suggestions proposal-only and does not rewrite canon", async () => {
  const model = await source("lib/unified-feedback.ts");
  assert.doesNotMatch(model, /project\.blocks\s*=|project\.screenplay\s*=|project\.characters\s*=|onProjectChange|applySpecialistSuggestion/);
  assert.match(model, /proposedChange: pass\.after/);
  assert.match(model, /synthetic: true/);
});

test("issue #116 foundation test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-116-unified-feedback\.test\.mjs/);
  assert.equal(packageJson.scripts["test:unified-feedback"], "node --test tests/issue-116-unified-feedback.test.mjs");
});
