import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const helperDirectory = JSON.parse(readFileSync(resolve(root, "config/helper-directory.json"), "utf8"));

function pngDimensions(path) {
  const png = readFileSync(resolve(root, path));
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${path} is not a PNG`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test("#1056 legacy contract preserves Sage while #1064 advances every other helper to 16-bit full-body art", () => {
  const sage = helperDirectory.helpers.find((helper) => helper.id === "sage-brinewick");
  const nonSage = helperDirectory.helpers.filter((helper) => helper.id !== "sage-brinewick");
  assert.equal(helperDirectory.helpers.length, 17, "the current helper roster includes Sage plus sixteen non-Sage helpers");
  assert.equal(nonSage.length, 16);
  assert.equal(sage?.portrait, "/assets/helpers/lore/sage-brinewick.svg");

  const portraits = new Set();
  for (const helper of nonSage) {
    assert.match(helper.portrait, /^\/assets\/helpers\/16bit\/[a-z0-9-]+\.svg$/, `${helper.id} is not using the 16-bit full-body directory`);
    assert.ok(!portraits.has(helper.portrait), `${helper.id} shares a portrait with another helper`);
    portraits.add(helper.portrait);

    const assetPath = resolve(root, "public", helper.portrait.replace(/^\//, ""));
    assert.ok(existsSync(assetPath), `${helper.id} portrait is missing: ${helper.portrait}`);
    const svg = readFileSync(assetPath, "utf8");
    assert.match(svg, /<svg[^>]*\bwidth="160"[^>]*\bheight="220"/i, `${helper.id} is not a 160 × 220 full-body master`);
    assert.match(svg, /viewBox="0 0 160 220"/i, `${helper.id} is not using the full-body portrait canvas`);
    assert.match(svg, /shape-rendering="crispEdges"/i, `${helper.id} is missing crisp 16-bit rendering`);
    assert.match(svg, /<title[^>]*>[^<]+16-bit full-body lore portrait<\/title>/i, `${helper.id} is missing an accessible 16-bit full-body title`);
  }
});

test("#1056 keeps Sage consistent on the established LEARN compatibility URL", () => {
  const workspace = readFileSync(resolve(root, "modules/learn/ui/learn-workspace.tsx"), "utf8");
  assert.match(workspace, /src="\/assets\/sage-brinewick-v2\.png"/);
  assert.deepEqual(pngDimensions("public/assets/sage-brinewick-v2.png"), [100, 100]);
  assert.equal(helperDirectory.helpers.find((helper) => helper.id === "sage-brinewick")?.portrait, "/assets/helpers/lore/sage-brinewick.svg");
  assert.doesNotMatch(workspace, /Sage543x768-v2/i);
});
