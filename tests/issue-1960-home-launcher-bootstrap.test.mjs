import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const read = (path) => readFile(path, "utf8");

test("#1960 home bootstrap changes into the repo and pulls before delegating to the Y/N launcher", async () => {
  const [bootstrap, repoLauncher] = await Promise.all([
    read("GIT-PlotPickle.ps1"),
    read("PlotPickle.ps1"),
  ]);

  assert.match(bootstrap, /\[string\]\$RepositoryPath = \(Join-Path \$HOME "PlotPickle"\)/u);
  assert.match(bootstrap, /Set-Location -LiteralPath \$repoPath/u);
  assert.match(bootstrap, /& \$git\.Source pull --ff-only/u);
  assert.match(bootstrap, /\$repoLauncher = Join-Path \$repoPath "PlotPickle\.ps1"/u);
  assert.match(bootstrap, /& \$repoLauncher @launchArgs/u);
  assert.doesNotMatch(bootstrap, /Read-Host/u);
  assert.doesNotMatch(bootstrap, /Run autonomous WebMCP Testing\? \[Y\/N\]/u);

  const cdIndex = bootstrap.indexOf("Set-Location -LiteralPath $repoPath");
  const pullIndex = bootstrap.indexOf("& $git.Source pull --ff-only");
  const delegateIndex = bootstrap.indexOf("& $repoLauncher @launchArgs");
  assert.ok(cdIndex >= 0 && pullIndex > cdIndex && delegateIndex > pullIndex);

  assert.match(repoLauncher, /Run autonomous WebMCP Testing\? \[Y\/N\]/u);
  assert.match(repoLauncher, /Read-Host/u);
});

test("#1960 bootstrap fails closed on update errors and preserves explicit mode pass-through", async () => {
  const bootstrap = await read("GIT-PlotPickle.ps1");

  assert.match(bootstrap, /Get-Command git -ErrorAction SilentlyContinue/u);
  assert.match(bootstrap, /Test-Path -LiteralPath \$gitDirectory -PathType Container/u);
  assert.match(bootstrap, /git pull --ff-only failed with exit code \$LASTEXITCODE/u);
  assert.match(bootstrap, /\$launchArgs\.WebMCPTesting = \$true/u);
  assert.match(bootstrap, /\$launchArgs\.HumanTesting = \$true/u);
  assert.match(bootstrap, /Choose either -WebMCPTesting or -HumanTesting, not both\./u);
});

test("#1960 home bootstrap is governed by Experience Skins verification", async () => {
  const [ownershipSource, catalogSource] = await Promise.all([
    read("config/verification/ownership-map.json"),
    read("config/verification/test-catalog.json"),
  ]);
  const ownership = JSON.parse(ownershipSource);
  const catalog = JSON.parse(catalogSource);

  const launcherOwner = ownership.rules.find((rule) => rule.id === "windows-local-launcher");
  assert.ok(launcherOwner);
  assert.ok(launcherOwner.include.includes("GIT-PlotPickle.ps1"));
  assert.equal(launcherOwner.ownerLayer, "experience-skins");

  const entry = catalog.entries.find((candidate) => candidate.id === "experience.home-launcher-1960");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "experience-skins");
  assert.deepEqual(entry.runner.targets, ["tests/issue-1960-home-launcher-bootstrap.test.mjs"]);
  assert.ok(entry.triggerTokens.includes("windows"));
  assert.ok(entry.triggerTokens.includes("native"));
});

test("#1960 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1960.json")) {
    t.skip("#1960 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1960.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1960);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});
