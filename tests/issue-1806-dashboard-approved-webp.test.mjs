import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const readText = (relative) => readFile(path.join(root, relative), "utf8");
const readBinary = (relative) => readFile(path.join(root, relative));

test("Issue #1806 packages the approved Dashboard dragon as a Skin V1 WebP", async () => {
  const [assets, dashboard, route, image] = await Promise.all([
    readText("app/skin-v1/skin-v1-assets.ts"),
    readText("app/skin-v1/dashboard-bbs-panel.tsx"),
    readText("app/api/skin-v1/dashboard-art/route.ts"),
    readBinary("public/brand/dashboard/plotpickle-observatory-dragon.webp"),
  ]);

  assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP");
  assert.ok(image.length > 10000, "approved Dashboard artwork must be a real packaged WebP");

  assert.match(assets, /hero: "\/brand\/dashboard\/plotpickle-observatory-dragon\.webp"/u);
  assert.doesNotMatch(assets, /plotpickle-observatory-dragon\.svg/u);
  assert.match(dashboard, /SKIN_V1_ASSETS\.dashboard\.hero/u);
  assert.match(dashboard, /width=\{1200\}/u);
  assert.match(dashboard, /height=\{377\}/u);
  assert.match(dashboard, /priority/u);
  assert.match(route, /plotpickle-observatory-dragon\.webp/u);
  assert.match(route, /contentType: "image\/webp"/u);
});
