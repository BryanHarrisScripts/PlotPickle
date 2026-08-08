import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#483 mounts Feedback as a Studio continuity layer without replacing the working review engine", async () => {
  const [layout, host, workspace] = await Promise.all([
    source("app/layout.tsx"),
    source("app/feedback-studio-host.tsx"),
    source("app/feedback-workspace.tsx"),
  ]);

  assert.match(layout, /import FeedbackStudioHost/);
  assert.match(layout, /<FeedbackStudioHost \/>/);
  assert.match(layout, /feedback-studio\.css/);
  assert.match(host, /aside\[aria-label="Feedback sections"\]/);
  assert.match(workspace, /createStoredFeedbackModel/);
  assert.match(workspace, /ReviewWorkflowsPanel/);
  assert.match(workspace, /WritersRoomPanel/);
});

test("#483 carries canonical Act Block mini-block and owning scene identity into Feedback", async () => {
  const host = await source("app/feedback-studio-host.tsx");

  assert.match(host, /const STORAGE_KEY = "plotpickle\.project\.v1"/);
  assert.match(host, /normalizePlotPickleProject\(JSON\.parse\(stored\)\)/);
  assert.match(host, /requestedNumber\("block", 1, 1, 24\)/);
  assert.match(host, /requestedNumber\("mini", 1, 1, 4\)/);
  assert.match(host, /buildGlobalSceneIndex\(project\.blocks\)/);
  assert.match(host, /Act \$\{block\?\.act/);
  assert.match(host, /Block \$\{blockNumber\}/);
  assert.match(host, /Mini \$\{blockNumber\}\.\$\{miniBlockNumber\}/);
  assert.match(host, /Scene \$\{sceneEntry\?\.globalNumber/);
});

test("#483 shows storyteller intent and approved upstream context without shadow story state", async () => {
  const host = await source("app/feedback-studio-host.tsx");

  assert.match(host, /Storyteller intent/);
  assert.match(host, /Approved source context/);
  assert.match(host, /screenplay\.draftElements\.filter/);
  assert.match(host, /approvedImageVersionId/);
  assert.match(host, /approvedVariationId/);
  assert.match(host, /buildSequenceApprovals/);
  assert.doesNotMatch(host, /setProject|onProjectChange|createRevisionSnapshot|fetch\(|apiKey|Ollama|ComfyUI|MiniMax/i);
});

test("#483 exposes the approved Feedback categories and exact-position workflow paths", async () => {
  const host = await source("app/feedback-studio-host.tsx");

  for (const label of ["Story", "Structure", "Character", "Dialogue", "Visual direction", "Continuity", "Production / Build"]) {
    assert.match(host, new RegExp(label.replace(" / ", " \/ ")));
  }
  assert.match(host, /Back to Build \$\{blockNumber\}\.\$\{miniBlockNumber\}/);
  assert.match(host, /workspace=build&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/);
  assert.match(host, /Continue to Refine/);
  assert.match(host, /workspace=refine&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/);
});

test("#483 follows the reviewed matte-black warm-gold PlotPickle visual contract", async () => {
  const styles = await source("app/feedback-studio.css");

  assert.match(styles, /#090909/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /Georgia/);
  assert.match(styles, /feedback-studio-context/);
  assert.match(styles, /feedback-category-rail/);
  assert.match(styles, /@media\(max-width:820px\)/);
  assert.doesNotMatch(styles, /purple|violet|#7c3aed|#8b5cf6/i);
});
