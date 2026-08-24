import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const programPath = new URL("../Utilities/DeveloperWorkbench/Program.cs", import.meta.url);
const projectPath = new URL("../Utilities/DeveloperWorkbench/DeveloperWorkbench.csproj", import.meta.url);
const piBridgePath = new URL("../scripts/pi-work-item-review.mjs", import.meta.url);

const [program, project, piBridge] = await Promise.all([
  readFile(programPath, "utf8"),
  readFile(projectPath, "utf8"),
  readFile(piBridgePath, "utf8"),
]);

test("#1349 Workbench stays a standalone Windows utility", () => {
  assert.match(project, /<OutputType>WinExe<\/OutputType>/);
  assert.match(project, /<UseWindowsForms>true<\/UseWindowsForms>/);
  assert.match(project, /<PublishSingleFile>true<\/PublishSingleFile>/);
  assert.match(program, /PlotPickle Developer Workbench/);
  assert.match(program, /Utilities|DeveloperWorkbench/);
});

test("#1349 Workbench uses GitHub evidence and exact-head freshness", () => {
  assert.match(program, /gh/);
  assert.match(program, /statusCheckRollup/);
  assert.match(program, /headRefOid/);
  assert.match(program, /Review stale — PR head changed/);
  assert.match(program, /RefreshPrHeadAsync/);
});

test("#1349 Pi review is bounded, read-only and implementation-grade", () => {
  assert.match(piBridge, /runPiReadOnly/);
  assert.match(piBridge, /read, grep, find, and ls/);
  assert.match(piBridge, /Do not edit files, run shell commands, commit, push/);
  assert.match(piBridge, /## EXACT CODE CHANGES RECOMMENDED/);
  assert.match(piBridge, /Priority; File; Symbol; Change; Evidence; Reason; Regression\/validation/);
  assert.match(piBridge, /Do not expose chain-of-thought/);
});

test("#1349 publication requires Human action and records reviewed head", () => {
  assert.match(program, /Publish approved brief/);
  assert.match(program, /Reviewed exact PR head/);
  assert.match(program, /MessageBoxButtons\.OKCancel/);
  assert.match(program, /PLOTPICKLE-DEVELOPER-WORKBENCH-BRIEF-START/);
  assert.match(program, /PLOTPICKLE-DEVELOPER-WORKBENCH-BRIEF-END/);
});

test("#1349 Workbench does not introduce credential storage or merge authority", () => {
  assert.doesNotMatch(program, /GITHUB_TOKEN|GH_TOKEN|private[_ -]?key|api[_ -]?key\s*=/i);
  assert.doesNotMatch(program, /["']pr["']\s*,\s*["']merge["']/i);
  assert.doesNotMatch(piBridge, /runPortableCommand\([^)]*(?:git|gh)/i);
});
