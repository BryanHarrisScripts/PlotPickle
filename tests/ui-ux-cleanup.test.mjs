import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the coordinated UX cleanup is loaded after the existing global styles", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /navigation-additions\.css";\nimport "\.\/ui-ux-cleanup\.css";\nimport "\.\/engine-ux-cleanup\.css";/);
});

test("primary navigation and project context remain usable on narrower screens", async () => {
  const css = await source("app/ui-ux-cleanup.css");
  for (const phrase of [
    "overflow-x: auto",
    "scroll-snap-type: x proximity",
    ".project-strip",
    "position: sticky",
    "@media (max-width: 1120px)",
    "@media (max-width: 820px)",
    "prefers-reduced-motion",
  ]) {
    assert.ok(css.includes(phrase), `UX cleanup is missing ${phrase}`);
  }
});

test("every dense workspace has a responsive layout and visible control hierarchy", async () => {
  const learning = await source("app/learning-studio.module.css");
  const writer = await source("app/script-workspace.module.css");
  const visual = await source("app/visual-storyboard.module.css");
  const settings = await source("app/settings-panel.module.css");

  assert.match(learning, /\.viewTabs \{[\s\S]*position: sticky/);
  assert.match(learning, /\.moduleCard:hover/);
  assert.match(writer, /grid-template-columns: 220px minmax\(540px, 1fr\) 300px/);
  assert.match(writer, /\.scriptPaper/);
  assert.match(writer, /\.assistantPanel/);
  assert.match(writer, /@media \(max-width: 900px\)/);
  assert.match(visual, /\.inspector/);
  assert.match(visual, /@media \(max-width: 1180px\)/);
  assert.match(settings, /\.connectionPanelConnected/);
  assert.match(settings, /\.removeConnection/);
  assert.match(settings, /@media \(max-width: 1100px\)/);
});

test("the review records decisions for all seven primary workspaces", async () => {
  const review = await source("docs/UI-UX-REVIEW-2026-07.md");
  for (const workspace of ["Instructions", "Read & Learn", "Story Planner", "Screenplay", "Visual Board", "Engines", "Settings"]) {
    assert.match(review, new RegExp(`## ${workspace.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`));
  }
  assert.match(review, /This pass does not change/);
});
