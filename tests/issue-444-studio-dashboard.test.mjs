import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#444 Phase A Dashboard follows approved PlotPickle Studio wireframe", async () => {
  const [dashboard, styles, entry] = await Promise.all([
    source("app/dashboard-story-library.tsx"),
    source("app/dashboard-story-library.module.css"),
    source("app/dashboard-command-centre.tsx"),
  ]);

  for (const contract of [
    "PlotPickle Studio",
    "Your stories.",
    "Available stories",
    "Poster artwork becomes each story’s visual identity.",
    "Load Afterglow",
    "never loaded automatically",
    "4 Acts · 24 Blocks · 96 mini-blocks",
    "Storyboard",
    "Write",
    "Edit",
    "Graphic Novel",
    "Build",
    "Feedback",
    "Refine",
  ]) assert.ok(dashboard.includes(contract), `Missing Studio Dashboard contract: ${contract}`);

  assert.match(entry, /<DashboardStoryLibrary/);
  assert.doesNotMatch(entry, /ComputeHubDashboard|SetupConnectionsDashboard|Five-second readiness check/);
  assert.match(dashboard, /createAfterglowProject/);
  assert.match(dashboard, /AFTERGLOW_EXAMPLE_ACTIVE_KEY/);
  assert.match(dashboard, /storyPoster\(project\)/);
  assert.match(styles, /#cda758/i, "gold accent token should be present");
  assert.match(styles, /min-height:\s*calc\(100vh/i, "Dashboard should use the available desktop height");
  assert.match(styles, /grid-template-columns:\s*repeat\(11/i, "workflow strip should expose the complete module sequence");
});

test("#444 Phase A keeps technical configuration outside the primary story cards", async () => {
  const dashboard = await source("app/dashboard-story-library.tsx");
  assert.doesNotMatch(dashboard, /Ollama|ComfyUI|MiniMax|checkpoint|endpoint/i);
  assert.match(dashboard, /openWorkspace\("settings"\)/);
});
