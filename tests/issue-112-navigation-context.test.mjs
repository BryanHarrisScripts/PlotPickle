import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #112 follows the current ordered workflow-group application shell", async () => {
  const direction = await source("lib/product-direction.ts");
  for (const label of ["Discovery & Pre-Production", "Production & Polishing", "Project actions", "Application configuration"]) {
    assert.ok(direction.includes(label), `Missing shell zone: ${label}`);
  }
  for (const label of ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Pitch", "Build", "Feedback", "Refine", "Reports"]) {
    assert.ok(direction.includes(`\"${label}\"`), `Missing workflow item: ${label}`);
  }
  for (const label of ["New Project", "Import", "Export", "Load Afterglow"]) {
    assert.ok(direction.includes(label), `Missing project action: ${label}`);
  }
});

test("Introduction is retained as a compatible deep workspace, not a primary step", async () => {
  const direction = await source("lib/product-direction.ts");
  const primary = direction.slice(direction.indexOf("PRIMARY_WORKFLOW_NAVIGATION"), direction.indexOf("PRODUCT_NAVIGATION"));
  assert.match(direction, /ProductNavigationId[^;]*"instructions"/);
  assert.doesNotMatch(primary, /instructions|Introduction/);
  assert.match(primary, /id: "learn"[\s\S]*introduction and terminology/);
});

test("issue #112 context model preserves required working selections", async () => {
  const context = await source("lib/workspace-context.ts");
  for (const field of [
    "workspace",
    "submenu",
    "blockId",
    "miniBlockId",
    "sceneId",
    "characterId",
    "feedbackTargetId",
    "inspector",
    "filter",
    "zoom",
    "boardPosition",
    "scrollPosition",
  ]) {
    assert.ok(context.includes(field), `Missing context field: ${field}`);
  }
  assert.match(context, /restorePreviousContext/);
  assert.match(context, /previous: history\.current/);
});

test("issue #170 makes Introduction the first visible Learn section without adding a primary step", async () => {
  const [page, direction] = await Promise.all([
    source("app/page.tsx"),
    source("lib/product-direction.ts"),
  ]);
  const primary = direction.slice(direction.indexOf("PRIMARY_WORKFLOW_NAVIGATION"), direction.indexOf("PRODUCT_NAVIGATION"));
  const labels = [...primary.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(labels, ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Pitch", "Build", "Feedback", "Refine", "Reports"]);
  assert.doesNotMatch(primary, /Introduction|instructions/);
  assert.match(page, /type LearnSection = "introduction" \| "library" \| "terminology" \| "screenplay"/);
  assert.match(page, /useState<LearnSection>\("introduction"\)/);
  const learnStart = page.indexOf('aria-label="Learn sections"');
  const learnTabs = page.slice(learnStart, page.indexOf("</nav>", learnStart));
  assert.ok(learnTabs.indexOf(">Introduction<") < learnTabs.indexOf(">Complete Learning Library<"));
  assert.ok(learnTabs.indexOf(">Complete Learning Library<") < learnTabs.indexOf(">Terminology<"));
  assert.match(page, /activeTab === "instructions"[\s\S]*<Introduction/);
  assert.match(page, /function Introduction/);
  assert.match(page, /workspace="Introduction"/);
  assert.doesNotMatch(page, /workspace="Instructions"/);
  assert.match(page, /id: "simpleStart"[\s\S]*label: "Simple Start"[\s\S]*group: "Project"/);
});

test("issue #170 removes nested navigation pills and uses an accessible underline", async () => {
  const [header, css] = await Promise.all([
    source("app/application-shell-header.tsx"),
    source("app/premium-ui.css"),
  ]);
  const issueCss = css.slice(css.indexOf("Issue #170"));
  assert.match(header, /aria-current=\{activeTab === id \? "page" : undefined\}/);
  assert.match(header, /Discovery &amp; Pre-Production/);
  assert.match(header, /Production &amp; Polishing/);
  assert.match(issueCss, /\.application-shell-header \.main-tabs,[\s\S]*border: 0;[\s\S]*border-radius: 0;[\s\S]*background: transparent;/);
  assert.match(issueCss, /\.application-shell-header \.main-tabs button\.active\s*\{[\s\S]*background: transparent;[\s\S]*font-weight: 860;/);
  assert.match(issueCss, /\.application-shell-header \.main-tabs button\.active::after\s*\{\s*background: #8edbc9;/);
  assert.match(issueCss, /\.application-shell-header \.shell-zone-production\s*\{[\s\S]*border-left: 1px solid/);
  assert.match(issueCss, /\.learn-section-tabs button\.active::after\s*\{\s*background: #8edbc9;/);
});

test("issue #112 supplies reusable live shell, Build and Feedback components", async () => {
  const [header, build, buildOrder, feedback] = await Promise.all([
    source("app/application-shell-header.tsx"),
    source("app/build-workspace.tsx"),
    source("lib/build-workspace-order.ts"),
    source("app/feedback-workspace.tsx"),
  ]);

  assert.match(header, /shell-zone-discovery/);
  assert.match(header, /shell-zone-production/);
  assert.match(header, /shell-zone-project-actions/);
  assert.match(header, /shell-zone-configuration/);
  assert.match(header, /PROJECT_ACTIONS\.map/);

  assert.match(build, /createBuildWorkspaceModel/);
  assert.match(build, /Whole film/);
  assert.match(build, /onProjectChange/);
  assert.match(buildOrder, /canonicalBuildOrder/);
  assert.match(buildOrder, /block\.id/);

  assert.match(feedback, /project\.review\.threads/);
  assert.match(feedback, /Anchored review/);
  assert.match(feedback, /Suggestions do not overwrite the screenplay automatically/);
});
