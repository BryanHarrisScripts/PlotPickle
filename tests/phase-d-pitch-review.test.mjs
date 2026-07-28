import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function versionAtLeast(version, requiredMinor) {
  const [major, minor] = version.split(".").map(Number);
  return major >= 1 || (major === 0 && minor >= requiredMinor);
}

test("PlotPickle 0.16 keeps the canonical pitch package tools in Pitch", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const page = await source("app/pitch-review/page.tsx");
  const workspace = await source("app/pitch-review-workspace.tsx");
  assert.ok(versionAtLeast(packageJson.version, 16));
  assert.match(packageJson.scripts.test, /phase-d-pitch-review\.test\.mjs/);
  assert.match(page, /PitchReviewWorkspace/);
  for (const label of ["Logline Lab", "Pitch Package", "Exports"]) assert.ok(workspace.includes(label), `Missing Phase D Pitch view: ${label}`);
  assert.match(workspace, /type PitchReviewScope = "pitch" \| "plan"/);
  assert.doesNotMatch(workspace, /scope: "feedback"/);
});

test("review threads anchor to stable canonical project identities", async () => {
  const project = await source("lib/project.ts");
  const operations = await source("lib/pitch-review.ts");
  for (const phrase of ["ReviewAnchorKind", "ReviewThreadStatus", "ReviewComment", "ReviewThread", "ReviewWorkspace", "review: ReviewWorkspace"]) assert.ok(project.includes(phrase), `Missing canonical review field: ${phrase}`);
  for (const phrase of ["screenplay-element", "story-field", "createReviewThread", "addReviewComment", "updateReviewThreadStatus", "resolvedAt"]) assert.ok(`${project}\n${operations}`.includes(phrase), `Missing review operation: ${phrase}`);
  assert.match(project, /normalizeReviewWorkspace/);
});

test("purpose-aware logline candidates require explicit selective approval", async () => {
  const lab = await source("lib/logline-lab.ts");
  const workspace = await source("app/logline-lab.tsx");
  assert.match(lab, /buildLoglineAlternatives/);
  assert.match(lab, /savePurposeAwareCandidate/);
  assert.match(lab, /approvePurposeAwareLogline/);
  assert.match(lab, /if \(targets\.primary\) next\.story\.logline = candidate\.text/);
  assert.match(workspace, /Save editable candidate/);
  assert.match(workspace, /Approve selected targets deliberately/);
  assert.match(workspace, /No candidate becomes canonical automatically/);
});

test("revision comparison and pitch exports remain inside PlotPickle", async () => {
  const operations = await source("lib/pitch-review.ts");
  const documentation = await source("docs/phase-d-pitch-review.md");
  for (const operation of ["compareRevisionSnapshotsForReview", "buildPitchPackageHtml", "buildPresentationMarkdown", "pitchExportFileNames"]) assert.match(operations, new RegExp(`export function ${operation}\\b`), `Missing ${operation}`);
  for (const phrase of ["Save as PDF", "self-contained shareable pitch package", "slide-separated Markdown", "without leaving PlotPickle"]) assert.ok(documentation.includes(phrase), `Missing Phase D contract: ${phrase}`);
});

test("pitch packaging and human review open from separate owning workspaces", async () => {
  const [hub, shelf, route] = await Promise.all([
    source("app/engine-hub.tsx"),
    source("app/workspace-capability-shelf.tsx"),
    source("app/pitch-review/page.tsx"),
  ]);
  assert.doesNotMatch(hub, /Pitch & Review Studio/);
  assert.match(shelf, /Logline, package & exports/);
  assert.match(shelf, /Anchored reviews & revision compare/);
  assert.match(shelf, /\/pitch-review\?scope=pitch&return=pitch/);
  assert.match(route, /requestedScope === "feedback"/);
  assert.match(route, /window\.location\.replace\("\/\?workspace=feedback"\)/);
});
