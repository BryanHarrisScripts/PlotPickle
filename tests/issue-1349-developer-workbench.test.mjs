import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveManagedPiCliEntry } from "../Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs";
import {
  selectRelevantArchitecturePaths,
  selectRelevantSkillIds,
} from "../Utilities/DeveloperWorkbench/pi-review-instructions.mjs";

const programPath = new URL("../Utilities/DeveloperWorkbench/Program.cs", import.meta.url);
const projectPath = new URL("../Utilities/DeveloperWorkbench/DeveloperWorkbench.csproj", import.meta.url);
const buildScriptPath = new URL("../Utilities/DeveloperWorkbench/build.ps1", import.meta.url);
const workflowPath = new URL("../.github/workflows/developer-workbench.yml", import.meta.url);
const piBridgePath = new URL("../scripts/pi-work-item-review.mjs", import.meta.url);
const instructionHelperPath = new URL("../Utilities/DeveloperWorkbench/pi-review-instructions.mjs", import.meta.url);
const directLaunchHelperPath = new URL("../Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs", import.meta.url);
const gitignorePath = new URL("../.gitignore", import.meta.url);

const [program, project, buildScript, workflow, piBridge, instructionHelper, directLaunchHelper, gitignore] = await Promise.all([
  readFile(programPath, "utf8"),
  readFile(projectPath, "utf8"),
  readFile(buildScriptPath, "utf8"),
  readFile(workflowPath, "utf8"),
  readFile(piBridgePath, "utf8"),
  readFile(instructionHelperPath, "utf8"),
  readFile(directLaunchHelperPath, "utf8"),
  readFile(gitignorePath, "utf8"),
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
  assert.match(piBridge, /runManagedPiReadOnly/);
  assert.match(piBridge, /read, grep, find, and ls/);
  assert.match(piBridge, /Do not edit files, run shell commands, commit, push/);
  assert.match(piBridge, /## EXACT CODE CHANGES RECOMMENDED/);
  assert.match(piBridge, /Priority; File; Symbol; Change; Evidence; Reason; Regression\/validation/);
  assert.match(piBridge, /Do not expose chain-of-thought/);
});

test("#1349 Pi deliberately loads AGENTS, registered skills and relevant architecture context", () => {
  assert.match(piBridge, /buildInstructionBundle/);
  assert.match(piBridge, /AGENTS\.md is the highest repository instruction authority/);
  assert.match(piBridge, /Skills and architecture documents may refine procedure and ownership, but they never grant permissions/);
  assert.match(instructionHelper, /config\/agent-skills\.json/);
  assert.match(instructionHelper, /skill\.entry/);
  assert.match(instructionHelper, /docs\/architecture/);
  assert.match(instructionHelper, /MAX_BUNDLE_CHARS/);

  const registry = {
    skills: [
      "engineering-discipline",
      "diagnosis",
      "plotpickle-architecture-review",
      "ben-code-quality",
      "uat-repair",
      "sage-brinewick",
      "visual-contract",
      "visual-qa",
    ].map((id) => ({ id })),
  };
  const reviewPackage = {
    issue: { title: "Fix LEARN visual UAT regression", body: "Sage curriculum screen is red in UAT." },
    pullRequest: {
      files: [{ path: "modules/learn/components/LessonView.tsx" }],
      checks: [{ name: "LEARN Validation", status: "COMPLETED", conclusion: "FAILURE" }],
    },
  };
  const selected = selectRelevantSkillIds(reviewPackage, registry);
  for (const required of ["engineering-discipline", "diagnosis", "plotpickle-architecture-review", "ben-code-quality", "uat-repair", "sage-brinewick", "visual-contract", "visual-qa"]) {
    assert.ok(selected.includes(required), `missing relevant skill ${required}`);
  }

  const architecture = selectRelevantArchitecturePaths(reviewPackage, [
    "docs/architecture/developer-agent-stack.md",
    "docs/architecture/MODULAR-FOUNDATION.md",
    "docs/architecture/AVATAR-RECOVERY-LEARN-SYNC.md",
    "docs/architecture/HARDWARE-AWARE-LOCAL-AI.md",
  ]);
  assert.ok(architecture.includes("docs/architecture/developer-agent-stack.md"));
  assert.ok(architecture.includes("docs/architecture/MODULAR-FOUNDATION.md"));
  assert.ok(architecture.includes("docs/architecture/AVATAR-RECOVERY-LEARN-SYNC.md"));
  assert.ok(!architecture.includes("docs/architecture/HARDWARE-AWARE-LOCAL-AI.md"));
});

test("#1349 managed Workbench launches Pi through Node instead of the Windows pi.cmd wrapper", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-direct-"));
  const packageRoot = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent");
  const cliEntry = path.join(packageRoot, "dist", "cli.js");
  try {
    await mkdir(path.dirname(cliEntry), { recursive: true });
    await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({ bin: { pi: "dist/cli.js" } }), "utf8");
    await writeFile(cliEntry, "#!/usr/bin/env node\n", "utf8");
    assert.equal(await resolveManagedPiCliEntry({ root }), cliEntry);
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  assert.match(piBridge, /runManagedPiReadOnly/);
  assert.doesNotMatch(piBridge, /\brunPiReadOnly\b/);
  assert.match(directLaunchHelper, /manifest\.bin/);
  assert.match(directLaunchHelper, /runPortableCommand\(process\.execPath, args/);
  assert.match(directLaunchHelper, /Pi detail:/);
  assert.doesNotMatch(directLaunchHelper, /cmd\.exe|windowsBatchWrapper|pi\.command/);
});

test("#1349 Workbench registers only its explicit local provider and proves inference before the large review", () => {
  assert.match(directLaunchHelper, /WORKBENCH_PROVIDER_ID = "plotpickle-workbench-local"/);
  assert.match(directLaunchHelper, /pi\.registerProvider/);
  assert.match(directLaunchHelper, /plotpickle-workbench-local-provider\.mjs/);
  assert.match(directLaunchHelper, /"--no-extensions"/);
  assert.match(directLaunchHelper, /"--extension", extensionPath/);
  assert.match(directLaunchHelper, /"--no-context-files"/);
  assert.match(directLaunchHelper, /WORKBENCH_SMOKE_TIMEOUT = 45_000/);
  assert.match(directLaunchHelper, /PLOTPICKLE_WORKBENCH_PI_READY/);
  assert.match(directLaunchHelper, /verifyManagedPiInference/);
  assert.match(directLaunchHelper, /await verifyManagedPiInference\(\{ cliEntry, configured, runtime, cwd \}\)/);
  assert.match(directLaunchHelper, /supportsUsageInStreaming: false/);
});

test("#1349 Windows Pi transport keeps rich prompts out of process arguments", () => {
  assert.match(gitignore, /^\/\.plotpickle\/$/m);
  assert.match(piBridge, /promptDirectory = path\.join\(reviewPackage\.repositoryPath, "\.plotpickle", "developer-workbench"\)/);
  assert.match(piBridge, /writeFile\(promptPath, reviewPrompt\(reviewPackage, instructionBundle\), "utf8"\)/);
  assert.match(piBridge, /promptArgument = `@\.plotpickle\/developer-workbench\/\$\{promptFileName\}`/);
  assert.match(piBridge, /prompt:\s*promptArgument/);
  assert.match(piBridge, /rm\(promptPath, \{ force: true \}\)/);
  assert.doesNotMatch(piBridge, /prompt:\s*reviewPrompt\(reviewPackage/);
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

test("#1355 Workbench shows independent readiness lights and gates Pi review on live inference", () => {
  for (const label of ["BUILD", "GITHUB", "LOCAL REPO", "NODE", "PI", "LOCAL LLM", "INFERENCE"]) {
    assert.match(program, new RegExp(`CreateReadinessLabel\\("${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)`));
  }
  assert.match(program, /Refresh readiness/);
  assert.match(program, /Loading Issues\/PRs does not require Pi or a local LLM/);
  assert.match(program, /_reviewWithPi\.Enabled = _evidenceReady && _reviewStackReady/);
  assert.match(program, /report\.Pi\.Ready && report\.Runtime\.Ready && report\.Inference\.Ready/);
  assert.match(program, /Review with Pi is blocked until PI, LOCAL LLM and INFERENCE are green/);
  assert.match(program, /PiReadinessProbe\.RunAsync/);
  assert.match(program, /"--readiness", "--repository-path"/);
  assert.match(piBridge, /async function printReadiness/);
  assert.match(piBridge, /probeManagedPiReadiness/);
  assert.match(piBridge, /purpose: "work-item-readiness"/);
  assert.match(directLaunchHelper, /export async function probeManagedPiReadiness/);
  assert.match(directLaunchHelper, /latencyMs: Date\.now\(\) - startedAt/);
});

test("#1355 Workbench embeds build number and exact source SHA in the EXE and artifact name", () => {
  assert.match(project, /<PlotPickleWorkbenchBuild Condition=/);
  assert.match(project, /<PlotPickleWorkbenchSha Condition=/);
  assert.match(project, /<InformationalVersion>build-\$\(PlotPickleWorkbenchBuild\);sha-\$\(PlotPickleWorkbenchSha\)<\/InformationalVersion>/);
  assert.doesNotMatch(project, /<AssemblyInformationalVersion>/);
  assert.match(program, /WorkbenchBuildIdentity\.Current/);
  assert.match(program, /AssemblyInformationalVersionAttribute/);
  assert.match(program, /Build #\{build\}/);
  assert.match(buildScript, /PLOTPICKLE_WORKBENCH_BUILD/);
  assert.match(buildScript, /PLOTPICKLE_WORKBENCH_SHA/);
  assert.match(buildScript, /PlotPickleWorkbenchBuild/);
  assert.match(buildScript, /PlotPickleWorkbenchSha/);
  assert.match(workflow, /Prepare Workbench build identity/);
  assert.match(workflow, /github\.run_number/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /WORKBENCH_ARTIFACT_NAME=PlotPickle-Developer-Workbench-win-x64-build-/);
  assert.match(workflow, /name: \$\{\{ env\.WORKBENCH_ARTIFACT_NAME \}\}/);
});

test("#1359 Workbench makes the three-step flow and inference failure visible", () => {
  assert.match(program, /1\. Choose GitHub work/);
  assert.match(program, /2\. Review selected evidence/);
  assert.match(program, /3\. Pi developer brief/);
  assert.match(program, /_readinessMessage/);
  assert.match(program, /Text = "Test inference"/);
  assert.match(program, /TestInferenceAsync/);
  assert.match(program, /ApplyPiReadiness/);
  assert.match(program, /Inference problem/);
  assert.match(program, /The exact failure is shown in the diagnostic above/);
  assert.match(program, /SetReadinessButtonsEnabled/);
  assert.doesNotMatch(program, /Hover a red light for detail/);
});