import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#452 reduces Storyboard to five top-level creative areas", async () => {
  const host = await source("app/storyboard-navigation-groups-host.tsx");

  for (const label of ["Overview", "Story World", "Moments", "Continuity", "Versions"]) {
    assert.ok(host.includes(label), `Missing Storyboard creative area: ${label}`);
  }

  assert.match(host, /Direct the story/);
  assert.match(host, /data\.storyboardRole = "primary"|dataset\.storyboardRole = "primary"/);
  assert.match(host, /button\.dataset\.storyboardRole = config\.role/);
});

test("#452 preserves every existing Storyboard destination as a canonical secondary tool", async () => {
  const host = await source("app/storyboard-navigation-groups-host.tsx");

  for (const destination of [
    "visual overview",
    "characters & identity locks",
    "locations & world",
    "props, vehicles & wardrobe",
    "colour, lighting & language",
    "24-block storyboard",
    "96 mini-block frames",
    "posters, pitch & production",
    "continuity & missing assets",
  ]) assert.ok(host.includes(`"${destination}"`), `Missing canonical Storyboard destination: ${destination}`);

  assert.match(host, /:scope > button:not\(\[data-storyboard-versions\]\)/);
  assert.doesNotMatch(host, /setProject|onChange|localStorage|sessionStorage|createPortal/i);
});

test("#452 progressively discloses and visually groups Story World and Moments subtools", async () => {
  const styles = await source("app/storyboard-navigation-groups.css");

  assert.match(styles, /button\[data-storyboard-role="secondary"\][\s\S]*display:\s*none/i);
  assert.match(styles, /data-storyboard-area="world"/);
  assert.match(styles, /data-storyboard-area="moments"/);
  assert.match(styles, /display:\s*flex !important/);
  assert.match(styles, /margin-left:\s*18px/);
  assert.match(styles, /data-storyboard-area="world"\]\[data-storyboard-role="secondary"\][\s\S]*order:\s*21/i);
  assert.match(styles, /data-storyboard-area="moments"\]\[data-storyboard-role="primary"\][\s\S]*order:\s*30/i);
});

test("#452 Versions is a review lens over the selected canonical moment, not a parallel model", async () => {
  const host = await source("app/storyboard-navigation-groups-host.tsx");

  assert.match(host, /findCanonical\("96 mini-block frames"\)\?\.click\(\)/);
  assert.match(host, /Review generated versions/);
  assert.match(host, /storyboard-decisions/);
  assert.match(host, /visual-frames/);
  assert.match(host, /versionsActive/);
  assert.doesNotMatch(host, /fetch\(|\/api\/|provider|checkpoint|endpoint|apiKey/i);
});

test("#452 mounts grouped Storyboard navigation only as UI hierarchy", async () => {
  const layout = await source("app/layout.tsx");

  assert.match(layout, /import StoryboardNavigationGroupsHost/);
  assert.match(layout, /<StoryboardNavigationGroupsHost \/>/);
  assert.match(layout, /storyboard-navigation-groups\.css/);
});
