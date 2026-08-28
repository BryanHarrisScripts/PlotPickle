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

test("Settings exposes permanent left categories centre controls and right help without removing AI capability depth", async () => {
  const [settings, compute] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
  ]);

  assert.match(settings, /data-plotpickle-settings="v2"/);
  assert.match(settings, /data-settings-rail="navigation"/);
  assert.match(settings, /data-settings-main/);
  assert.match(settings, /data-settings-rail="context"/);
  for (const label of [
    "Overview",
    "Local Compute",
    "Cloud Compute",
    "ComfyUI Setup",
    "BUZZ Setup",
    "Agent Activity",
    "Advanced Runtime",
  ]) {
    assert.match(settings, new RegExp(`label: "${label}"`));
  }
  assert.match(settings, /<AgentObservabilityPanel \/>/);
  assert.match(settings, /<BuzzSettingsPanel \/>/);
  assert.match(settings, /<BuzzLiveHealthCard \/>/);
  assert.match(settings, /<DeepSeekHarnessPanel \/>/);
  assert.match(settings, /<LocalRuntimePanel \/>/);
  assert.match(settings, /<AiComputeWorkspace mode="local" \/>/);
  assert.match(settings, /<AiComputeWorkspace mode="cloud" \/>/);
  for (const capability of ["writing", "images", "video"]) assert.match(compute, new RegExp(`id: "${capability}"`));
  assert.match(settings, /<MediaRoutingPanel\b/);
  for (const component of ["SageFastModelSetup", "AiRoutingPanel", "AiProviderSetupPanel"]) {
    assert.match(compute, new RegExp(`<${component}\\b`));
  }
  assert.doesNotMatch(compute, /<MediaRoutingPanel\b/);
  assert.match(settings, /data-settings-section=\{activeSection\}/);
  assert.match(settings, /aria-current=\{activeSection === item\.id \? "page" : undefined\}/);
});

test("README uses the current supplied repository-resident artwork in intentional roles", async () => {
  const readme = await read("README.md");

  const primary = readme.indexOf("docs/brand/plotpickle-banner-dragon-logo.jpg");
  const community = readme.indexOf("docs/brand/PlotPickle-Community-BBS.jpg");
  const heading = readme.indexOf("<h1 align=\"center\">PlotPickle</h1>");
  const communityHeading = readme.indexOf("## Community, BBS and BUZZ");
  const nodesHeading = readme.indexOf("## PlotPickle Nodes, Human profiles, Stewards and BUZZ");
  assert.ok(primary >= 0 && primary < heading, "the current supplied dragon/logo banner should lead the README");
  assert.ok(community > communityHeading && community < nodesHeading, "the supplied Community BBS artwork should introduce the Community section");
  assert.doesNotMatch(readme, /plotpickle-header-horizontal-1200\.png|plotpickle-wordmark-horizontal\.svg/i);
  assert.doesNotMatch(readme, /sage-brinewick-v5-pp-c1\.png|docs\/brand-sources\/sage-brinewick-v2-master\.png/i);
  assert.doesNotMatch(readme, /private-user-images\.githubusercontent\.com|chatgpt\.com|oaidalleapiprodscus/i);
});

test("README-only identity change does not replace the live application logo or favicon contract", async () => {
  const [shell, layout] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(shell, /src="\/brand\/plotpickle-ouroboros-v3-transparent\.png"/);
  assert.match(layout, /plotpickle-ouroboros-v2-32\.png/);
  assert.doesNotMatch(shell, /docs\/brand/);
  assert.doesNotMatch(layout, /docs\/brand/);
});

test("exhaustive UAT reads the shared continuity layer on every active screen", async () => {
  const config = JSON.parse(await read("config/exhaustive-ui-uat.json"));
  for (const id of ["entry", "community", "learn", "plan", "wyrmwood", "settings"]) {
    const screen = config.screens.find((candidate) => candidate.id === id);
    assert.ok(screen, `${id} must remain an exhaustive-UAT screen`);
    assert.ok(screen.sourceFiles.includes("app/workspace-continuity.css"), `${id} should expose the continuity layer to the code-aware auditor`);
  }
});

test("Dashboard, BUILD and approved production shortcuts expose real destinations", async () => {
  const navigation = await read("app/navigation/global-shortcuts.ts");

  for (const id of ["dashboard", "build"]) {
    assert.match(navigation, new RegExp(`id: "${id}"[^\\n]+kind: "workspace"[^\\n]+workspace: "${id}"`));
  }
  for (const [id, href] of [
    ["storyboard", "/storyboard"],
    ["graphic-novel", "/previs"],
    ["write", "/pageflow"],
    ["edit", "/edit"],
    ["feedback", "/pitch-review"],
    ["refine", "/diagnostics"],
    ["reports", "/production"],
  ]) {
    assert.match(navigation, new RegExp(`id: "${id}"[^\\n]+kind: "route"[^\\n]+href: "${href.replaceAll("/", "\\/")}"`));
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
