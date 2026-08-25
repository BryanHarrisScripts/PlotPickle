import "./issue-1106-painterly-agent-portraits.test.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const playhouse = JSON.parse(readFileSync(resolve(root, "plugins/plotpickle-playhouse/community.json"), "utf8"));

function pngDimensions(path) {
  const png = readFileSync(resolve(root, path));
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${path} is not a PNG`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test("#1056/#1399 keeps the canonical 15 public helpers in the Playhouse plugin while internal roles stay out of Help", () => {
  assert.equal(playhouse.agents.length, 15);
  assert.equal(new Set(playhouse.agents.map((helper) => helper.profileId)).size, 15);
  for (const helper of playhouse.agents) {
    assert.deepEqual(Object.keys(helper).sort(), ["helpGroup", "helpPrompt", "profileId", "roomIds", "shortBio"]);
  }
});

test("#1056 preserves the LEARN Sage compatibility asset while the shared profile system uses supplied artwork", () => {
  const workspace = readFileSync(resolve(root, "modules/learn/ui/learn-workspace.tsx"), "utf8");
  const portraits = readFileSync(resolve(root, "components/agent-portrait.tsx"), "utf8");
  const portraitCss = readFileSync(resolve(root, "components/agent-portrait.module.css"), "utf8");
  assert.match(workspace, /src="\/assets\/sage-brinewick-v2\.png"/);
  assert.deepEqual(pngDimensions("public/assets/sage-brinewick-v2.png"), [100, 100]);
  assert.match(portraits, /id: "sage-brinewick"[\s\S]*supplied elder wizard/);
  assert.match(portraitCss, /\/assets\/agent-profile-atlas\.webp/);
  assert.doesNotMatch(`${workspace}\n${portraits}`, /Sage543x768-v2/i);
});
