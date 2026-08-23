import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const readme = readFileSync(resolve(root, "README.md"), "utf8");

function assertJpeg(relativePath) {
  const path = resolve(root, relativePath);
  assert.ok(existsSync(path), `README branding asset is missing: ${relativePath}`);
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff");
}

test("#1048 README uses the newly supplied PlotPickle fantasy banners", () => {
  assert.match(readme, /docs\/brand\/plotpickle-banner-dragon-logo\.jpg/);
  assert.match(readme, /docs\/brand\/Plot-Pickle-Architecture\.jpg/);
  assert.match(readme, /alt="PlotPickle dragon, compass-nib emblem and wordmark"/);
  assert.match(readme, /alt="PlotPickle fantasy banner showing LEARN, PLAN and BUILD"/);
  assertJpeg("docs/brand/plotpickle-banner-dragon-logo.jpg");
  assertJpeg("docs/brand/Plot-Pickle-Architecture.jpg");
});

test("#1048 removes retired README branding and the standalone Sage promotional hero", () => {
  assert.doesNotMatch(readme, /plotpickle-header-horizontal-1200\.png/i);
  assert.doesNotMatch(readme, /plotpickle-wordmark-horizontal\.svg/i);
  assert.doesNotMatch(readme, /docs\/brand-sources\/sage-brinewick-v2-master\.png/i);
  assert.doesNotMatch(readme, /sage-brinewick-v5-pp-c1\.png/i);
  assert.doesNotMatch(readme, /Sage543x768-v2/i);
  assert.doesNotMatch(readme, /PlotPickle Playhouse/i);
  assert.doesNotMatch(readme, /\bPlayhouse\b/i);
});

test("#1048 documents the current LEARN PLAN BUILD product instead of parking BUILD", () => {
  assert.match(readme, /Dashboard · Community · LEARN · PLAN · BUILD · Wyrmwood · Settings/);
  assert.match(readme, /LEARN → PLAN → BUILD/);
  assert.match(readme, /Foundations/);
  assert.match(readme, /World/);
  assert.match(readme, /Character is the next Visual Writer frontier/);
  assert.match(readme, /81-lesson curriculum/);
  assert.doesNotMatch(readme, /BUILD workspace is currently parked/i);
});

test("#1048 documents the current Community BBS and shared BUZZ history", () => {
  assert.match(readme, /PlotPickle Community BBS/);
  assert.match(readme, /19% left/);
  assert.match(readme, /56% centre/);
  assert.match(readme, /25% right/);
  assert.match(readme, /same signed BUZZ room history/);
  assert.match(readme, /BUZZ event IDs/);
  assert.match(readme, /Merrin Bellwarden/);
  assert.match(readme, /real connected BUZZ community\/node name/);
  assert.match(readme, /does \*\*not\*\* mean PlotPickle automatically uploads creative work/);
});

test("#1048 keeps Sage documented without changing his approved in-app visual contract", () => {
  assert.match(readme, /Sage Brinewick/);
  assert.match(readme, /Lorekeeper/);
  assert.match(readme, /Sage keeps the established approved portrait and guide presentation/);
});
