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
});

test("Architecture Skin remains separate from product Skins and keeps blueprint semantics", () => {
  const skin = read("architecture/architecture-skin.css");
  assert.match(skin, /--arch-cyan:/);
  assert.match(skin, /--arch-amber:/);
  assert.match(skin, /--arch-purple:/);
  assert.doesNotMatch(skin, /--pp-skin-/);
});

test("generated architecture artifacts are deterministic and README is synchronized", () => {
  const run = spawnSync(process.execPath, ["architecture/generate-architecture.mjs", "--check"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

  const readme = read("README.md");
  assert.equal((readme.match(/PLOTPICKLE:ARCHITECTURE:START/g) ?? []).length, 1);
  assert.equal((readme.match(/PLOTPICKLE:ARCHITECTURE:END/g) ?? []).length, 1);
  assert.match(readme, /## ARCHITECTURE/);
  assert.match(readme, /architecture\/plotpickle-architecture\.svg/);

  const svg = read("architecture/plotpickle-architecture.svg");
  assert.match(svg, /Architecture blueprint/i);
  assert.match(svg, /BUZZ \/ COMMUNITY PROVIDER/);
  assert.match(svg, /BRING INTO STORY/);
  assert.match(svg, /PPF Canon/);
});
