import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("PlotPickle 1.0 candidate defines a portable .ppf boundary", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const portable = await source("lib/project-package.ts");
  assert.match(packageJson.version, /^1\.0\.0-rc\.\d+$/);
  assert.match(packageJson.scripts.test, /phase-f-collaboration-release\.test\.mjs/);
  for (const phrase of ["plotpickle-project-file", "PPF_FORMAT_VERSION", "createPortableProjectFile", "parsePortableProjectFile", "integrityValid", "portableProjectFileName", packageJson.version]) {
    assert.ok(portable.includes(phrase), `Missing .ppf contract: ${phrase}`);
  }
});

test("local project storage uses atomic saves, integrity checks, and rolling backups", async () => {
  const gateway = await source("build/local-project-gateway.ts");
  for (const phrase of ["atomicWrite", "handle.sync", "rename(temporary, filePath)", "createBackup", "BACKUP_LIMIT = 20", "integrity check failed", "${PROJECT_API}/library", "${PROJECT_API}/recover"]) {
    assert.ok(gateway.includes(phrase), `Missing local storage protection: ${phrase}`);
  }
  const scriptPath = fileURLToPath(new URL("../scripts/project-recovery-smoke.mjs", import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath]);
  assert.match(stdout, /rolling backup, corruption detection, and recovery smoke test passed/i);
});

test("GitHub collaboration is local-only, review-first, and Project Lead-controlled", async () => {
  const [gateway, proposalGateway, component, comparison, vite, vault] = await Promise.all([
    source("build/local-project-gateway.ts"),
    source("build/github-review-gateway.ts"),
    source("app/github-collaboration.tsx"),
    source("lib/github-collaboration.ts"),
    source("vite.config.ts"),
    source("build/local-credentials.ts"),
  ]);
  for (const phrase of ["local-credentials", "readCredentialJson", "Project storage and GitHub synchronization accept requests only", "githubPull", "githubHistory"]) {
    assert.ok(gateway.includes(phrase), `Missing GitHub gateway protection: ${phrase}`);
  }
  for (const phrase of ["credentialsDirectory", '"secrets"', "readCredentialJson", "writeCredentialJson"]) {
    assert.ok(vault.includes(phrase), `Missing centralized credential protection: ${phrase}`);
  }
  for (const phrase of ["serverIdentity", "submit-proposal", "git/refs", "pulls", "expectedBaseRevision", "canonical GitHub story changed", "maintainer_can_modify", "owner or maintainer", "No API key or GitHub credential"]) {
    assert.ok(proposalGateway.includes(phrase), `Missing proposal architecture: ${phrase}`);
  }
  assert.ok(!proposalGateway.includes("token: project"), "GitHub credentials must never be read from the project.");
  for (const phrase of [
    "Many local PlotPickle servers",
    "Canonical Git synchronization",
    "Compare project files",
    "Get approved project folder",
    "Project Lead: publish approved version",
    "Submit changes for Project Lead approval",
    "The approved ${branch} version is unchanged until the Project Lead accepts it",
    "Review in GitHub",
    "Legacy approved version",
  ]) {
    assert.ok(component.includes(phrase), `Missing Project Lead-controlled collaboration UI: ${phrase}`);
  }
  assert.doesNotMatch(component, /Push named backup/);
  assert.match(comparison, /compareCollaborativeProjects/);
  assert.match(comparison, /applyReviewedGitHubProject/);
  assert.match(vite, /githubReviewGateway\(\)/);
  assert.match(vite, /githubProjectSyncGateway\(\)/);
});

test("canonical projects retain repository metadata without credentials", async () => {
  const [project, schema, afterglow, overview] = await Promise.all([
    source("lib/project.ts"),
    source("schema/plotpickle-project.schema.json").then(JSON.parse),
    source("data/afterglow-complete.ts"),
    source("app/project-overview.tsx"),
  ]);
  for (const phrase of ["ProjectCollaboration", "sourceRepositoryUrl", "lastPulledCommit", "lastPushedCommit", "collaboration: ProjectCollaboration", "normalizeCollaboration"]) {
    assert.ok(project.includes(phrase), `Missing canonical collaboration field: ${phrase}`);
  }
  assert.ok(schema.required.includes("collaboration"));
  assert.equal(schema.properties.collaboration.$ref, "#/$defs/projectCollaboration");
  assert.match(afterglow, /https:\/\/github\.com\/BryanHarrisScripts\/Afterglow-Echoes-of-Sentience/);
  assert.match(overview, /Open this story’s GitHub repository/);
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
    source("scripts/run-command-with-timeout.mjs"),
    source("scripts/spawn-command.mjs"),
  ]);
  for (const platform of ["windows-latest", "macos-latest", "ubuntu-latest"]) assert.ok(workflow.includes(platform));
  for (const phrase of ["Clean-machine extraction and dependency test", "SHA-256 checksum", "PlotPickle-Windows.zip", "PlotPickle-macOS.zip", "PlotPickle-Linux.zip", "publish-tag"]) assert.ok(workflow.includes(phrase), `Missing release gate: ${phrase}`);
  assert.match(packageScript, /release-manifest\.json/);
  for (const launcher of [windows, macos, linux]) {
    assert.match(launcher, /127\.0\.0\.1/);
    assert.ok(!launcher.includes("--host 0.0.0.0"));
  }
  assert.match(portableRuntime, /Dependency fingerprint/);
  assert.match(portableRuntime, /package-lock\.json/);
  assert.match(buildScript, /run-command-with-timeout\.mjs/);
  assert.ok(!buildScript.includes("requires GNU timeout"));
  assert.match(timeoutRunner, /spawnCommand/);
  assert.match(spawnCommand, /process\.platform === "win32"/);
  assert.match(spawnCommand, /cmd\.exe/);
  assert.match(timeoutRunner, /SIGTERM/);
  assert.match(timeoutRunner, /SIGKILL/);
});