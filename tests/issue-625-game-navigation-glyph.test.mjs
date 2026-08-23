import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("GAME navigation uses the approved standalone relic with a separate WYRMWOOD UI title", async () => {
  const entry = await read("app/wyrmwood-plugin-entry.tsx");

  assert.match(entry, /src="\/assets\/workflow-relics\/game\.webp"/);
  assert.match(entry, /aria-label="Open GAME — Wyrmwood"/);
  assert.match(entry, /className=\{styles\.glyph\}/);
  assert.match(entry, /className=\{styles\.label\}>WYRMWOOD<\/span>/);
  assert.doesNotMatch(entry, /plotpickle-ouroboros-v2-128\.png/);
  assert.doesNotMatch(entry, /<strong>PLAY<\/strong>/);
  assert.doesNotMatch(entry, /<small>Wyrmwood<\/small>/);
});

test("GAME relic asset is a real WebP and navigation-sized source remains substantial", async () => {
  const assetUrl = new URL("../public/assets/workflow-relics/game.webp", import.meta.url);
  const [asset, metadata] = await Promise.all([readFile(assetUrl), stat(assetUrl)]);

  assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
  assert.ok(metadata.size > 10_000, `Expected detailed GAME glyph source, got ${metadata.size} bytes`);
});

test("GAME navigation keeps the transparent logo treatment without a backglow", async () => {
  const css = await read("app/wyrmwood-plugin-entry.module.css");

  assert.match(css, /background:\s*transparent/);
  assert.match(css, /width:\s*58px/);
  assert.match(css, /height:\s*58px/);
  assert.match(css, /\.label/);
  assert.doesNotMatch(css, /drop-shadow/);
  assert.match(css, /filter:\s*saturate\(1\.13\) brightness\(1\.08\)/);
  assert.match(css, /filter:\s*saturate\(1\.22\) brightness\(1\.18\)/);
  assert.match(css, /scale\(1\.055\)/);
});

test("focused Wyrmwood UAT owns the GAME navigation regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const wyrmwood = registry.areas.find((area) => area.id === "wyrmwood");
  assert.ok(wyrmwood?.tests.includes("tests/issue-625-game-navigation-glyph.test.mjs"));
});
