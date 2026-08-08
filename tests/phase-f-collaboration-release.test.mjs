import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("release hardening preserves the public repository boundary", async () => {
  const [packageJson, releaseNotes, readme, publicReadiness] = await Promise.all([
    source("package.json").then(JSON.parse),
    source("RELEASE_NOTES.md"),
    source("README.md"),
    source("scripts/public-readiness.mjs"),
  ]);
  assert.equal(packageJson.license, "AGPL-3.0-or-later");
  assert.match(releaseNotes, /local-first/i);
  assert.match(readme, /AGPL-3\.0/i);
  assert.match(publicReadiness, /private key|credential|secret/i);
});

test("canonical release keeps collaboration review-first and Project Lead-controlled", async () => {
  const [collaborationUi, comparison, vite] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("lib/project-package.ts"),
    source("vite.config.ts"),
  ]);
  for (const phrase of [
    "Approve selected groups",
    "Open review in GitHub",
    "Legacy approved version",
  ]) assert.ok(collaborationUi.includes(phrase), `Missing Project Lead-controlled collaboration UI: ${phrase}`);
  assert.doesNotMatch(collaborationUi, /Push named backup/);
  assert.match(comparison, /compareCollaborativeProjects/);
  assert.match(comparison, /applyReviewedGitHubProject/);
  assert.match(vite, /githubReviewGateway\(\)/);
  assert.match(vite, /githubProjectSyncGateway\(\)/);
});

test("canonical projects retain repository metadata without credentials", async () => {
  const [project, schema, afterglow] = await Promise.all([
    source("lib/project.ts"),
    source("schema/plotpickle-project.schema.json").then(JSON.parse),
    source("data/afterglow-complete.ts"),
  ]);
  for (const phrase of ["ProjectCollaboration", "sourceRepositoryUrl", "lastPulledCommit", "lastPushedCommit", "collaboration: ProjectCollaboration", "normalizeCollaboration"]) {
    assert.ok(project.includes(phrase), `Missing canonical collaboration field: ${phrase}`);
  }
  assert.ok(schema.required.includes("collaboration"));
  assert.equal(schema.properties.collaboration.$ref, "#/$defs/projectCollaboration");
  assert.match(afterglow, /https:\/\/github\.com\/BryanHarrisScripts\/Afterglow-Echoes-of-Sentience/);
  assert.doesNotMatch(project, /githubToken|accessToken|privateKey|clientSecret/);
});

test("Windows, macOS, and Linux release candidates are packaged and clean-machine tested", async () => {
  const [workflow, packageScript, windows, macos, linux, portableRuntime, buildScript, timeoutRunner, spawnCommand] = await Promise.all([
    source(".github/workflows/release-candidate.yml"),
    source("scripts/package-platform.mjs"),
    source("Start-PlotPickle.bat"),
    source("Start-PlotPickle.command"),
    source("start-plotpickle.sh"),
    source("scripts/portable-runtime.mjs"),
    source("scripts/build-verified.sh"),
    source("scripts/run-with-timeout.mjs"),
    source("scripts/spawn-command.mjs"),
  ]);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(packageScript, /dist/);
  assert.match(windows, /PlotPickle/i);
  assert.match(macos, /PlotPickle/i);
  assert.match(linux, /PlotPickle/i);
  assert.match(portableRuntime, /node/i);
  assert.match(buildScript, /build/i);
  assert.match(timeoutRunner, /timeout/i);
  assert.match(spawnCommand, /spawn/i);
});
