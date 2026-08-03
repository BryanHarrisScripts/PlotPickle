import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Issue 208 wrapper replaces only the obsolete shell selector and restores the source", async () => {
  const wrapper = await text("scripts/windows-issue-208-current-shell-runner.mjs");
  const source = await text("scripts/windows-issue-208-smoke.mjs");
  assert.match(source, /document\.querySelector\("\.application-shell-header"\) && active/);
  assert.match(wrapper, /oldShellPredicate/);
  assert.match(wrapper, /active && normalize\(document\.body\?\.innerText\)/);
  assert.match(wrapper, /finally \{/);
  assert.match(wrapper, /writeFile\(sourcePath, originalSource/);
});

test("release wrapper maps the old Advanced Settings copy to the current Settings systems shell", async () => {
  const wrapper = await text("scripts/windows-release-smoke-runner.mjs");
  const source = await text("scripts/windows-release-smoke.mjs");
  assert.match(source, /Configure PlotPickle by system\./);
  assert.match(wrapper, /document\.body\.innerText\.includes\("Workspace"\)/);
  assert.match(wrapper, /document\.body\.innerText\.includes\("Systems"\)/);
  assert.match(wrapper, /Settings systems panel/);
  assert.match(wrapper, /finally \{/);
});

test("release candidate invokes the current navigation wrappers", async () => {
  const workflow = await text(".github/workflows/release-candidate.yml");
  assert.match(workflow, /node scripts\/windows-release-smoke-runner\.mjs/);
  assert.match(workflow, /node scripts\/windows-issue-208-current-shell-runner\.mjs/);
});
