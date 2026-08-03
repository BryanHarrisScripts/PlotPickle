import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const integrationLabels = [
  "Story & Art",
  "Repository & Collab",
  "Scheduling & Meetings",
  "Media & Film Engines",
];

test("core consolidation presents four truthful optional connection areas", async () => {
  const [panel, statuses, dashboard, reports] = await Promise.all([
    source("app/settings-panel-legacy.tsx"),
    source("lib/connection-status.ts"),
    source("lib/dashboard-command-centre.ts"),
    source("lib/consolidated-reports.ts"),
  ]);
  const menu = panel.slice(panel.indexOf("const SETTINGS_GROUPS"), panel.indexOf("const SETTINGS_SECTIONS"));
  let previous = -1;
  for (const label of integrationLabels) {
    const index = menu.indexOf(`label: "${label}"`);
    assert.ok(index > previous, `Connections is missing or out of order: ${label}`);
    previous = index;
    assert.ok(`${statuses}\n${dashboard}\n${reports}`.includes(label), `Shared status is missing: ${label}`);
  }
  assert.match(panel, /PlotPickle's complete visual storyworld remains usable with no AI connection/);
  assert.match(panel, /GitHub is the supported optional repository connection/);
  assert.match(panel, /disconnected until you choose them/);
  assert.match(panel, /Use only connections PlotPickle can actually configure and test/);
});

test("core consolidation retires unsupported media-provider placeholders", async () => {
  const [settings, panel, taxonomy] = await Promise.all([
    source("lib/ai/settings.ts"),
    source("app/settings-panel-legacy.tsx"),
    source("config/settings-system-taxonomy.json"),
  ]);
  assert.match(settings, /SETTINGS_VERSION = "1\.3\.0"/);
  assert.match(settings, /defaultMediaEnginePlaceholders: PluginSetting\[\] = \[\]/);
  for (const legacy of ["future-knowledge", "future-publishing", "future-collaboration", "future-pika", "future-runway", "future-media-engine"]) {
    assert.ok(settings.includes(legacy), `Missing safe placeholder retirement: ${legacy}`);
  }
  assert.doesNotMatch(`${panel}
${taxonomy}`, /Pika Labs|Runway|Additional media & film engines/);
  assert.match(panel, /Unsupported provider placeholders are hidden until a working connector exists/);
});

test("core consolidation sells the completed Storyworld Map rather than an unfinished renderer roadmap", async () => {
  const [contract, splash, about, welcome, readme] = await Promise.all([
    source("lib/product-direction.ts"),
    source("app/marketing-splash-base.tsx"),
    source("app/about/page.tsx"),
    source("app/welcome/page.tsx"),
    source("README.md"),
  ]);
  const publicCopy = `${contract}\n${splash}\n${about}\n${welcome}\n${readme}`;
  for (const phrase of [
    "Visual storyworld collaboration and previsualization engine",
    "Interactive Storyworld Map",
    "A clearer case for the movie",
    "The complete visual storyworld core",
    "The core works without external APIs",
  ]) assert.ok(publicCopy.includes(phrase), `Missing completed-core sales message: ${phrase}`);
  assert.doesNotMatch(`${splash}\n${about}\n${welcome}\n${readme}`, /Conversion roadmap/);
  assert.doesNotMatch(`${splash}\n${about}\n${welcome}\n${readme}`, /work toward a watchable prototype/i);
  assert.equal([...contract.matchAll(/statusLabel: "Available now"/g)].length, 5);
});

test("core consolidation README displays the official header logo and connection boundary", async () => {
  const readme = await source("README.md");
  assert.ok(
    readme.includes("public/brand/plotpickle-header-horizontal-1200.png"),
    "README is missing the official horizontal PlotPickle header logo",
  );
  for (const label of integrationLabels) assert.ok(readme.includes(`**${label}**`), `README is missing connection area: ${label}`);
  assert.match(readme, /Future extension; no active API/);
  assert.match(readme, /not active development commitments/);
});

test("core consolidation regression is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /core-consolidation\.test\.mjs/);
  assert.equal(packageJson.scripts["test:core-consolidation"], "node --test tests/core-consolidation.test.mjs");
});
