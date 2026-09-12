import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const read = (path) => readFile(path, "utf8");

test("#1969 bare PlotPickle startup opens Library instead of restoring the prior active story", async () => {
  const home = await read("app/page.tsx");
  const workspaceRouter = home.match(/function requestedWorkspace\(\): Workspace \{[\s\S]*?\n\}/u)?.[0] ?? "";

  assert.match(workspaceRouter, /if \(typeof window === "undefined"\) return "library";/u);
  assert.match(workspaceRouter, /if \(requested === "dashboard"\) return "dashboard";/u);
  assert.match(workspaceRouter, /if \(requested === "library"\) return "library";/u);
  assert.match(workspaceRouter, /return "library";/u);
  assert.doesNotMatch(workspaceRouter, /hasActiveLibraryProject/u);
  assert.doesNotMatch(workspaceRouter, /\? "dashboard" : "library"/u);
  assert.match(home, /useState<Workspace>\("library"\)/u);
});

test("#1969 bare startup does not repair-load the persisted story before the Human chooses a workspace", async () => {
  const home = await read("app/page.tsx");

  assert.match(home, /function hasRequestedWorkspace\(\)[\s\S]*?\.has\("workspace"\)/u);
  assert.match(home, /useEffect\(\(\) => \{\s*if \(hasRequestedWorkspace\(\)\) repairPersistedProject\(\);/u);
  assert.doesNotMatch(home, /useEffect\(\(\) => \{\s*repairPersistedProject\(\);/u);
});

test("#1969 Library keeps saved stories and requires an explicit Resume/Open/Create action to enter story work", async () => {
  const [home, library] = await Promise.all([
    read("app/page.tsx"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.match(home, /if \(workspace === "library"\)[\s\S]*?<LibraryWorkspace \/>/u);
  assert.match(library, /function openActiveProject\(\) \{\s*window\.location\.assign\("\/\?workspace=dashboard"\);/u);
  assert.match(library, /switchActiveLibraryProject\(pending\.item\.id\)/u);
  assert.match(library, />\{active \? "Resume" : "Open Story"\}<\/button>/u);
  assert.match(library, /createLibraryUserProject\(\{ title: "Untitled Story", format: "Feature" \}\)/u);
  assert.match(library, /window\.location\.assign\("\/\?workspace=learn"\)/u);
});

test("#1969 does not alter Library persistence authority or add the future startup preference", async () => {
  const [home, browserStore, coreStore] = await Promise.all([
    read("app/page.tsx"),
    read("core/storage/project-library-browser.ts"),
    read("core/storage/project-library-core.mjs"),
  ]);

  assert.doesNotMatch(home, /Load last story on startup|loadLastStoryOnStartup/u);
  assert.match(browserStore, /switchActiveLibraryProject/u);
  assert.match(coreStore, /activeProjectId/u);
  assert.doesNotMatch(home, /removeItem\(|clear\(|archiveLibraryProject/u);
});

test("#1969 is governed and selected by the seven-layer verification mesh", async () => {
  const [catalogSource, ownershipSource] = await Promise.all([
    read("config/verification/test-catalog.json"),
    read("config/verification/ownership-map.json"),
  ]);
  const catalog = JSON.parse(catalogSource);
  const ownership = JSON.parse(ownershipSource);

  const entry = catalog.entries.find((candidate) => candidate.id === "experience.explicit-story-startup-1969");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "experience-contract");
  assert.deepEqual(entry.runner.targets, ["tests/issue-1969-explicit-story-startup.test.mjs"]);
  assert.ok(entry.triggerTokens.includes("navigation"));
  assert.ok(entry.triggerTokens.includes("surface"));

  const owner = ownership.rules.find((rule) => rule.id === "root-story-startup");
  assert.ok(owner);
  assert.ok(owner.include.includes("app/page.tsx"));
  assert.equal(owner.ownerLayer, "experience-contract");
});

test("#1969 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1969.json")) {
    t.skip("#1969 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1969.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1969);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});
