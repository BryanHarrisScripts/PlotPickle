import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("main application exposes the grouped project rail and local-only product model", async () => {
  const page = await source("app/page.tsx");
  for (const phrase of [
    'id: "overview", code: "OV", label: "Project Overview"',
    'id: "structureMap", code: "ST", label: "Structure Map"',
    'const groups: StorySectionGroup[] = ["Project", "Foundation", "Structure", "Production"]',
    "One story. Five connected workspaces.",
    "Screenplay",
    "rail-progress alert",
    "ProjectOverview",
    "StructureMapSummary",
    "Open local workspace",
    "Copyright & licensing",
  ]) {
    assert.ok(page.includes(phrase), `Main application is missing: ${phrase}`);
  }
  assert.ok(!page.includes("PlotPickle Online"), "Official product page should not advertise an online PlotPickle edition");
});

test("section progress model covers every visible story section", async () => {
  const progress = await source("lib/project-progress.ts");
  for (const section of [
    "overview",
    "storySetup",
    "pitch",
    "world",
    "characters",
    "ghost",
    "catalyst",
    "foundations",
    "pickle",
    "dialogue",
    "coreModel",
    "structureMap",
    "blocks",
    "storyboard",
    "notes",
  ]) {
    assert.ok(progress.includes(`${section}:`), `Progress model is missing ${section}`);
  }
  assert.ok(progress.includes('section !== "notes"'));
  assert.ok(progress.includes("openQuestions"));
  assert.ok(progress.includes("continuity"));
});

test("overview and structure summary explain their contracts before deeper work", async () => {
  const overview = await source("app/project-overview.tsx");
  const structure = await source("app/structure-map-summary.tsx");
  for (const phrase of [
    "Overall planning coverage",
    "Progress by section",
    "Structure snapshot",
    "Open questions",
    "Your story remains yours",
  ]) {
    assert.ok(overview.includes(phrase), `Project Overview is missing: ${phrase}`);
  }
  for (const phrase of [
    "Structure Map",
    "Open full Structure Engine",
    "4",
    "12",
    "24",
    "48",
    "96",
    "Turning point",
  ]) {
    assert.ok(structure.includes(phrase), `Structure Map is missing: ${phrase}`);
  }
});

test("PlotPickle declares software, method, user, contribution, and brand rights separately", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.version, "0.13.0");
  assert.equal(packageJson.license, "AGPL-3.0-or-later");

  const legal = await source("app/legal/page.tsx");
  const scope = await source("LICENSES.md");
  const contributing = await source("CONTRIBUTING.md");
  const trademarks = await source("TRADEMARKS.md");

  assert.match(legal, /Your story remains yours/);
  assert.match(legal, /GNU Affero General Public License/);
  assert.match(legal, /Creative Commons Attribution-ShareAlike 4\.0/);
  assert.match(legal, /Plesk or WordPress/);
  assert.match(scope, /User-created stories are excluded/);
  assert.match(contributing, /Contributor ownership/);
  assert.match(trademarks, /Modified editions/);
});

test("repository includes the complete AGPL licence text", async () => {
  await access(new URL("LICENSE", root));
  const license = await source("LICENSE");
  assert.match(license, /GNU AFFERO GENERAL PUBLIC LICENSE/);
  assert.match(license, /Remote Network Interaction/);
});
