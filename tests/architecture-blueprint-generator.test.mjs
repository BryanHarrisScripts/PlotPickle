import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

test("architecture blueprint is machine-readable and preserves the seven target layers", () => {
  const architecture = JSON.parse(read("architecture/plotpickle.architecture.json"));
  assert.equal(architecture.layers.length, 7);
  assert.deepEqual(architecture.layers.map((layer) => layer.number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(architecture.layers[0].id, "experience-skins");
  assert.equal(architecture.layers[4].id, "story-canon");
  assert.equal(architecture.layers[6].id, "verification");
  assert.match(architecture.community.title, /BUZZ \/ COMMUNITY PROVIDER/);
  assert.match(architecture.bridge.footer, /never writes story canon directly/i);
  assert.ok(architecture.layers.every((layer) => layer.components.every((component) => component.title && component.detail)));
});

test("Architecture Skin remains separate from product Skins and keeps blueprint semantics", () => {
  const skin = read("architecture/architecture-skin.css");
  assert.match(skin, /--arch-cyan:/);
  assert.match(skin, /--arch-amber:/);
  assert.match(skin, /--arch-purple:/);
  assert.match(skin, /--arch-green:/);
  assert.doesNotMatch(skin, /--pp-skin-/);
  assert.doesNotMatch(skin, /https?:\/\//);
});

test("full blueprint renders component-level engineering detail at a large readable canvas", () => {
  const architecture = JSON.parse(read("architecture/plotpickle.architecture.json"));
  const svg = read("architecture/plotpickle-architecture.svg");
  assert.match(svg, /data-projection="full-blueprint"/);
  assert.match(svg, /viewBox="0 0 2400 1380"/);
  assert.match(svg, /BUZZ \/ COMMUNITY PROVIDER/);
  assert.match(svg, /BRING INTO STORY/);
  assert.match(svg, /CORE PRINCIPLES/);
  assert.match(svg, /READING THE DIAGRAM/);
  assert.match(svg, /PPF Canon/);
  for (const layer of architecture.layers) {
    for (const component of layer.components) {
      assert.ok(svg.includes(`data-component="${component.title.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`), `missing full-blueprint component ${component.title}`);
      const firstDetailWord = component.detail.split(/\s+/)[0].replaceAll("&", "&amp;");
      assert.ok(svg.includes(firstDetailWord), `missing detail text for ${component.title}`);
    }
  }
  assert.doesNotMatch(svg, /fonts\.googleapis|jsdelivr|unpkg|<script|@import/i);
  assert.doesNotMatch(svg, /var\(--arch-/);
});

test("README uses a separate compact overview and links to the full blueprint", () => {
  const overview = read("architecture/plotpickle-architecture-overview.svg");
  assert.match(overview, /data-projection="readme-overview"/);
  assert.match(overview, /viewBox="0 0 1200 720"/);
  assert.match(overview, /FULL BLUEPRINT AVAILABLE/);
  assert.doesNotMatch(overview, /fonts\.googleapis|jsdelivr|unpkg|<script|@import/i);

  const readme = read("README.md");
  assert.equal((readme.match(/PLOTPICKLE:ARCHITECTURE:START/g) ?? []).length, 1);
  assert.equal((readme.match(/PLOTPICKLE:ARCHITECTURE:END/g) ?? []).length, 1);
  assert.match(readme, /## ARCHITECTURE/);
  assert.match(readme, /plotpickle-architecture-overview\.svg/);
  assert.match(readme, /Open the full-resolution Architecture Blueprint/);
  assert.match(readme, /\(architecture\/plotpickle-architecture\.svg\)/);
});

test("generated architecture projections and managed README section are deterministic", () => {
  const run = spawnSync(process.execPath, ["architecture/generate-architecture.mjs", "--check"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /full blueprint, README overview/i);
});
