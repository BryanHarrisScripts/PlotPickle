#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  ensurePiInstalled,
  resolvePiLocalRuntime,
  runPiReadOnly,
  runPortableCommand,
} from "./pi-worker-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localRoot = process.env.LOCALAPPDATA || (process.platform === "win32"
  ? path.join(os.homedir(), "AppData", "Local")
  : path.join(os.homedir(), ".local", "share"));
const scanRoot = path.join(repoRoot, ".artifacts", "pi-code-quality", "ben");
const evidenceRoot = path.join(localRoot, "PlotPickle", "full-verification", "pi-code-quality");

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(38, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

function reviewPrompt() {
  return [
    "You are Pi acting only as PlotPickle's non-authoritative code-quality reviewer.",
    "You are not a repair agent in this run. Do not edit, write, delete, run shell commands, commit, push, or change repository state.",
    "The host has restricted you to read, grep, find, and ls tools. Respect that boundary.",
    "",
    "First read .agents/skills/ben-code-quality/SKILL.md and .artifacts/pi-code-quality/ben/scan.json.",
    "Use the BEN/slop-scan report as deterministic evidence, then inspect only the relevant source files needed to verify or reject a recommendation.",
    "Look especially for AI-generated code smell: duplicated implementations, over-abstraction, needless wrappers, generic names, directory fan-out, giant orchestrators, repeated defensive boilerplate, dead compatibility paths, inefficient repeated work, and code that is hard for humans or future agents to discover.",
    "Do not assume every scanner finding is valid. Distinguish genuine maintainability/efficiency problems from accepted architecture or historical debt.",
    "Do not recommend broad rewrites. Prefer the smallest change that improves clarity, runtime/build efficiency, discoverability, or maintenance cost.",
    "Never weaken PPF/canon, trust, credential, provider, UAT, Full Verification, or merge boundaries to make code shorter.",
    "",
    "Return concise Markdown with these sections:",
    "# Pi Code Quality Review",
    "## Executive summary",
    "## Recommended improvements",
    "For each recommendation include: priority, exact file/symbol, evidence, why it matters, smallest safe improvement, and deterministic validation to rerun.",
    "Limit recommendations to the ten strongest evidence-backed items.",
    "## Scanner findings that do not need action",
    "## Existing debt worth tracking later",
    "",
    "If no material improvements are justified, say so clearly instead of inventing work.",
  ].join("\n");
}

async function main() {
  const pi = await ensurePiInstalled({ allowInstall: false });
  const runtime = await resolvePiLocalRuntime();
  await mkdir(scanRoot, { recursive: true });
  await mkdir(evidenceRoot, { recursive: true });

  status("BEN/slop evidence", "START", "current-tree deterministic scan");
  const scan = await runPortableCommand(process.execPath, [
    "scripts/run-ben-code-quality.mjs",
    "--report-dir", path.relative(repoRoot, scanRoot),
  ], {
    cwd: repoRoot,
    timeout: 15 * 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (scan.stdout) process.stdout.write(`${scan.stdout}\n`);
  if (scan.stderr) process.stderr.write(`${scan.stderr}\n`);
  status("BEN/slop evidence", "READY", path.relative(repoRoot, path.join(scanRoot, "scan.json")));

  status("Pi code-quality review", "START", `${runtime.model} via ${runtime.label}`);
  const review = await runPiReadOnly({
    command: pi.command,
    runtime,
    prompt: reviewPrompt(),
    cwd: repoRoot,
    purpose: "code-review",
    timeout: 12 * 60_000,
  });
  if (!review.stdout.trim()) throw new Error("Pi code-quality review completed without producing recommendations or a no-action conclusion.");

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const markdownPath = path.join(evidenceRoot, `pi-code-quality-${stamp}.md`);
  const metadataPath = path.join(evidenceRoot, `pi-code-quality-${stamp}.json`);
  await Promise.all([
    writeFile(markdownPath, `${review.stdout.trim()}\n`, "utf8"),
    writeFile(metadataPath, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      reviewer: "pi",
      authoritative: false,
      writesAllowed: false,
      tools: ["read", "grep", "find", "ls"],
      deterministicEvidence: path.join(scanRoot, "scan.json"),
      model: runtime.model,
      runtime: runtime.label,
      piVersion: pi.version,
      review: markdownPath,
      note: "Pi recommendations are advisory. BEN/slop-scan, tests, build, UAT, Full Verification, and repository merge gates remain authoritative.",
    }, null, 2)}\n`, "utf8"),
  ]);
  status("Pi code-quality review", "PASS", markdownPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
