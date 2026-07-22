import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("PlotPickle 0.16 exposes the complete pitch and review studio", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const page = await source("app/pitch-review/page.tsx");
  const workspace = await source("app/pitch-review-workspace.tsx");
  assert.ok(Number(packageJson.version.split(".")[1]) >= 16);
  assert.match(packageJson.scripts.test, /phase-d-pitch-review\.test\.mjs/);
  assert.match(page, /PitchReviewWorkspace/);
  for (const label of ["Logline Workshop", "Anchored Reviews", "Revision Compare", "Pitch Package", "Exports"]) assert.ok(workspace.includes(label), `Missing Phase D view: ${label}`);
});

test("review threads anchor to stable canonical project identities", async () => {
  const project = await source("lib/project.ts");
  const operations = await source("lib/pitch-review.ts");
  for (const phrase of ["ReviewAnchorKind", "ReviewThreadStatus", "ReviewComment", "ReviewThread", "ReviewWorkspace", "review: ReviewWorkspace"]) assert.ok(project.includes(phrase), `Missing canonical review field: ${phrase}`);
  for (const phrase of ["screenplay-element", "story-field", "createReviewThread", "addReviewComment", "updateReviewThreadStatus", "resolvedAt"]) assert.ok(`${project}\n${operations}`.includes(phrase), `Missing review operation: ${phrase}`);
  assert.match(project, /normalizeReviewWorkspace/);
});

test("guided logline candidates require explicit approval", async () => {
  const operations = await source("lib/pitch-review.ts");
  const workspace = await source("app/pitch-review-workspace.tsx");
  assert.match(operations, /buildGuidedLoglineCandidate/);
  assert.match(operations, /saveLoglineCandidate/);
  assert.match(operations, /approveLoglineCandidate/);
  assert.match(operations, /next\.story\.logline = candidate\.text/);
  assert.match(workspace, /Review before saving/);
  assert.match(workspace, /Approve this logline/);
});

test("revision comparison and pitch exports remain inside PlotPickle", async () => {
  const operations = await source("lib/pitch-review.ts");
  const documentation = await source("docs/phase-d-pitch-review.md");
  for (const operation of ["compareRevisionSnapshotsForReview", "buildPitchPackageHtml", "buildPresentationMarkdown", "pitchExportFileNames"]) assert.match(operations, new RegExp(`export function ${operation}\\b`), `Missing ${operation}`);
  for (const phrase of ["Save as PDF", "self-contained shareable pitch package", "slide-separated Markdown", "without leaving PlotPickle"]) assert.ok(documentation.includes(phrase), `Missing Phase D contract: ${phrase}`);
});

test("the specialist hub links review to the existing story workflow", async () => {
  const hub = await source("app/engine-hub.tsx");
  assert.match(hub, /Pitch & Review Studio/);
  assert.match(hub, /href: "\/pitch-review"/);
  assert.match(hub, /Anchored comments/);
  assert.match(hub, /Pitch exports/);
});
