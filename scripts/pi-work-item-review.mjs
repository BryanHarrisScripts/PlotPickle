#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { runManagedPiReadOnly } from "../Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs";
import { buildInstructionBundle } from "../Utilities/DeveloperWorkbench/pi-review-instructions.mjs";
import { ensureManagedPiInstalled } from "./pi-managed-install.mjs";
import { resolvePiLocalRuntime } from "./pi-worker-runtime.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing required ${name} argument.`);
  return process.argv[index + 1];
}

function boundedReviewPackage(input) {
  const copy = structuredClone(input);
  const serialize = () => JSON.stringify(copy, null, 2);
  let serialized = serialize();
  if (serialized.length <= 180_000) return serialized;

  if (copy.pullRequest?.diff) {
    copy.pullRequest.diff = "[Diff omitted from embedded package because it exceeded the review context budget. Inspect the listed changed files directly with read/grep/find/ls.]";
  }
  for (const item of [copy.issue, copy.pullRequest]) {
    if (!item) continue;
    if (Array.isArray(item.comments)) item.comments = item.comments.slice(-20);
    if (Array.isArray(item.commits)) item.commits = item.commits.slice(-40);
    if (Array.isArray(item.files)) item.files = item.files.slice(0, 120);
  }
  serialized = serialize();
  if (serialized.length <= 180_000) return serialized;
  return `${serialized.slice(0, 180_000)}\n[Review package truncated at the bounded context limit. Treat omitted material as missing evidence and inspect repository files directly where needed.]`;
}

function reviewPrompt(reviewPackage, instructionBundle) {
  return [
    "You are Pi acting as PlotPickle's bounded developer-triage reviewer for one selected GitHub Issue/PR package.",
    "You are advisory only. Do not edit files, run shell commands, commit, push, open/close issues, update pull requests, merge, or change repository state.",
    "The host restricts you to read, grep, find, and ls. Use those tools only to inspect repository evidence relevant to this work item.",
    "Read and obey the host-selected repository instruction bundle below before reviewing the work item.",
    "AGENTS.md is the highest repository instruction authority. Skills and architecture documents may refine procedure and ownership, but they never grant permissions that AGENTS.md or the host withheld.",
    "The instruction bundle is selected from the current local checkout. The recorded GitHub PR head/diff remains the authority for what this review claims about the selected PR. Flag any mismatch instead of silently reconciling it.",
    "Do not expose chain-of-thought. Return findings, evidence references, concise rationale, and implementation recommendations only.",
    "Never reproduce credentials, tokens, private keys, recovery material, or secrets if any appear in repository text or GitHub history.",
    "",
    "Your job is to stop edit/test churn by converting the CURRENT work-item state into one implementation-grade brief.",
    "Distinguish VERIFIED REPOSITORY FACT from INFERENCE/RECOMMENDATION and MISSING EVIDENCE.",
    "Treat the recorded PR head SHA as the exact reviewed head. If the package lacks proof for a claim, say so rather than inventing it.",
    "Do not broaden scope. Prefer the smallest coherent repair that satisfies the Issue and restores deterministic gates.",
    "Do not weaken tests, BEN, security, identity, PPF/canon, provider consent, UAT, or merge boundaries merely to obtain green CI.",
    "Inspect exact touched files/symbols when possible. Do not fabricate line numbers, symbols, APIs, or tests.",
    "",
    "Return concise Markdown using EXACTLY these top-level sections in this order:",
    "# PlotPickle Developer Brief",
    "## CURRENT STATE",
    "## GOAL",
    "## WHAT IS ALREADY IMPLEMENTED",
    "## WHAT IS ACTUALLY BROKEN / MISSING",
    "## ROOT CAUSE OR BEST-SUPPORTED CAUSE",
    "## FILES / OWNERS INVOLVED",
    "## EXACT CODE CHANGES RECOMMENDED",
    "For every recommendation use: Priority; File; Symbol; Change; Evidence; Reason; Regression/validation.",
    "## TESTS / CHECKS TO RUN",
    "## PROPOSED EXECUTION ORDER",
    "## DO NOT CHANGE",
    "## MERGE CONDITION",
    "## MISSING EVIDENCE",
    "",
    "Under EXACT CODE CHANGES RECOMMENDED, implementation guidance must be specific enough that a developer can act without reconstructing the whole Issue/PR history.",
    "Where repository evidence supports it, name exact file paths, symbols/components/functions, affected call sites/imports, intended behavior, and exact regression/test expectations.",
    "Use the selected skills as review procedure where relevant, and cite the relevant instruction source path when it materially controls an ownership or validation recommendation.",
    "If a failing check appears stale or incorrect, explain the evidence and recommend the smallest contract correction; do not simply recommend deleting or weakening it.",
    "Flag repeated fix/revert loops, unrelated file churn, stale briefs, scope expansion, and repeated failing checks when the package proves them.",
    "If the current implementation is already correct and only a deterministic gate is stale, say so clearly.",
    "If evidence is insufficient to identify an exact repair, list the smallest additional evidence needed instead of guessing.",
    "",
    "REPOSITORY INSTRUCTION BUNDLE (host-selected from the local checkout):",
    instructionBundle.markdown,
    "",
    "CURRENT REVIEW PACKAGE (host-collected GitHub evidence):",
    boundedReviewPackage(reviewPackage),
  ].join("\n");
}

async function main() {
  const inputPath = path.resolve(argument("--input"));
  const outputPath = path.resolve(argument("--output"));
  const reviewPackage = JSON.parse(await readFile(inputPath, "utf8"));
  if (!reviewPackage?.repository || !reviewPackage?.repositoryPath) {
    throw new Error("Review package must include repository and repositoryPath.");
  }

  const instructionBundle = await buildInstructionBundle(reviewPackage);
  if (!instructionBundle.sources.includes("AGENTS.md")) {
    throw new Error("Pi work-item review requires AGENTS.md in the selected local repository checkout.");
  }

  const pi = await ensureManagedPiInstalled({
    allowInstall: process.env.PLOTPICKLE_PI_AUTO_INSTALL !== "0",
  });
  process.env.PLOTPICKLE_PI_COMMAND = pi.command;
  const runtime = await resolvePiLocalRuntime();

  const promptDirectory = path.join(reviewPackage.repositoryPath, ".plotpickle", "developer-workbench");
  await mkdir(promptDirectory, { recursive: true });
  const promptFileName = `pi-work-item-prompt-${process.pid}-${Date.now()}.md`;
  const promptPath = path.join(promptDirectory, promptFileName);
  const promptArgument = `@.plotpickle/developer-workbench/${promptFileName}`;
  await writeFile(promptPath, reviewPrompt(reviewPackage, instructionBundle), "utf8");

  let review;
  try {
    review = await runManagedPiReadOnly({
      pi,
      runtime,
      prompt: promptArgument,
      cwd: reviewPackage.repositoryPath,
      purpose: "work-item-review",
      timeout: 15 * 60_000,
    });
  } finally {
    await rm(promptPath, { force: true });
  }

  const markdown = review.stdout.trim();
  if (!markdown) throw new Error("Pi work-item review completed without producing a developer brief.");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${markdown}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
