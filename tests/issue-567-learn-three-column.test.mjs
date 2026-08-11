import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Learn uses the locked three-column Creative Room contract", async () => {
  const page = await readFile("app/page.tsx", "utf8");
  const shell = await readFile("app/learn-three-column-shell.tsx", "utf8");
  const css = await readFile("app/learn-three-column-shell.module.css", "utf8");
  assert.match(page, /LearnThreeColumnShell/);
  assert.match(shell, /Story Navigator/);
  assert.match(shell, /Learn Creative Canvas/);
  assert.match(shell, /Creative Room/);
  assert.match(shell, /PlotPickle Curriculum Guide/);
  assert.match(shell, /PlotPickle curriculum/);
  assert.match(shell, /81 complete modules/);
  assert.match(shell, /Ask PlotPickle/);
  assert.match(shell, /Canon requires approval/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /--charcoal-0/);
  assert.match(css, /--room-teal/);
  assert.match(css, /--room-orange/);
});

test("UI Continuity cleanup does not turn a completed audit into a runtime failure", async () => {
  const source = await readFile("scripts/ui-continuity-agent.mjs", "utf8");
  assert.match(source, /cleanupPluginData/);
  assert.match(source, /maxRetries/);
  assert.match(source, /cleanup warning/);
  assert.doesNotMatch(source, /await client\.close\(\);\s*await rm\(pluginData/);
});

test("candidate Vercel AI SDK and Mastra runtime packages are installed", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.ok(pkg.dependencies?.ai, "ai dependency should be installed");
  assert.ok(pkg.dependencies?.["@mastra/core"], "@mastra/core dependency should be installed");
});
