import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1927 keeps the Node surface identity unique while naming the inner detail region separately", async () => {
  const [dashboard, nodePanel] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/node-skin-panel.tsx"),
  ]);

  const combined = `${dashboard}\n${nodePanel}`;
  const surfaceIdentityCount = [...combined.matchAll(/aria-label="Node information"/gu)].length;

  assert.equal(surfaceIdentityCount, 1, "Node information must identify exactly one rendered surface owner");
  assert.match(dashboard, /<section aria-label="Node information"/u);
  assert.match(nodePanel, /aria-label="Node status details"/u);
  assert.doesNotMatch(nodePanel, /aria-label="Node information"/u);
});

test("#1927 preserves strict WebMCP ownership instead of hiding ambiguity with first/nth selectors", async () => {
  const [menuAudit, webmcp, visualDirector, manifest] = await Promise.all([
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
    read("tests/visual-baselines/skin-v1/manifest.json"),
  ]);

  assert.match(menuAudit, /page\.locator\("section\[aria-label='Node information'\]"\)\.waitFor/u);
  assert.doesNotMatch(menuAudit, /section\[aria-label='Node information'\][\s\S]{0,120}\.(?:first|nth)\(/u);
  assert.match(webmcp, /section\[aria-label='Node information'\] \[data-skin-v1-node='true'\]\[data-node-readiness='ready'\]/u);
  assert.match(visualDirector, /node:\s*"section\[aria-label='Node information'\] \[data-skin-v1-node='true'\]\[data-node-readiness='ready'\]"/u);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.surfaces?.node?.selector ?? parsedManifest.node?.selector, "section[aria-label='Node information']");
});
