import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#540 gives every Learn card an unambiguous accessible action", async () => {
  const [studio, runner] = await Promise.all([
    source("app/learning-studio.tsx"),
    source("scripts/run-creative-writer-uat.mjs"),
  ]);

  assert.match(studio, /aria-label=\{`Read full module: \$\{module\.title\}`\}/);
  assert.match(studio, /aria-label=\{`\$\{complete \? "Mark incomplete" : "Mark complete"\}: \$\{module\.title\}`\}/);
  assert.equal((runner.match(/clickVisible\("Read full module: The Pitch"\)/g) ?? []).length, 2);
  assert.doesNotMatch(runner, /clickVisible\("Read full module"\)/);
});

test("#540 keeps accessible names usable in the visible-control fallback", async () => {
  const browser = await source("scripts/creative-uat/browser-actions.mjs");
  assert.ok((browser.match(/getAttribute\('aria-label'\) \|\| node\.textContent/g) ?? []).length >= 2);
  assert.match(browser, /style\.display !== 'none'/);
  assert.match(browser, /node\.getClientRects\(\)\.length > 0/);
});

test("#540 makes World and Storyboard direction discoverable on first entry", async () => {
  const [page, storyboard, actions] = await Promise.all([
    source("app/page.tsx"),
    source("app/visual-storyboard.tsx"),
    source("app/creative-director-actions.tsx"),
  ]);

  assert.match(page, /aria-label=\{section\.label\}/);
  assert.match(storyboard, /useState<VisualSection>\("blocks"\)/);
  for (const label of ["Decide what happens to this visual", "Keep", "Change", "Compare"]) assert.ok(actions.includes(label));
});

test("#540 emits each acceptance report once", async () => {
  const [creative, local, launcher] = await Promise.all([
    source("scripts/run-creative-writer-uat.mjs"),
    source("scripts/run-local-browser-uat.mjs"),
    source("scripts/run-creative-writer-uat.ps1"),
  ]);

  assert.doesNotMatch(creative, /process\.stdout\.write\(`\$\{lines\.join/);
  assert.doesNotMatch(local, /process\.stdout\.write\(`\$\{lines\.join/);
  assert.match(creative, /Report: \$\{reportPath\}/);
  assert.match(local, /Report: \$\{reportPath\}/);
  assert.equal((launcher.match(/Get-Content -Raw -Encoding UTF8 \$reportPath/g) ?? []).length, 1);
});

test("#540 verifies splash entry after hydration and links the captured evidence", async () => {
  const runner = await source("scripts/run-creative-writer-uat.mjs");

  assert.match(runner, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
  assert.match(runner, /if \(state\.activeId === "dashboard"\) break/);
  assert.match(runner, /state\?\.activeId !== "dashboard"/);
  assert.match(runner, /agent-plugin\/creative-writer\/\$\{String\(item\.stage\)/);
});

test("#540 makes the exact 30-stage UAT part of the blocking Visual gate", async () => {
  const workflow = await source(".github/workflows/visual.yml");
  assert.match(workflow, /Run exact 30-stage Creative Writer UAT/);
  assert.match(workflow, /node scripts\/run-creative-writer-uat\.mjs/);
  assert.match(workflow, /--artifact-root reports\/creative-writer-uat/);
  assert.match(workflow, /reports\/creative-writer-uat\//);
});

test("#540 only invokes dependency review for dependency graph changes", async () => {
  const workflow = await source(".github/workflows/safety.yml");
  const detection = workflow.slice(
    workflow.indexOf("- name: Detect dependency graph changes"),
    workflow.indexOf("- name: Audit production dependencies"),
  );

  assert.match(detection, /-- package-lock\.json npm-shrinkwrap\.json/);
  assert.doesNotMatch(detection, /-- package\.json/);
});
