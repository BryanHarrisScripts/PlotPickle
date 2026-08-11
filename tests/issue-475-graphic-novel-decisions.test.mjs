import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#475 exposes the five approved Graphic Novel human decisions", async () => {
  const host = await source("app/graphic-novel-studio-host.tsx");
  for (const action of ["Keep", "Change", "Try", "Compare", "Approve"]) {
    assert.ok(host.includes(`button(\"${action}\"`), `Missing Graphic Novel decision: ${action}`);
  }
  assert.match(host, /Only Approve promotes the selected candidate/);
  assert.match(host, /Candidate · not canon/);
});

test("#475 Keep Change Try and Compare are non-destructive and never start paid generation", async () => {
  const host = await source("app/graphic-novel-studio-host.tsx");
  assert.match(host, /Candidate kept for this review\. Canon is unchanged until Approve/);
  assert.match(host, /Change direction saved for this review\. Approved canon is unchanged/);
  assert.match(host, /Trying \$\{versions\[selectedIndex\]\.label\}\. Canon is unchanged/);
  assert.match(host, /Comparing two candidates side by side\. No canon changed/);
  assert.match(host, /Try never starts a paid request silently/);
  assert.doesNotMatch(host, /fetch\(|\/api\/local-ai|provider|apiKey|Ollama|ComfyUI|MiniMax/i);
});

test("#475 approval promotes the selected existing asset variation explicitly", async () => {
  const [host, approval] = await Promise.all([
    source("app/graphic-novel-studio-host.tsx"),
    source("lib/graphic-novel-approval.ts"),
  ]);
  assert.match(host, /approveGraphicNovelAssetVersion\(project, panel\.id, version\.reference\)/);
  assert.match(host, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(approved\)\)/);
  assert.match(approval, /selectGraphicNovelAssetVersion\(project, panelId, reference\)/);
  assert.match(approval, /approvedVariationId: reference\.variationId/);
  assert.match(approval, /approval: "approved" as const/);
  assert.match(approval, /metadata: \{ \.\.\.selected\.metadata, updatedAt: now \}/);
});

test("#475 decision state stays outside canonical project until approval", async () => {
  const host = await source("app/graphic-novel-studio-host.tsx");
  assert.match(host, /const reviewKey = `plotpickle\.graphicNovelReview\.\$\{panel\.id\}`/);
  assert.match(host, /sessionStorage\.setItem\(reviewKey, JSON\.stringify\(saved\)\)/);
  assert.match(host, /sessionStorage\.removeItem\(reviewKey\)/);
  assert.match(host, /graphicNovelAssetVersions\(project, panel\)/);
});

test("#475 decision UI stays within the reviewed dark teal-orange PlotPickle system", async () => {
  const styles = await source("app/graphic-novel-studio.css");
  assert.match(styles, /graphic-novel-decisions/);
  assert.match(styles, /graphic-novel-candidate/);
  assert.match(styles, /graphic-novel-decision-actions/);
  assert.match(styles, /background:#22bfae!important/);
  assert.match(styles, /color:#8abf78/);
  assert.doesNotMatch(styles, /purple|violet|#7c3aed|#8b5cf6/i);
});
