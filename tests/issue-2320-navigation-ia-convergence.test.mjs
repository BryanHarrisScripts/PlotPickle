import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2320 flattens Human navigation without changing feature authority", async () => {
  const [menu, dashboard, learn, explore, storyMode, reviewHost, flowCss, registryText] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/learn-journey-preview.tsx"),
    read("app/skin-v1/learn-explore.tsx"),
    read("app/skin-v1/story-mode-host.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/preproduction-review-flow.css"),
    read("config/skin-v1-surface-registry.json"),
  ]);

  assert.match(menu, /id: "reports", shortcut: "A", label: "Reports"/u);
  assert.doesNotMatch(menu, /label: "Analytics"/u);

  assert.match(learn, /useState\(false\)/u);
  assert.match(learn, /aria-label="LEARN menu"/u);
  assert.match(learn, />6 PATHS \/ 24 CRAFT MODULES</u);
  assert.doesNotMatch(learn, /<h1>LEARN JOURNEY<\/h1>/u);
  assert.match(learn, />Back to Dashboard<\/button>/u);
  assert.match(explore, />Back to Learn<\/button>/u);

  for (const [id, shortcut, label] of [
    ["general", "G", "General"],
    ["local", "L", "Local"],
    ["cloud", "C", "Cloud"],
    ["hybrid", "H", "Hybrid"],
    ["node-info", "I", "Node Info"],
    ["agents", "A", "Agents"],
    ["ai-routing", "R", "AI Routing"],
    ["buzz-settings", "B", "BUZZ Settings"],
  ]) {
    assert.match(dashboard, new RegExp(`id: "${id}"[\\s\\S]*shortcut: SETTINGS_SHORTCUTS[\\s\\S]*label: "${label}"`, "u"), id);
    assert.ok(dashboard.includes(`${JSON.stringify(id).slice(1,-1)}`) || shortcut);
  }
  assert.doesNotMatch(dashboard, /id: "story-mode"/u);
  assert.match(storyMode, /onReturnToSettings/u);
  assert.match(storyMode, /Back to Settings/u);

  for (const [id, shortcut] of [["outline","O"],["storyboard","S"],["previs","P"],["timeline","T"],["production","D"]]) {
    assert.match(reviewHost, new RegExp(`id: "${id}", label: "[^"]+", shortcut: "${shortcut}"`, "u"), id);
  }
  assert.match(reviewHost, /data-horizontal-directory-reference="library"/u);
  assert.match(reviewHost, /aria-keyshortcuts=\{stage\.shortcut\}/u);
  assert.match(flowCss, /pp-skin-v1-preproduction-stage-rail[\\s\\S]*background: var\(--pp-skin-accent-deep\)/u);

  const registry = JSON.parse(registryText);
  const byId = new Map(registry.surfaces.map((surface) => [surface.id, surface]));
  for (const id of ["local-ai", "cloud-story-mode", "hybrid-story-mode"]) {
    assert.equal(byId.get(id)?.parent, "settings", id);
  }
  assert.equal(byId.get("story-mode")?.runtimeSelector, "section[aria-label='Settings menu']");
});
