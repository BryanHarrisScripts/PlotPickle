import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1732 returning DEMO action is portaled into the visible profile chooser action row", async () => {
  const source = await read("app/profile-access/demo/demo-onboarding-boundary.tsx");

  assert.match(source, /import \{ createPortal \} from "react-dom"/u);
  assert.match(source, /demo-shortcut-placement\.module\.css/u);
  assert.match(source, /findProfileChooserActionRow/u);
  assert.match(source, /textContent \|\| ""\)\.trim\(\) === "Add profile"/u);
  assert.match(source, /addProfile\?\.parentElement instanceof HTMLElement/u);
  assert.match(source, /createPortal\([\s\S]*Try DEMO[\s\S]*returningDemoHost/u);
  assert.match(source, /placement\.insideProfileActions/u);
  assert.match(source, /onClick=\{\(\) => setMode\("demo"\)\}/u);
});

test("#1732 DEMO chooser placement is token-safe and overrides the legacy viewport shortcut only in the chooser", async () => {
  const [placement, legacy] = await Promise.all([
    read("app/profile-access/demo/demo-shortcut-placement.module.css"),
    read("app/profile-access/demo/demo-onboarding-boundary.module.css"),
  ]);

  assert.match(placement, /position:\s*static/u);
  assert.match(placement, /margin-left:\s*auto/u);
  assert.match(placement, /min-height:\s*var\(--pp-touch-target\)/u);
  assert.doesNotMatch(placement, /#[0-9a-f]{3,8}|rgba?\(|hsla?\(|\b\d+(?:\.\d+)?px\b/iu);
  assert.match(legacy, /\.demoShortcut\s*\{[\s\S]*position:\s*fixed/u);
});
