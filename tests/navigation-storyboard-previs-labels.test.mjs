import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const navigationFiles = [
  "modules/learn/ui/learn-workspace.tsx",
  "modules/plan/ui/foundations-plan-workspace.tsx",
  "modules/wyrmwood/ui/wyrmwood-workspace.tsx",
];

test("workflow navigation shows Storyboard / Sketch and Previs / Visualize consistently", async () => {
  const files = await Promise.all(navigationFiles.map(read));
  for (const source of files) {
    assert.match(source, /label: "Storyboard", detail: "Sketch"/);
    assert.match(source, /label: "Previs", detail: "Visualize"/);
    assert.doesNotMatch(source, /label: "Sketch", detail: "Visualize"/);
    assert.doesNotMatch(source, /label: "Visualize", detail: "Pages"/);
  }
});
