import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function versionAtLeast(version, requiredMinor) {
  const [major, minor] = version.split(".").map(Number);
  return major >= 1 || (major === 0 && minor >= requiredMinor);
}

test("PlotPickle 0.15 exposes every specialist lab", async () => {
  const [workspace, hub, packageSource] = await Promise.all([
    read("../app/specialist-labs.tsx"),
    read("../app/engine-hub.tsx"),
    read("../package.json"),
  ]);
  const packageJson = JSON.parse(packageSource);
  assert.ok(versionAtLeast(packageJson.version, 15));
  for (const label of [
    "AI Prompt Lab",
    "Dialogue Lab",
    "Structured Research & Canon Binder",
    "Visual Bible & Mood Boards",
    "Prompt & Generated-Asset Provenance",
    "Saved Specialist Passes",
  ]) assert.ok(workspace.includes(label), `Missing specialist lab: ${label}`);
  assert.ok(hub.includes('href: "/labs"'));
  assert.ok(hub.includes("Specialist Labs"));
});

test("every lab reads and writes the active canonical project", async () => {
  const [route, engine] = await Promise.all([
    read("../app/labs/page.tsx"),
    read("../lib/specialist-labs.ts"),
  ]);
  assert.ok(route.includes('const STORAGE_KEY = "plotpickle.project.v1"'));
  assert.ok(route.includes("normalizePlotPickleProject"));
  assert.ok(route.includes("window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))"));
  assert.ok(engine.includes("cloneProject(project)"));
  assert.ok(engine.includes('schemaVersion: "1.7.0"'));
  assert.ok(engine.includes("_specialistPass"));
});

test("specialist suggestions cannot change the project without approval", async () => {
  const workspace = await read("../app/specialist-labs.tsx");
  for (const boundary of [
    "Nothing changes automatically.",
    "Nothing changes until you approve this suggestion.",
    "Apply approved suggestion",
    "Discard suggestion",
    "The project has not changed.",
    "The screenplay has not changed.",
  ]) assert.ok(workspace.includes(boundary), `Missing approval boundary: ${boundary}`);
  assert.ok(workspace.includes("function approveSuggestion()"));
  assert.ok(workspace.includes("applySpecialistSuggestion(project, review)"));
  assert.ok(workspace.includes("onClick={approveSuggestion}"));
});

test("approved passes preserve before, after, provenance and source records", async () => {
  const engine = await read("../lib/specialist-labs.ts");
  for (const contract of [
    "before: suggestion.before",
    "after: suggestion.after",
    "provenanceId",
    "aiProvenance",
    "attributions",
    "contentHash",
    "savedSpecialistPasses",
    "projectGeneratedAssets",
  ]) assert.ok(engine.includes(contract), `Missing saved-pass contract: ${contract}`);
  assert.ok(engine.includes('humanDecision: suggestion.metadata.humanDecision'));
  assert.ok(engine.includes('retained: true'));
});

test("research and visual labs use existing canonical fields instead of parallel storage", async () => {
  const engine = await read("../lib/specialist-labs.ts");
  assert.ok(engine.includes("next.development.notes.research"));
  assert.ok(engine.includes("next.development.notes.sources"));
  assert.ok(engine.includes("next.rights.attributions"));
  assert.ok(engine.includes("next.world = { ...next.world, visualLanguage: suggestion.after }"));
  assert.ok(!engine.includes("localStorage"));
});
