import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const read = (path) => readFile(path, "utf8");

test("#1954 PowerShell launcher makes WebMCP versus normal Human testing unambiguous", async () => {
  const launcher = await read("PlotPickle.ps1");

  assert.match(launcher, /Choose how PlotPickle should start\./u);
  assert.match(launcher, /Y = WebMCP Testing - start an isolated test session and automatically check the interface, navigation, surfaces and Skin V1\./u);
  assert.match(launcher, /N = Open PlotPickle normally - use your regular app session for hands-on Human testing\. No autonomous WebMCP run is started\./u);
  assert.match(launcher, /Run autonomous WebMCP Testing\? \[Y\/N\]/u);
  assert.match(launcher, /& \$launcher --webmcp-testing/u);
  assert.match(launcher, /& \$launcher --human-testing/u);
  assert.match(launcher, /WebMCP Testing selected\. Starting an isolated test session/u);
  assert.match(launcher, /Normal PlotPickle selected\. Opening your regular app session/u);
});

test("#1967 direct Journey cutover preserves the full-width Skin V1 learning directory", async () => {
  const [journeyCss, dashboard, journey] = await Promise.all([
    read("app/skin-v1/learn-journey-preview.module.css"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/learn-journey-preview.tsx"),
  ]);

  assert.match(journeyCss, /width: min\(var\(--pp-skin-shell-max\), calc\(100vw - 40px\)\) !important;/u);
  assert.match(journeyCss, /width: min\(var\(--pp-skin-menu-max\), calc\(100% - 72px\)\) !important;/u);
  assert.match(journeyCss, /display: block !important;/u);
  assert.match(journeyCss, /border: var\(--pp-skin-border-thin\) solid var\(--pp-skin-accent-bright\) !important;/u);
  assert.match(journeyCss, /background: var\(--pp-skin-accent-deep\) !important;/u);

  assert.match(dashboard, /if \(writerCraftMenuOpen\)[\s\S]*<LearnJourneyPreview onBack=\{\(\) => setWriterCraftMenuOpen\(false\)\} \/>/u);
  assert.doesNotMatch(dashboard, /aria-label="Writer's Craft menu"/u);
  assert.doesNotMatch(dashboard, /data-skin-menu="writer-craft"/u);
  assert.match(journey, /data-skin-menu="learn-journey"/u);
  assert.match(journey, /data-skin-menu="learn-journey-courses"/u);
  assert.match(journey, /data-skin-menu="learn-journey-lessons"/u);
});

test("#1954 Profile uses one page heading and Skin V1 four-pixel control padding", async () => {
  const [profile, directoryCss] = await Promise.all([
    read("app/skin-v1/profile-skin-panel.tsx"),
    read("app/skin-v1-settings-directory.css"),
  ]);

  assert.match(profile, /<h1>USER PROFILE<\/h1>/u);
  assert.doesNotMatch(profile, /<strong>USER PROFILE<\/strong>/u);
  assert.match(directoryCss, /\.pp-skin-v1-profile-banner h1\s*\{[\s\S]*font-size: var\(--pp-skin-font-title\) !important;/u);
  assert.match(
    directoryCss,
    /\[data-profile-identity-surface="v2"\] :is\(header h2, header h3\)\s*\{[\s\S]*font-size: var\(--pp-skin-font-meta\) !important;/u,
  );
  assert.match(
    directoryCss,
    /\[data-profile-identity-surface="v2"\] :is\([\s\S]*form button,[\s\S]*section\[aria-labelledby="profile-actions-heading"\] > button[\s\S]*\)\s*\{[\s\S]*padding: var\(--pp-skin-space-2\) var\(--pp-skin-space-3\) !important;/u,
  );
});

test("#1965 Settings starts with Systems and uses explicit available/unavailable status semantics", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");
  const start = dashboard.indexOf("const SETTINGS_MENU = [");
  const end = dashboard.indexOf("] as const;", start);
  assert.ok(start >= 0 && end > start, "SETTINGS_MENU source should remain explicit and testable");
  const menuSource = dashboard.slice(start, end);

  const nodeIndex = menuSource.indexOf('id: "node-info"');
  const localIndex = menuSource.indexOf('id: "local-story-mode"');
  const cloudIndex = menuSource.indexOf("...settingsTaxonomy.systems");
  const workspaceIndex = menuSource.indexOf("...settingsTaxonomy.workspace");
  assert.ok(nodeIndex >= 0 && nodeIndex < localIndex, "Node Info must be the first Systems destination");
  assert.ok(localIndex < cloudIndex, "Local Story Mode must precede the canonical Cloud/system groups");
  assert.ok(cloudIndex < workspaceIndex, "Systems must render before Workspace");
  assert.match(menuSource, /label: system\.id === "cloud" \? "Cloud Story Mode" : system\.label/u);

  assert.doesNotMatch(dashboard, /\[NOT CONNECTED\]/u);
  assert.match(dashboard, /data-skin-menu-connected=\{connected \? "true" : "false"\}/u);
  assert.match(dashboard, /aria-label=\{`\$\{item\.label\}: \$\{connected \? "available" : "unavailable"\}`\}/u);
  assert.match(dashboard, /<MenuFeedbackFooter[\s\S]*id="settings-menu-status"[\s\S]*available=\{selectedSettingsConnected\}/u);
});

test("#1965 Profile readiness uses the full identity-summary width without pill-like controls", async () => {
  const [directoryCss, identityPanel] = await Promise.all([
    read("app/skin-v1-settings-directory.css"),
    read("app/profile-access/profile-identity-panel.tsx"),
  ]);

  assert.match(
    directoryCss,
    /\[aria-label="Identity summary"\]\s*\{[\s\S]{0,180}grid-template-columns: 108px minmax\(0, 1fr\) !important;/u,
  );
  assert.match(
    directoryCss,
    /\[aria-label="Profile readiness"\]\s*\{[\s\S]{0,220}grid-column: 1 \/ -1 !important;[\s\S]{0,180}grid-template-columns: repeat\(5, minmax\(0, 1fr\)\) !important;/u,
  );
  assert.match(
    directoryCss,
    /\[aria-label="Profile readiness"\] button\s*\{[\s\S]{0,260}min-height: var\(--pp-skin-control-height\) !important;[\s\S]{0,180}border: 0 !important;[\s\S]{0,120}border-radius: 0 !important;[\s\S]{0,120}background: transparent !important;/u,
  );

  for (const label of ["BUZZ Identity", "Community BBS", "Local Model", "ComfyUI", "Cloud Compute"]) {
    assert.match(identityPanel, new RegExp(`ReadinessIndicator label="${label}"`, "u"));
  }
  assert.match(identityPanel, /settingsTarget="buzz"/u);
  assert.match(identityPanel, /settingsTarget="ollama"/u);
  assert.match(identityPanel, /settingsTarget="comfyui"/u);
});

test("#1954 is governed and selected by the seven-layer verification mesh", async () => {
  const [catalogSource, ownershipSource] = await Promise.all([
    read("config/verification/test-catalog.json"),
    read("config/verification/ownership-map.json"),
  ]);
  const catalog = JSON.parse(catalogSource);
  const ownership = JSON.parse(ownershipSource);

  const entry = catalog.entries.find((candidate) => candidate.id === "experience.pre-phase2-1954");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "experience-skins");
  assert.deepEqual(entry.runner.targets, ["tests/issue-1954-pre-phase2-cleanup.test.mjs"]);
  assert.ok(entry.triggerTokens.includes("visual"));
  assert.ok(entry.triggerTokens.includes("windows"));

  const launcherOwner = ownership.rules.find((rule) => rule.id === "windows-local-launcher");
  assert.ok(launcherOwner);
  assert.ok(launcherOwner.include.includes("PlotPickle.ps1"));
  assert.equal(launcherOwner.ownerLayer, "experience-skins");
});

test("#1954 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1954.json")) {
    t.skip("#1954 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1954.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1954);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});

test("#1965 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1965.json")) {
    t.skip("#1965 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1965.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1965);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});
