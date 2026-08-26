import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");
const [project, workbench, workbenchPath, inventory, secondOpinion, repomix, workbenchCli, buildScript, workflow] = await Promise.all([
  read("Utilities/DeveloperWorkbench/DeveloperWorkbench.csproj"),
  read("Utilities/DeveloperWorkbench/WorkbenchV2.cs"),
  read("Utilities/DeveloperWorkbench/WorkbenchPath.cs"),
  read("Utilities/DeveloperWorkbench/local-reviewer-inventory.mjs"),
  read("Utilities/DeveloperWorkbench/second-opinion-review.mjs"),
  read("Utilities/DeveloperWorkbench/workbench-repomix-evidence.mjs"),
  read("Utilities/DeveloperWorkbench/workbench-cli.mjs"),
  read("Utilities/DeveloperWorkbench/build.ps1"),
  read(".github/workflows/developer-workbench.yml"),
]);

test("#1448 upgraded Workbench starts through the additive V2 shell", () => {
  assert.match(project, /<StartupObject>PlotPickle\.DeveloperWorkbench\.WorkbenchV2Program<\/StartupObject>/);
  assert.match(workbench, /Issue1448WorkbenchEnhancer\.Attach\(form\)/);
  assert.match(workbench, /new ToolStripButton\("Scan selected"\)/);
  assert.match(workbench, /new ToolStripButton\("Second opinion"\)/);
});

test("#1448 scan status is local, persistent and revision-aware", () => {
  assert.match(workbench, /queue\.Columns\.Add\("Scanned"/);
  assert.match(workbench, /row\.SubItems\[4\]\.Text = "✓"/);
  assert.match(workbench, /Color\.ForestGreen/);
  assert.match(workbench, /scan-state-v1\.json/);
  assert.match(workbench, /pr:\{item\.HeadSha\.ToLowerInvariant\(\)\}/);
  assert.match(workbench, /issue:\{item\.UpdatedAt\.ToUniversalTime\(\):O\}/);
  assert.doesNotMatch(workbench, /gh[^\n]*label|issue[^\n]*edit[^\n]*scan/i);
});

test("#1448 model picker keeps llama.cpp distinct and uses existing Pi explicit-selection contract", () => {
  const llama = inventory.indexOf('kind: "llama.cpp"');
  const studio = inventory.indexOf('kind: "lm-studio"');
  const ollama = inventory.indexOf('kind: "ollama"');
  assert.ok(llama >= 0 && studio > llama && ollama > studio);
  assert.match(inventory, /approvedCodingModel/);
  assert.match(inventory, /resolvePiLocalRuntime/);
  assert.match(workbench, /PLOTPICKLE_REPAIR_ENDPOINT/);
  assert.match(workbench, /PLOTPICKLE_REPAIR_MODEL/);
  assert.match(workbench, /VerifyTargetReadinessAsync/);
  assert.doesNotMatch(inventory, /readdir|glob|\.gguf/i);
});

test("#1448 second opinion is bounded, independent and Human-incorporated", () => {
  assert.match(secondOpinion, /runManagedPiReadOnly/);
  assert.match(secondOpinion, /read, grep, find, and ls/);
  assert.match(secondOpinion, /Do not expose chain-of-thought/);
  assert.match(secondOpinion, /safeErrorMessage/);
  assert.match(secondOpinion, /MAX_ERROR_CHARS = 1_000/);
  assert.doesNotMatch(secondOpinion, /error\.stack/);
  for (const section of [
    "LIKELY ROOT CAUSE",
    "MISSING EVIDENCE / COMPONENTS",
    "CANDIDATE MINIMAL FIX",
    "ALTERNATIVE FIX",
    "REGRESSION RISKS",
    "VERIFICATION",
    "CONFIDENCE / UNKNOWNS",
  ]) assert.match(secondOpinion, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(workbench, /Choose a different local model for Second opinion/);
  assert.match(workbench, /Append to editable brief/);
  assert.match(workbench, /HUMAN-INCLUDED SECOND OPINION/);
});

test("#1448 Repomix evidence is targeted and credential-safe", () => {
  assert.match(repomix, /repomix@1\.18\.0/);
  assert.match(repomix, /--include/);
  assert.match(repomix, /selectRepomixSeeds/);
  assert.match(repomix, /MAX_SEEDS = 48/);
  assert.match(repomix, /\*\*\/credentials\.json/);
  assert.match(repomix, /\*\*\/secrets\.json/);
  assert.doesNotMatch(repomix, /"build\/\*\*"/);
  assert.match(workbench, /Repomix context/);
});

test("#1448 Repomix execution stays shell-free on Windows", () => {
  assert.match(repomix, /execFile/);
  assert.match(repomix, /npm-cli\.js/);
  assert.match(repomix, /shell: false/);
  assert.match(repomix, /will not fall back to cmd\.exe/);
  assert.doesNotMatch(repomix, /runPortableCommand/);
});

test("#1448 helper file IO stays inside host-selected repository and Workbench temp roots", () => {
  assert.match(workbenchCli, /path\.resolve\(os\.tmpdir\(\), "PlotPickle", "DeveloperWorkbench"\)/);
  assert.match(workbenchCli, /path\.relative\(root, candidate\)/);
  assert.match(workbenchCli, /requiredWorkbenchTempPath/);
  assert.match(workbenchCli, /requireCurrentRepository/);
  assert.match(workbenchCli, /path\.resolve\(process\.cwd\(\)\)/);
  assert.match(workbenchCli, /repositoryPath must match the host-selected working directory/);
  assert.match(secondOpinion, /requiredWorkbenchTempPath\(process\.argv, "--input"\)/);
  assert.match(secondOpinion, /requireCurrentRepository\(reviewPackage\)/);
  assert.match(repomix, /requiredWorkbenchTempPath\(process\.argv, "--input"\)/);
  assert.match(repomix, /requireCurrentRepository\(reviewPackage\)/);
});

test("#1448 published Windows package carries the upgraded reviewer runtime helpers", () => {
  for (const helper of [
    "local-reviewer-inventory.mjs",
    "second-opinion-review.mjs",
    "workbench-repomix-evidence.mjs",
    "workbench-cli.mjs",
    "pi-managed-node-launch.mjs",
    "pi-review-instructions.mjs",
    "developer-repair-model-policy.mjs",
    "local-repair-capability-cache.mjs",
    "pi-managed-install.mjs",
    "pi-worker-runtime.mjs",
    "local-model-capabilities.mjs",
  ]) assert.match(buildScript, new RegExp(helper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(buildScript, /workbench-runtime-manifest\.json/);
});

test("#1448 Workbench falls back to packaged reviewer helpers without changing the selected repository", () => {
  assert.match(workbenchPath, /global using Path = PlotPickle\.DeveloperWorkbench\.WorkbenchPath/);
  assert.match(workbenchPath, /AppContext\.BaseDirectory/);
  assert.match(workbenchPath, /PackagedReviewerHelpers/);
  assert.match(workbenchPath, /local-reviewer-inventory\.mjs/);
  assert.match(workbenchPath, /second-opinion-review\.mjs/);
  assert.match(workbenchPath, /workbench-repomix-evidence\.mjs/);
  assert.match(workbenchPath, /File\.Exists\(regular\)/);
  assert.match(workbenchPath, /File\.Exists\(packaged\) \? packaged : regular/);
});

test("#1448 Windows Workbench CI executes the new focused regression", () => {
  assert.match(workflow, /issue-1448-developer-workbench-local-reviewers\.test\.mjs/);
});
