import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #116 model derives every review record from canonical project state", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const collection of [
    "project.review.threads",
    "project.revisions",
    "project.production.directorNotes",
    "project.production.producerNotes",
    "project.production.actorNotes",
    "project.production.visualNotes",
    "project.production.soundNotes",
    "project.development.notes.openQuestions",
    "project.development.notes.continuity",
    "project.development.notes.producer",
  ]) assert.ok(model.includes(collection), `Feedback model is missing: ${collection}`);
  assert.doesNotMatch(model, /localStorage|sessionStorage|indexedDB/);
  assert.match(model, /type FeedbackSource =/);
  assert.match(model, /type FeedbackStatus = "open" \| "resolved" \| "accepted" \| "rejected"/);
  assert.match(model, /type FeedbackDecision =/);
  assert.match(model, /function createUnifiedFeedbackModel/);
  assert.match(model, /function updateFeedbackRecord/);
  assert.match(model, /function addFeedbackComment/);
  assert.match(model, /function addAnchoredFeedback/);
});

test("issue #116 normalizes missing review state instead of creating a parallel database", async () => {
  const project = await source("lib/project.ts");
  assert.match(project, /normalizeReview/);
  assert.match(project, /review: normalizeReview/);
  assert.match(project, /threads: Array\.isArray\(source\.threads\)/);
  assert.match(project, /comments: Array\.isArray\(thread\.comments\)/);
  assert.match(project, /createEmptyReview\(\)/);
  assert.doesNotMatch(project, /feedbackDatabase|reviewDatabase/);
});

test("issue #116 applies decisions through canonical project operations", async () => {
  const model = await source("lib/unified-feedback.ts");
  for (const operation of [
    "updateReviewThread",
    "addReviewThread",
    "addReviewComment",
    "updateProductionNoteStatus",
    "applySpecialistSuggestion",
  ]) assert.match(model, new RegExp(operation));
  assert.match(model, /decision === "accepted"/);
  assert.match(model, /decision === "rejected"/);
  assert.match(model, /recordRevision\(/);
  assert.match(model, /project.review.threads.some/);
});

test("issue #116 creates stable feedback deep links for canonical target IDs", async () => {
  const targets = await source("lib/feedback-targets.ts");
  for (const prefix of ["project", "block", "mini-block", "scene", "character", "location", "thread", "research", "reference", "visual", "production", "report"]) {
    assert.ok(targets.includes(`"${prefix}"`), `Missing feedback target prefix: ${prefix}`);
  }
  assert.match(targets, /function feedbackTargetOptions/);
  assert.match(targets, /function parseFeedbackTarget/);
  assert.match(targets, /function feedbackTargetUrl/);
  assert.match(targets, /\/\?workspace=build&context=/);
  assert.match(targets, /\/\?workspace=write&context=/);
  assert.match(targets, /\/\?workspace=storyboard&context=/);
  assert.match(targets, /\/\?workspace=plan&context=/);
  assert.match(targets, /\/\?workspace=feedback&context=/);
});

test("issue #116 live workspace renders all sections filters decisions threads and target links", async () => {
  const workspace = await source("app/feedback-workspace.tsx");
  for (const contract of [
    "FeedbackWorkspace",
    "createUnifiedFeedbackModel",
    "updateFeedbackRecord",
    "addFeedbackComment",
    "addAnchoredFeedback",
    "feedbackTargetOptions",
    "Create anchored feedback",
    "Include resolved history",
    "Proposed change",
    "Resolution",
    "Linked revision",
    "Add comment",
    "onOpenTarget?.(selectedRecord.target)",
    "project.review.threads.length",
    "Suggestions do not overwrite the screenplay automatically",
    "Anchored review",
  ]) assert.ok(workspace.includes(contract), `Live Feedback workspace is missing: ${contract}`);
  assert.doesNotMatch(workspace, /localStorage|sessionStorage|applySpecialistSuggestion/);
});

test("issue #116 makes Build and Feedback reachable in the primary workflow", async () => {
  const direction = await source("lib/product-direction.ts");
  assert.match(direction, /id: "planner", label: "Plan"[\s\S]*id: "visuals", label: "Storyboard"[\s\S]*id: "script", label: "Write"[\s\S]*id: "pitch", label: "Graphic Novel"[\s\S]*id: "build", label: "Build"/);
  assert.match(direction, /id: "build", label: "Build"[\s\S]*id: "feedback", label: "Feedback"[\s\S]*id: "engines", label: "Refine"[\s\S]*id: "reports", label: "Reports"/);
});

test("issue #116 mounts Feedback and preserves reviewed-item navigation context", async () => {
  const page = await source("app/page.tsx");
  for (const contract of [
    'import FeedbackWorkspace from "./feedback-workspace"',
    'import FeedbackContextBadge from "./feedback-context-badge"',
    "createStoredFeedbackModel",
    "feedbackTargetId",
    "openFeedback",
    "openFeedbackTarget",
    'activeTab === "feedback"',
    "initialTargetId={feedbackTargetId}",
    "onOpenTarget={openFeedbackTarget}",
  ]) assert.ok(page.includes(contract), `Feedback page integration is missing: ${contract}`);
});

test("issue #116 shows context badges in Build Write and Storyboard", async () => {
  const [page, build, wall, badge] = await Promise.all([
    source("app/page.tsx"),
    source("app/build-workspace.tsx"),
    source("app/mini-block-wall.tsx"),
    source("app/feedback-context-badge.tsx"),
  ]);
  assert.match(page, /FeedbackContextBadge[\s\S]*selectedBlockFeedbackCount/);
  assert.match(page, /activeTab === "script"[\s\S]*FeedbackContextBadge/);
  assert.match(page, /activeTab === "visuals"[\s\S]*FeedbackContextBadge/);
  assert.match(build, /FeedbackContextBadge/);
  assert.match(wall, /FeedbackContextBadge/);
  assert.match(badge, /Open Feedback/);
});

test("issue #116 is registered in the normal test matrix", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-116-unified-feedback\.test\.mjs/);
  assert.equal(packageJson.scripts["test:unified-feedback"], "node --test tests/issue-116-unified-feedback.test.mjs");
});
