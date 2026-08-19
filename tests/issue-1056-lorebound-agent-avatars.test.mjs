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

test("#1056 gives every user-facing helper a native 100px lore avatar", () => {
  assert.ok(helperDirectory.helpers.length >= 16, "the established helper roster must not shrink");
  const portraits = new Set();

  for (const helper of helperDirectory.helpers) {
    assert.match(helper.portrait, /^\/assets\/helpers\/lore\/[a-z0-9-]+\.svg$/, `${helper.id} is not using the lore avatar directory`);
    assert.ok(!portraits.has(helper.portrait), `${helper.id} shares a portrait with another helper`);
    portraits.add(helper.portrait);

    const assetPath = resolve(root, "public", helper.portrait.replace(/^\//, ""));
    assert.ok(existsSync(assetPath), `${helper.id} portrait is missing: ${helper.portrait}`);
    const svg = readFileSync(assetPath, "utf8");
    assert.match(svg, /<svg[^>]*\bwidth="100"[^>]*\bheight="100"/i, `${helper.id} is not a native 100 × 100 asset`);
    assert.match(svg, /viewBox="0 0 100 100"/i, `${helper.id} is not a 1:1 100px canvas`);
    assert.match(svg, /shape-rendering="crispEdges"/i, `${helper.id} is missing crisp pixel rendering`);
    assert.match(svg, /<title[^>]*>[^<]+8-bit[^<]+avatar<\/title>/i, `${helper.id} is missing an accessible 8-bit lore title`);
  }
});

test("#1056 keeps Sage consistent on the legacy LEARN URL", () => {
  const workspace = readFileSync(resolve(root, "modules/learn/ui/learn-workspace.tsx"), "utf8");
  assert.match(workspace, /src="\/assets\/sage-brinewick-v2\.png"/);
  assert.deepEqual(pngDimensions("public/assets/sage-brinewick-v2.png"), [100, 100]);
  assert.equal(helperDirectory.helpers.find((helper) => helper.id === "sage-brinewick")?.portrait, "/assets/helpers/lore/sage-brinewick.svg");
});
