import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("phase 2 step 4 exposes all three project modes in Repository & Collab settings", async () => {
  const [collaboration, mode] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("lib/collaboration-mode.ts"),
  ]);
  assert.match(collaboration, /Project operating mode/);
  for (const text of ["Local Story Mode", "Writers' Room Mode", "Repository Collaboration Mode"]) {
    assert.match(mode, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(collaboration, /surface === "configuration" \? <ProjectModeSettings/);
  assert.match(collaboration, /role="radiogroup"/);
  assert.match(collaboration, /role="radio"/);
  assert.match(collaboration, /aria-checked=\{active\}/);
});

test("phase 2 step 4 requires an explicit human confirmation before mode changes", async () => {
  const [collaboration, mode] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("lib/collaboration-mode.ts"),
  ]);
  assert.match(collaboration, /window\.confirm\(collaborationTransitionConfirmation\(result\.plan\)\)/);
  assert.match(mode, /This changes the project operating mode only/);
  assert.match(mode, /It will not connect or disconnect GitHub or Buzz/);
  assert.match(mode, /start synchronization, publish changes, or alter story canon/);
  assert.ok(collaboration.indexOf("if (!confirmed) return") < collaboration.indexOf("onChange(next)"));
});

test("phase 2 step 4 delegates mode changes to the preservation-safe transition engine", async () => {
  const [collaboration, mode] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("lib/collaboration-mode.ts"),
  ]);
  assert.match(collaboration, /transitionCollaborationMode\(project, mode/);
  assert.match(mode, /collaboration: withCollaborationMode\(project\.collaboration, plan\.to\)/);
  assert.match(mode, /\.\.\.project/);
  assert.match(mode, /\.\.\.collaboration/);
  assert.doesNotMatch(collaboration, /connectGitHub|disconnectGitHub|startBuzz|stopBuzz|syncProject|publishProject/);
  assert.match(collaboration, /Changing mode preserves the PPF, local backups and all GitHub and Buzz setup/);
  assert.match(collaboration, /every canon change still requires explicit human approval/);
});

test("phase 2 step 4 keeps legacy projects safe and Dashboard mode composition unchanged", async () => {
  const [mode, dashboard] = await Promise.all([
    source("lib/collaboration-mode.ts"),
    source("app/project-collaboration-status.tsx"),
  ]);
  assert.match(mode, /return isCollaborationMode\(value\) \? value : "local-story"/);
  assert.match(dashboard, /normalizeCollaborationModeRecord\(project\.collaboration\)/);
  assert.match(dashboard, /COLLABORATION_MODE_COPY\[collaboration\.mode\]/);
});

test("phase 2 step 4 styles remain responsive and semantic", async () => {
  const css = await source("app/project-mode-settings.module.css");
  for (const selector of [".panel", ".options", ".active", ".boundary"]) assert.ok(css.includes(selector));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(css, /#f00|#ff0000|\bred\b/i);
});

test("phase 4 separates Local Only and Local + GitHub while retaining the local working copy", async () => {
  const storage = await source("lib/project-storage-mode.ts");
  for (const contract of [
    'PROJECT_STORAGE_MODES = ["local-only", "local-github"]',
    "localWorkingCopy: true",
    "localBackups: true",
    "repositoryEnabled",
    "githubCollaborationServiceState",
    "transitionProjectStorageMode",
    "This does not push, pull, publish, merge or alter canon automatically",
    "This does not delete the repository, its history or any local story data",
  ]) assert.ok(storage.includes(contract), `Missing project storage contract: ${contract}`);
  assert.match(storage, /target === "local-github"[\s\S]*"repository-collaboration"/);
  assert.match(storage, /currentCollaboration\.mode === "repository-collaboration"[\s\S]*"local-story"/);
  assert.doesNotMatch(storage, /delete\s+project\.collaboration|repositoryUrl\s*=\s*""|owner\s*=\s*""|repo\s*=\s*""/);
});

test("phase 4 exposes the storage switch on the first-run dashboard and in Settings", async () => {
  const [panel, host, settings] = await Promise.all([
    source("app/project-storage-mode-panel.tsx"),
    source("app/configuration-dashboard-host.tsx"),
    source("app/github-collaboration.tsx"),
  ]);
  for (const phrase of [
    "Choose where this story is managed",
    "Local Only",
    "Local + GitHub",
    "Local working copy",
    "Always active",
    "Rolling backups",
    "Always retained",
    "GitHub story repository",
    "GitHub supplements local storage; it never replaces it",
  ]) assert.ok(panel.includes(phrase), `Missing first-run project mode copy: ${phrase}`);
  assert.match(host, /ProjectStorageModePanel onManage=\{openSettings\}/);
  assert.match(settings, /Project storage mode/);
  assert.match(settings, /PROJECT_STORAGE_MODES\.map/);
  assert.match(settings, /selectStorageMode/);
  assert.match(settings, /projectStorageTransitionConfirmation/);
  assert.match(settings, /transitionProjectStorageMode/);
});

test("phase 4 requires repository setup before the dashboard enables Local + GitHub", async () => {
  const panel = await source("app/project-storage-mode-panel.tsx");
  assert.match(panel, /target === "local-github" && !snapshot\.githubConfigured/);
  assert.match(panel, /Connect a GitHub account and choose the story repository/);
  assert.match(panel, /onManage\("GitHub"\)/);
  assert.ok(panel.indexOf("if (!window.confirm") < panel.indexOf("window.localStorage.setItem"));
  assert.match(panel, /window\.location\.reload\(\)/);
  assert.doesNotMatch(panel, /fetch\s*\(|push|pull|publish|mergePull|deleteRepository/);
});

test("phase 4 keeps Writers' Room independent from repository storage", async () => {
  const settings = await source("app/github-collaboration.tsx");
  assert.match(settings, /Choose the collaboration style separately/);
  assert.match(settings, /Writers’ Room discussion can remain independent from repository storage/);
  assert.match(settings, /mode === "repository-collaboration"[\s\S]*transitionProjectStorageMode\(result\.project, "local-github"\)/);
  assert.match(settings, /mode === "local-story"[\s\S]*transitionProjectStorageMode\(result\.project, "local-only"\)/);
  assert.match(settings, /:\s*result\.project;/);
});

test("phase 4 storage-mode styling remains responsive and avoids colour-only status", async () => {
  const [settingsCss, panelCss] = await Promise.all([
    source("app/project-mode-settings.module.css"),
    source("app/project-storage-mode-panel.module.css"),
  ]);
  for (const selector of [".storageOptions", ".storageStatus", ".subsectionHeader"]) {
    assert.ok(settingsCss.includes(selector), `Missing Settings storage selector: ${selector}`);
  }
  for (const selector of [".panel", ".options", ".status", ".actions", ".boundary", ".notice"]) {
    assert.ok(panelCss.includes(selector), `Missing dashboard storage selector: ${selector}`);
  }
  assert.match(panelCss, /@media \(max-width: 680px\)/);
  assert.doesNotMatch(`${settingsCss}\n${panelCss}`, /#f00|#ff0000|\bred\b/i);
});
