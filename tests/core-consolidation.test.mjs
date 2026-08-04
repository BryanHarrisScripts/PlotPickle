import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const integrationLabels = [
  "Story & Art",
  "Repository & Collab",
  "Scheduling & Meetings",
  "Buzz",
  "Media & Film Engines",
];

test("core consolidation describes the completed visual storyworld core", async () => {
  const [contract, splash, about, welcome, readme] = await Promise.all([
    source("lib/product-contract.ts"),
    source("app/marketing-splash.tsx"),
    source("app/about/page.tsx"),
    source("app/welcome-page.tsx"),
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
  assert.match(readme, /Pika Labs, Runway and other media engines remain future extensions/);
  assert.match(readme, /not active development commitments/);
});

test("core consolidation regression is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /core-consolidation\.test\.mjs/);
  assert.equal(packageJson.scripts["test:core-consolidation"], "node --test tests/core-consolidation.test.mjs");
});
