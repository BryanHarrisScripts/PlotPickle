import "./issue-1106-painterly-agent-portraits.test.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("#1056 keeps the 17-helper lorebound roster while #1106 owns current portrait presentation", () => {
  assert.equal(helperDirectory.helpers.length, 17, "the current helper roster includes Sage plus sixteen other helpers");
  assert.equal(new Set(helperDirectory.helpers.map((helper) => helper.id)).size, 17);
  assert.equal(helperDirectory.portraitSystem, "painterly-fantasy-v1");
  for (const helper of helperDirectory.helpers) assert.deepEqual(Object.keys(helper).sort(), ["group", "how", "id"]);
});

test("#1056 keeps Sage consistent on the established LEARN compatibility URL", () => {
  const workspace = readFileSync(resolve(root, "modules/learn/ui/learn-workspace.tsx"), "utf8");
  const portraits = readFileSync(resolve(root, "components/agent-portrait.tsx"), "utf8");
  assert.match(workspace, /src="\/assets\/sage-brinewick-v2\.png"/);
  assert.deepEqual(pngDimensions("public/assets/sage-brinewick-v2.png"), [100, 100]);
  assert.match(portraits, /source: "\/assets\/curriculum-guide-master-storyteller\.png"/);
  assert.doesNotMatch(`${workspace}\n${portraits}`, /Sage543x768-v2/i);
});
