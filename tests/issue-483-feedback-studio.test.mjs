import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#483 keeps the retired workspace alias as a route bridge instead of a second Feedback presentation", async () => {
  const [layout, host, page, workspace] = await Promise.all([
    source("app/layout.tsx"),
    source("app/feedback-studio-host.tsx"),
    source("app/feedback/page.tsx"),
    source("app/feedback-workspace.tsx"),
  ]);

  assert.match(layout, /import FeedbackStudioHost/);
  assert.match(layout, /<FeedbackStudioHost \/>/);
  assert.match(host, /parameters\.get\("workspace"\) !== "feedback"/);
  assert.match(host, /parameters\.delete\("workspace"\)/);
  assert.match(host, /window\.location\.replace\(\`\/feedback/);
  assert.doesNotMatch(host, /querySelector|prepend|classList|createElement/);

  assert.match(page, /data-feedback-workspace="canonical"/);
  assert.match(page, /<FeedbackWorkspace/);
  assert.match(workspace, /createStoredFeedbackModel/);
  assert.match(workspace, /ReviewWorkflowsPanel/);
  assert.match(workspace, /WritersRoomPanel/);
});

test("#483 canonical Feedback keeps reviewed-target identity and project persistence in the existing owner", async () => {
  const [page, workspace] = await Promise.all([
    source("app/feedback/page.tsx"),
    source("app/feedback-workspace.tsx"),
  ]);

  assert.match(page, /const STORAGE_KEY = "plotpickle\.project\.v1"/);
  assert.match(page, /normalizePlotPickleProject\(JSON\.parse\(stored\)\)/);
  assert.match(page, /parameters\.get\("target"\)/);
  assert.match(page, /onProjectChange=\{save\}/);
  assert.match(page, /onOpenTarget=\{openTarget\}/);
  assert.match(workspace, /initialTargetId/);
  assert.match(workspace, /FeedbackTargetReference/);
  assert.match(workspace, /project\.review\.threads\.length/);
});

test("#483 canonical Feedback exposes the approved review categories without shadow canon state", async () => {
  const [workspace, model] = await Promise.all([
    source("app/feedback-workspace.tsx"),
    source("lib/unified-feedback.ts"),
  ]);

  for (const label of ["story", "structure", "character", "dialogue", "visual", "continuity", "production"]) {
    assert.ok(model.includes(`"${label}"`), `Missing Feedback category: ${label}`);
  }
  assert.match(workspace, /Suggestions do not overwrite the screenplay automatically/);
  assert.match(workspace, /Canon changes require a separate explicit action/);
  assert.doesNotMatch(workspace, /localStorage|sessionStorage|indexedDB/);
});

test("#483 canonical Feedback remains responsive inside the shared standalone Skin V1 continuity layer", async () => {
  const [styles, continuity] = await Promise.all([
    source("app/feedback-workspace.module.css"),
    source("app/studio-surface-continuity.css"),
  ]);

  assert.match(styles, /grid-template-columns:minmax\(205px,245px\) minmax\(0,1fr\)/);
  assert.match(styles, /@media\(max-width:940px\)/);
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(continuity, /\.standalone-studio-surface/);
  assert.match(continuity, /#090909/i);
  assert.match(continuity, /#22bfae/i);
});
