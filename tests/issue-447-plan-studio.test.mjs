import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#447 Plan follows the approved Studio wireframe before implementation", async () => {
  const wireframe = await source("docs/wireframes/issue-447-plan-studio.md");

  for (const contract of [
    "Plan is the story-architecture workspace",
    "Story",
    "World & Cast",
    "Story Engine",
    "Structure",
    "Canon & Notes",
    "4 Acts",
    "24 Blocks",
    "96 mini-blocks",
    "Visual intention",
    "same canonical PPF object",
    "provider/model/endpoint/checkpoint language never appears",
  ]) assert.ok(wireframe.includes(contract), `Missing Plan wireframe contract: ${contract}`);

  assert.match(wireframe, /Review against #444/);
  assert.match(wireframe, /Implementation gate/);
});

test("#447 Plan default canvas exposes story direction and the 4\/24\/96 architecture", async () => {
  const [plan, styles] = await Promise.all([
    source("app/project-overview.tsx"),
    source("app/project-overview.module.css"),
  ]);

  for (const contract of [
    "Plan · Story Architecture",
    "What is this story really about?",
    "What should the audience see and feel?",
    "Five places to shape one story.",
    "Story Engine",
    "World & Cast",
    "Canon & Notes",
    "4 Acts · 24 Blocks · 96 Mini-blocks",
    "The whole story stays visible.",
    "Selected Story Unit",
    "Mini-blocks for Block",
    "Same PPF story · same canon · same asset lineage · saved locally",
  ]) assert.ok(plan.includes(contract), `Missing Plan Studio contract: ${contract}`);

  assert.match(plan, /project\.development\.conceptCanvas\.desiredVisualImpact/);
  assert.match(plan, /project\.blocks\.filter/);
  assert.match(plan, /onOpenBlock\(block\.number\)/);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /grid-template-columns:\s*repeat\(4/i);
  assert.match(styles, /grid-template-columns:\s*repeat\(5/i);
});

test("#447 keeps Dashboard and Plan as separate Studio surfaces", async () => {
  const [entry, dashboard, plan] = await Promise.all([
    source("app/dashboard-command-centre.tsx"),
    source("app/dashboard-story-library.tsx"),
    source("app/project-overview.tsx"),
  ]);

  assert.match(entry, /DashboardStoryLibrary/);
  assert.match(dashboard, /Your stories\./);
  assert.match(dashboard, /Load Afterglow/);
  assert.doesNotMatch(plan, /Load Afterglow|Your stories\./);
  assert.match(plan, /Plan · Story Architecture/);
});

test("#447 keeps provider mechanics outside normal Plan", async () => {
  const plan = await source("app/project-overview.tsx");
  assert.doesNotMatch(plan, /Ollama|ComfyUI|MiniMax|checkpoint|endpoint|apiKey/i);
  assert.match(plan, />Settings</);
});
