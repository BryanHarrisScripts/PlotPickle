import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Dashboard discovery requires a PlotPickle repository manifest", async () => {
  const model = await source("lib/project-dashboard.ts");
  assert.match(model, /\.plotpickle\/story\.json/);
  assert.match(model, /plotpickle-story-repository/);
  assert.match(model, /projectPath\?\.endsWith\("\.ppf"\)/);
  assert.doesNotMatch(model, /every GitHub repo|all repositories are stories/i);
});

test("Dashboard storage states never claim synchronization without verified hashes and commits", async () => {
  const model = await source("lib/project-dashboard.ts");
  for (const label of [
    "Local only",
    "Local project plus local asset folder",
    "Connected to GitHub — unpublished changes",
    "Synchronized with GitHub",
    "Pull required before contributing",
    "Conflict or review required",
    "Backup/export recommended",
  ]) assert.ok(model.includes(label), `Missing storage label: ${label}`);
  assert.match(model, /localContentHash === input\.lastPublishedContentHash/);
  assert.match(model, /remoteHead === input\.collaboration\.lastPulledCommit/);
  assert.match(model, /remoteHead === input\.collaboration\.lastPushedCommit/);
  assert.match(model, /must not overwrite either version silently/i);
});

test("Dashboard separates the canonical project from binary assets and keeps Settings responsible for private credentials", async () => {
  const model = await source("lib/project-dashboard.ts");
  assert.match(model, /canonical \.ppf project/);
  assert.match(model, /generated binary assets/);
  assert.match(model, /separate asset folder/);
  const settings = await source("app/settings-panel-legacy.tsx");
  assert.match(settings, /label: "Repository & Collab"/);
  assert.match(settings, /private local-server data under your computer account/i);
  assert.match(settings, /excluded from \.ppf projects, reports, exports,(?: browser storage,)? logs and GitHub/i);
});
