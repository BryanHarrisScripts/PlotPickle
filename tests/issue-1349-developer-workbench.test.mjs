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

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");
const [program, project, buildScript, workflow, piBridge, instructionHelper, directLaunchHelper, gitignore, readme, localValidation, localValidationCmd] = await Promise.all([
  read("Utilities/DeveloperWorkbench/Program.cs"),
  read("Utilities/DeveloperWorkbench/DeveloperWorkbench.csproj"),
  read("Utilities/DeveloperWorkbench/build.ps1"),
  read(".github/workflows/developer-workbench.yml"),
  read("scripts/pi-work-item-review.mjs"),
  read("Utilities/DeveloperWorkbench/pi-review-instructions.mjs"),
  read("Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs"),
  read(".gitignore"),
  read("Utilities/DeveloperWorkbench/README.md"),
  read("Utilities/DeveloperWorkbench/local-validation.mjs"),
  read("Utilities/DeveloperWorkbench/Run-Local-Validation.cmd"),
]);

test("#1349 Workbench stays a standalone Windows utility", () => {
  assert.match(project, /<OutputType>WinExe<\/OutputType>/);
  assert.match(project, /<UseWindowsForms>true<\/UseWindowsForms>/);
  assert.match(project, /<PublishSingleFile>true<\/PublishSingleFile>/);
  assert.match(program, /PlotPickle Developer Workbench/);
  assert.match(readme, /outside the PlotPickle product runtime/);
});

test("#1349 Workbench uses GitHub evidence and exact-head freshness", () => {
  assert.match(program, /statusCheckRollup/);
  assert.match(program, /headRefOid/);
  assert.match(program, /Review stale — PR head changed/);
  assert.match(program, /RefreshPrHeadAsync/);
  assert.match(program, /Publish approved brief/);
  assert.match(program, /Reviewed exact PR head/);
});

test("#1349 Pi review stays bounded, read-only and implementation-grade", () => {
  assert.match(piBridge, /runManagedPiReadOnly/);
  assert.match(piBridge, /read, grep, find, and ls/);
  assert.match(piBridge, /Do not edit files, run shell commands, commit, push/);
  assert.match(piBridge, /## EXACT CODE CHANGES RECOMMENDED/);
  assert.match(piBridge, /Priority; File; Symbol; Change; Evidence; Reason; Regression\/validation/);
  assert.match(piBridge, /Do not expose chain-of-thought/);
  assert.doesNotMatch(piBridge, /runPortableCommand\([^)]*(?:git|gh)/i);
});

test("#1349 Pi deliberately loads AGENTS, registered skills and relevant architecture context", () => {
  assert.match(piBridge, /buildInstructionBundle/);
  assert.match(piBridge, /AGENTS\.md is the highest repository instruction authority/);
  assert.match(instructionHelper, /config\/agent-skills\.json/);
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

  assert.match(directLaunchHelper, /manifest\.bin/);
  assert.match(directLaunchHelper, /spawn\(process\.execPath/);
  assert.match(directLaunchHelper, /stdio: \["ignore", "pipe", "pipe"\]/);
  assert.match(directLaunchHelper, /Direct launcher:/);
  assert.doesNotMatch(directLaunchHelper, /cmd\.exe|windowsBatchWrapper|pi\.command/);
});

test("#1373 Workbench direct transport reuses the canonical PlotPickle Pi provider contract", () => {
  assert.match(directLaunchHelper, /WORKBENCH_CANONICAL_PROVIDER_ID = "plotpickle-local"/);
  assert.match(directLaunchHelper, /WORKBENCH_CANONICAL_SMOKE_MARKER = "PLOTPICKLE_PI_READY"/);
  assert.match(directLaunchHelper, /WORKBENCH_CANONICAL_SMOKE_TIMEOUT_MS = 4 \* 60_000/);
  assert.match(directLaunchHelper, /configurePiLocalRuntime/);
  assert.match(directLaunchHelper, /piLocalEnvironment/);
  assert.match(directLaunchHelper, /"--provider", WORKBENCH_CANONICAL_PROVIDER_ID/);
  assert.doesNotMatch(directLaunchHelper, /pi\.registerProvider|plotpickle-workbench-local-provider|WORKBENCH_PROVIDER_ID/);
});

test("#1373 Pi GREEN requires the real canonical local inference proof", () => {
  const installedIndex = piBridge.indexOf("ensureManagedPiInstalled");
  const runtimeIndex = piBridge.indexOf("resolvePiLocalRuntime");
  const proofIndex = piBridge.indexOf("const proof = await probeManagedPiReadiness");
  assert.ok(installedIndex >= 0 && runtimeIndex > installedIndex && proofIndex > runtimeIndex);
  const afterProof = piBridge.slice(proofIndex);
  assert.match(afterProof, /report\.pi\s*=\s*\{\s*ready:\s*true,/s);
  assert.match(piBridge, /real local inference still must pass before Pi is GREEN/);
  assert.match(piBridge, /smokeTimeout: WORKBENCH_CANONICAL_SMOKE_TIMEOUT_MS/);
  assert.match(piBridge, /providerId: "plotpickle-local"/);
  assert.doesNotMatch(piBridge, /raceWorkbenchRuntime|readPinnedWorkbenchRuntime/);
});

test("#1349 Windows Pi transport keeps rich prompts out of process arguments", () => {
  assert.match(gitignore, /^\/\.plotpickle\/$/m);
  assert.match(piBridge, /promptDirectory = path\.join\(reviewPackage\.repositoryPath, "\.plotpickle", "developer-workbench"\)/);
  assert.match(piBridge, /writeFile\(promptPath, reviewPrompt\(reviewPackage, instructionBundle\), "utf8"\)/);
  assert.match(piBridge, /promptArgument = `@\.plotpickle\/developer-workbench\/\$\{promptFileName\}`/);
  assert.match(piBridge, /prompt:\s*promptArgument/);
  assert.match(piBridge, /rm\(promptPath, \{ force: true \}\)/);
});

test("#1355 Workbench shows independent readiness lights and gates Pi review on live inference", () => {
  for (const label of ["BUILD", "GITHUB", "LOCAL REPO", "NODE", "PI", "LOCAL LLM", "INFERENCE"]) {
    assert.match(program, new RegExp(`CreateReadinessLabel\\("${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)`));
  }
  assert.match(program, /Refresh readiness/);
  assert.match(program, /Loading Issues\/PRs does not require Pi or a local LLM/);
  assert.match(program, /_reviewWithPi\.Enabled = _evidenceReady && _reviewStackReady/);
  assert.match(program, /report\.Pi\.Ready && report\.Runtime\.Ready && report\.Inference\.Ready/);
  assert.match(program, /Test inference/);
  assert.match(program, /PiReadinessProbe\.RunAsync/);
});

test("#1355 Workbench embeds build number and exact source SHA in the package", () => {
  assert.match(project, /<PlotPickleWorkbenchBuild Condition=/);
  assert.match(project, /<PlotPickleWorkbenchSha Condition=/);
  assert.match(project, /<InformationalVersion>build-\$\(PlotPickleWorkbenchBuild\);sha-\$\(PlotPickleWorkbenchSha\)<\/InformationalVersion>/);
  assert.match(program, /WorkbenchBuildIdentity\.Current/);
  assert.match(program, /AssemblyInformationalVersionAttribute/);
  assert.match(buildScript, /PLOTPICKLE_WORKBENCH_BUILD/);
  assert.match(buildScript, /PLOTPICKLE_WORKBENCH_SHA/);
  assert.match(workflow, /github\.run_number/);
  assert.match(workflow, /WORKBENCH_ARTIFACT_NAME=PlotPickle-Developer-Workbench-win-x64-build-/);
});

test("#1373 Workbench package includes a local pre-CI gate instead of using GitHub Actions for diagnosis", () => {
  assert.match(localValidation, /scripts\/developer-diagnostics\/test-changed\.mjs/);
  assert.match(localValidation, /scripts\/run-ben-code-quality\.mjs/);
  assert.match(localValidation, /scripts\/build-verified\.mjs/);
  assert.match(localValidation, /LOCAL PRE-CI GREEN/);
  assert.match(localValidation, /shell: false/);
  assert.match(localValidationCmd, /local-validation\.mjs/);
  assert.match(buildScript, /Run-Local-Validation\.cmd/);
  assert.match(buildScript, /local-validation\.mjs/);
  assert.match(workflow, /path: Utilities\/DeveloperWorkbench\/dist\/win-x64\//);
  assert.match(readme, /GitHub Actions can remain the independent exact-head release gate/);
});

test("#1349 Workbench does not introduce credential storage or merge authority", () => {
  assert.doesNotMatch(program, /GITHUB_TOKEN|GH_TOKEN|private[_ -]?key|api[_ -]?key\s*=/i);
  assert.doesNotMatch(program, /["']pr["']\s*,\s*["']merge["']/i);
  assert.doesNotMatch(localValidation, /gh\s+pr\s+merge|GITHUB_TOKEN|GH_TOKEN/i);
});
