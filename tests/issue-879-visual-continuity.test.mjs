import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("active PlotPickle workspaces share one three-column continuity contract", async () => {
  const [continuity, shell] = await Promise.all([
    read("app/workspace-continuity.css"),
    read("app/plotpickle-workspace-shell.tsx"),
  ]);

  assert.match(continuity, /--pp-workspace-columns:\s*minmax\(240px, 19%\) minmax\(440px, 56%\) minmax\(300px, 25%\)/);
  assert.match(continuity, /data-active-workspace="learn"/);
  assert.match(continuity, /data-active-workspace="plan"/);
  assert.match(continuity, /data-active-workspace="wyrmwood"/);
  assert.match(continuity, /data-active-workspace="community"/);
  assert.match(continuity, /data-plotpickle-settings="v2"/);
  assert.match(continuity, /@media \(max-width: 1050px\)/);
  assert.match(continuity, /@media \(max-width: 900px\)/);
  assert.match(shell, /data-workspace-frame="true"/);
});

test("Community and Guildhall use PlotPickle teal jade and gold instead of the old orange-led surface", async () => {
  const continuity = await read("app/workspace-continuity.css");

  assert.match(continuity, /--pp-continuity-bg:\s*#07100e/);
  assert.match(continuity, /--pp-continuity-teal:\s*#36d9c2/);
  assert.match(continuity, /--pp-continuity-jade:\s*#2f9d78/);
  assert.match(continuity, /--pp-continuity-gold:\s*#d5ac63/);
  assert.match(continuity, /--community-orange:\s*var\(--pp-continuity-gold\)/);
  assert.match(continuity, /nav\[aria-label="Community sections"\]/);
  assert.match(continuity, /BUZZ carries signed discussion, presence and Guildhall receipts/);
  assert.doesNotMatch(continuity, /#d68a45|#f08a4b/i);
});

test("Settings exposes permanent left categories centre controls and right help without removing capabilities", async () => {
  const settings = await read("app/sage-settings-workspace.tsx");

  assert.match(settings, /data-plotpickle-settings="v2"/);
  assert.match(settings, /data-settings-rail="navigation"/);
  assert.match(settings, /data-settings-main/);
  assert.match(settings, /data-settings-rail="context"/);
  assert.match(settings, /Quick Setup/);
  assert.match(settings, /Models & Agents/);
  assert.match(settings, /Agent Activity & BUZZ/);
  assert.match(settings, /Advanced Runtime/);
  assert.match(settings, /<SageFastModelSetup \/>/);
  assert.match(settings, /<AgentObservabilityPanel \/>/);
  assert.match(settings, /<BuzzLiveHealthCard \/>/);
  assert.match(settings, /<DeepSeekHarnessPanel \/>/);
  assert.match(settings, /<LocalRuntimePanel \/>/);
  assert.match(settings, /Advanced AI routing/);
});

test("README uses the approved repository-resident artwork in the requested roles", async () => {
  const readme = await read("README.md");

  const primary = readme.indexOf("docs/brand-sources/plotpickle-ouroboros-v2-master.png");
  const secondary = readme.indexOf("public/brand/plotpickle-icon-master-transparent.png");
  const sage = readme.indexOf("docs/brand-sources/sage-brinewick-v2-master.png");
  assert.ok(primary >= 0 && primary < readme.indexOf("# PlotPickle"), "the ouroboros/nib master should lead the README");
  assert.ok(secondary > readme.indexOf("### Community"), "the creative/lore emblem should support Community/BUZZ");
  assert.ok(sage > readme.indexOf("## Core agents and lore"), "the Sage portrait should identify the agent/lore section");
  assert.doesNotMatch(readme, /public\/brand\/plotpickle-header-horizontal-transparent\.png/);
  assert.doesNotMatch(readme, /private-user-images\.githubusercontent\.com|chatgpt\.com|oaidalleapiprodscus/i);
});

test("README-only identity change does not replace the live application logo or favicon contract", async () => {
  const [shell, layout] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(shell, /src="\/brand\/plotpickle-ouroboros-v3-transparent\.png"/);
  assert.match(layout, /plotpickle-ouroboros-v2-32\.png/);
  assert.doesNotMatch(shell, /docs\/brand-sources/);
  assert.doesNotMatch(layout, /docs\/brand-sources/);
});

test("exhaustive UAT reads the shared continuity layer on every active screen", async () => {
  const config = JSON.parse(await read("config/exhaustive-ui-uat.json"));
  for (const id of ["entry", "community", "learn", "plan", "wyrmwood", "settings"]) {
    const screen = config.screens.find((candidate) => candidate.id === id);
    assert.ok(screen, `${id} must remain an exhaustive-UAT screen`);
    assert.ok(screen.sourceFiles.includes("app/workspace-continuity.css"), `${id} should expose the continuity layer to the code-aware auditor`);
  }
});

test("parked historical workspaces remain parked while the continuity contract is established", async () => {
  const shell = await read("app/plotpickle-workspace-shell.tsx");

  for (const id of ["build", "storyboard", "graphic-novel", "write", "edit", "feedback", "refine", "reports"]) {
    assert.match(shell, new RegExp(`id: "${id}"[^\\n]+selectable: false`));
  }
});

test("focused Settings and Community UAT own the visual continuity regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  for (const areaId of ["settings", "community"]) {
    const area = registry.areas.find((candidate) => candidate.id === areaId);
    assert.ok(area);
    assert.ok(area.tests.includes("tests/issue-879-visual-continuity.test.mjs"));
  }
});
