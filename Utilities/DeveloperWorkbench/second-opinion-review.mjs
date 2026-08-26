#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { runManagedPiReadOnly } from "./pi-managed-node-launch.mjs";
import { buildInstructionBundle } from "./pi-review-instructions.mjs";
import { requiredCliValue } from "./workbench-cli.mjs";
import { ensureManagedPiInstalled } from "../../scripts/pi-managed-install.mjs";
import { resolvePiLocalRuntime } from "../../scripts/pi-worker-runtime.mjs";

const MAX_PACKAGE_CHARS = 185_000;

function bounded(value) {
  const text = JSON.stringify(value, null, 2);
  return text.length <= MAX_PACKAGE_CHARS
    ? text
    : `${text.slice(0, MAX_PACKAGE_CHARS)}\n[Second-opinion package truncated by Developer Workbench context budget. Treat omitted content as missing evidence.]`;
}

function prompt(reviewPackage, instructionBundle, runtime) {
  const primary = String(reviewPackage?.upgradedWorkbenchScan?.primaryReview || "").trim();
  return [
    "You are a second local reviewer for PlotPickle Developer Workbench.",
    "You are advisory only. Do not edit files, run shell commands, commit, push, publish, merge, or change repository state.",
    "The host permits only read, grep, find, and ls for bounded repository inspection.",
    "Read and obey the host-selected repository instruction bundle. AGENTS.md is highest authority.",
    "Do not expose chain-of-thought. Return concise conclusions, evidence references, uncertainty, and recommended verification only.",
    "Never reproduce credentials, tokens, private keys, recovery material, hidden prompts, or secrets.",
    "",
    `Second reviewer target: ${runtime.label || runtime.kind || "Local runtime"} · ${runtime.model || "<unknown model>"}.`,
    "Your purpose is NOT to agree with the primary reviewer. Look specifically for important evidence, dependencies, contracts, tests, runtime assumptions, or minimal repairs the first review may have missed.",
    "Distinguish VERIFIED FACT from HYPOTHESIS and MISSING EVIDENCE.",
    "Never invent files, symbols, APIs, checks, or successful tests.",
    "Prefer the smallest safe repair that reuses existing PlotPickle architecture and contracts.",
    "If the primary brief conflicts with repository evidence or architecture, say so explicitly.",
    "A candidate fix is a proposal only. Never claim it is implemented or verified.",
    "",
    "Return Markdown using EXACTLY these top-level sections:",
    "# PlotPickle Second Opinion",
    "## LIKELY ROOT CAUSE",
    "## MISSING EVIDENCE / COMPONENTS",
    "## CANDIDATE MINIMAL FIX",
    "## ALTERNATIVE FIX",
    "## REGRESSION RISKS",
    "## VERIFICATION",
    "## CONFIDENCE / UNKNOWNS",
    "",
    "PRIMARY REVIEW TO CHALLENGE / COMPLEMENT:",
    primary || "[No primary review was supplied. Treat this as a missing prerequisite.]",
    "",
    "REPOSITORY INSTRUCTION BUNDLE:",
    instructionBundle.markdown,
    "",
    "CURRENT EXACT WORK PACKAGE + OPTIONAL REPOMIX EVIDENCE:",
    bounded(reviewPackage),
  ].join("\n");
}

async function main() {
  const inputPath = path.resolve(requiredCliValue(process.argv, "--input"));
  const outputPath = path.resolve(requiredCliValue(process.argv, "--output"));
  const reviewPackage = JSON.parse(await readFile(inputPath, "utf8"));
  if (!reviewPackage?.repositoryPath || !reviewPackage?.repository) {
    throw new Error("Second-opinion review requires repository and repositoryPath.");
  }
  if (!String(reviewPackage?.upgradedWorkbenchScan?.primaryReview || "").trim()) {
    throw new Error("Second-opinion review requires the current primary Developer Workbench brief.");
  }

  const instructionBundle = await buildInstructionBundle(reviewPackage);
  if (!instructionBundle.sources.includes("AGENTS.md")) {
    throw new Error("Second-opinion review requires AGENTS.md in the selected local repository checkout.");
  }

  const pi = await ensureManagedPiInstalled({ allowInstall: process.env.PLOTPICKLE_PI_AUTO_INSTALL !== "0" });
  process.env.PLOTPICKLE_PI_COMMAND = pi.command;
  const runtime = await resolvePiLocalRuntime();
  const promptDirectory = path.join(reviewPackage.repositoryPath, ".plotpickle", "developer-workbench");
  await mkdir(promptDirectory, { recursive: true });
  const promptName = `second-opinion-prompt-${process.pid}-${Date.now()}.md`;
  const promptPath = path.join(promptDirectory, promptName);
  const promptArgument = `@.plotpickle/developer-workbench/${promptName}`;
  await writeFile(promptPath, prompt(reviewPackage, instructionBundle, runtime), "utf8");

  let result;
  try {
    result = await runManagedPiReadOnly({
      pi,
      runtime,
      prompt: promptArgument,
      cwd: reviewPackage.repositoryPath,
      purpose: "work-item-second-opinion",
      timeout: 15 * 60_000,
    });
  } finally {
    await rm(promptPath, { force: true });
  }

  const markdown = result.stdout.trim();
  if (!markdown) throw new Error("Second-opinion reviewer returned an empty result.");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${markdown}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
