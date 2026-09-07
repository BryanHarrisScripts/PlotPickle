import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1732 returning DEMO action is portaled into the visible profile chooser action row", async () => {
  const source = await read("app/profile-access/demo/demo-onboarding-boundary.tsx");

  assert.match(source, /import \{ createPortal \} from "react-dom"/u);
  assert.match(source, /findProfileChooserActionRow/u);
  assert.match(source, /textContent \|\| ""\)\.trim\(\) === "Add profile"/u);
  assert.match(source, /addProfile\?\.parentElement instanceof HTMLElement/u);
  assert.match(source, /createPortal\([\s\S]*Try DEMO[\s\S]*returningDemoHost/u);
  assert.match(source, /onClick=\{\(\) => setMode\("demo"\)\}/u);
});

test("#1732 DEMO shortcut is no longer viewport-fixed and remains right-aligned in the chooser actions", async () => {
  const styles = await read("app/profile-access/demo/demo-onboarding-boundary.module.css");
  const block = styles.match(/\.demoShortcut\s*\{([\s\S]*?)\}/u)?.[1] || "";

  assert.match(block, /position:\s*static/u);
  assert.match(block, /margin-left:\s*auto/u);
  assert.match(block, /min-height:\s*44px/u);
  assert.doesNotMatch(block, /position:\s*fixed|\bleft\s*:|\bbottom\s*:/u);
});
