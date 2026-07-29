import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("About PlotPickle explains the current product without reviving obsolete commitments", async () => {
  const page = await source("app/about/page.tsx");
  const content = await source("app/about/about-content.ts");
  for (const phrase of [
    "local-first visual storyworld collaboration and previsualization engine",
    "portable PPF project",
    "The writer's decisions define the work",
    "AI is optional and bounded",
    "Suggestions are not canon",
    "Collaboration is deliberate",
    "Rights and provenance travel with the project",
    "Previsualize before full production",
    "Extend before duplicating",
    "Extensible core, optional integrations",
  ]) assert.ok(`${page}\n${content}`.includes(phrase), `Missing current principle: ${phrase}`);
  assert.match(page, /does not aim to replace Final Draft|not a studio production or finishing pipeline/i);
  assert.match(page, /not current PlotPickle commitments/i);
});

test("evolution timeline connects Afterglow, 24 Blocks, OpenStory and PlotPickle", async () => {
  const content = await source("app/about/about-content.ts");
  for (const stage of [
    "Afterglow on the page",
    "24 Blocks as a shared story language",
    "OpenStory Studio experiments",
    "One connected visual storyworld",
    "The interactive Storyworld Map",
  ]) assert.ok(content.includes(stage), `Missing evolution stage: ${stage}`);
  assert.match(content, /Architect, Plus and Visualizer GPTs/);
  assert.match(content, /provider-independent AI/i);
});

test("page-to-production diagram uses one canonical project across all stages", async () => {
  const content = await source("app/about/about-content.ts");
  for (const stage of ["Story Logic", "Canon and Characters", "24 Blocks", "96 Mini-Blocks", "Screenplay", "Storyworld Map", "Graphic Novel and Storyboard", "Production Shots", "Retained Visual Assets", "Animatic Preview", "Pitch and Reports"]) {
    assert.ok(content.includes(`"${stage}"`), `Missing page-to-production stage: ${stage}`);
  }
});

test("legacy convergence map explains separate GPT and repository evolution", async () => {
  const content = await source("app/about/about-content.ts");
  for (const legacy of ["OpenStory Architect", "OpenStory Plus", "OpenStory Visualizer", "GPT prompt front ends", "GitHub screenplay repository", "Story Education Menu", "Afterglow public experiment", "CrewAI coordinator", "Real-time collaborative editing"]) {
    assert.ok(content.includes(legacy), `Missing legacy convergence item: ${legacy}`);
  }
  assert.match(content, /Possible future plugin or SDK experiment, not required core architecture/);
  assert.match(content, /Out of scope; PlotPickle focuses on storyworld coordination and reviewable proposals/);
});

test("both legacy READMEs are mapped section by section with explicit disposition", async () => {
  const mapping = await source("docs/history/legacy-readme-map.md");
  assert.match(mapping, /BryanHarrisScripts\.github\.io\/README\.md/);
  assert.match(mapping, /24-Blocks-OpenStoryStudio\/README\.md/);
  for (const disposition of ["Retained", "Revised", "Archived", "Retired", "Deferred", "Consolidated"]) assert.ok(mapping.includes(disposition), `Missing disposition: ${disposition}`);
  for (const retired of ["Micropayments", "NFTs", "blockchain", "DAO governance", "Required OpenAI subscription", "Stale WGA", "blanket authorship", "public/open contribution by default"]) {
    assert.ok(mapping.toLowerCase().includes(retired.toLowerCase()), `Missing retired mapping: ${retired}`);
  }
});

test("historical document separates origins from roadmap, licensing and legal guidance", async () => {
  const history = await source("docs/history/from-openstory-to-plotpickle.md");
  assert.match(history, /Historical document — this records earlier experiments and is not the current PlotPickle roadmap, feature list, licensing policy or legal guidance/);
  assert.match(history, /The writer's decisions define the work/);
  assert.match(history, /personal mental-health self-guidance is not presented as a universal software philosophy/i);
  assert.match(history, /AGPL-3\.0-or-later/);
  assert.match(history, /User-created stories are not automatically licensed/);
});

test("Why PlotPickle Works in Layers is a complete learning module with legacy aliases", async () => {
  const lesson = await source("app/learning-why-plotpickle.ts");
  for (const phrase of [
    "Why PlotPickle Works in Layers",
    "One story, several useful resolutions",
    "One canonical project",
    "From page to production",
    "How the method evolved",
    "OpenStory Studio",
    "Architect",
    "Plus",
    "Visualizer",
    "Your Actions Define You",
    "CrewAI",
  ]) assert.ok(lesson.includes(phrase), `Missing lesson content: ${phrase}`);
  for (const field of ["objectives:", "sections:", "definitions:", "example:", "checklist:", "mistakes:", "exercise:", "apply:", "tags:"]) assert.ok(lesson.includes(field), `Missing lesson field: ${field}`);
});

test("product integration links About from README, Project Overview and Read & Learn", async () => {
  const readme = await source("README.md");
  const overview = await source("app/project-overview.tsx");
  const studio = await source("app/learning-studio.tsx");
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(readme, /About PlotPickle/);
  assert.match(readme, /from-openstory-to-plotpickle/);
  assert.match(overview, /Why PlotPickle/);
  assert.match(overview, /href="\/about"/);
  assert.match(studio, /whyPlotPickleWorksInLayers/);
  assert.match(studio, /whyPlotPickleSearchText/);
  assert.ok(packageJson.scripts.test.includes("issue-59-about-origins-principles.test.mjs"));
});
