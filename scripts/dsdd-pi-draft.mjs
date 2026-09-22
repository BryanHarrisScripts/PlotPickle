#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ensureManagedPiInstalled } from "./pi-managed-install.mjs";
import { resolvePiLocalRuntime, runPiReadOnly } from "./pi-worker-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_INPUT_BYTES = 96 * 1024;
const MAX_BRIEF_CHARS = 12_000;

async function readStdin() {
  let source = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source, "utf8") > MAX_INPUT_BYTES) throw new Error("DSDD Pi Draft input is too large.");
  }
  const value = JSON.parse(source || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DSDD Pi Draft input is invalid.");
  return value;
}

function clean(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function promptFor(input) {
  const human = clean(input.humanStatement, 12_000);
  const meaning = clean(input.understoodMeaning, 6_000);
  const context = input.context && typeof input.context === "object" ? input.context : null;
  const requirements = Array.isArray(input.requirements)
    ? input.requirements.slice(0, 12).map((item) => ({
        id: clean(item?.id, 40),
        text: clean(item?.text, 2_000),
      }))
    : [];

  return [
    "You are Pi acting as PlotPickle's read-only technical developer-brief drafter for DSDD.",
    "Do not edit, write, delete, run shell commands, create a worktree, commit, push, open an Issue or PR, or change repository state.",
    "The host restricts your tools to read, grep, find and ls. Use only those read-only tools.",
    "Inspect the repository only as much as needed to turn the locked Human intent into implementation-grade technical guidance.",
    "Treat AGENTS.md, the architecture maps, existing governed primitives, current source and focused tests as authoritative repository evidence.",
    "Do not invent files, symbols, architecture owners, tests, or behavior you did not verify.",
    "Prefer reuse of existing contracts/primitives and the smallest implementation path.",
    "Do not provide hidden reasoning. Return only the concise developer brief.",
    "Keep the entire response under 10,000 characters.",
    "",
    "LOCKED HUMAN INTENT",
    human,
    "",
    "DSDD UNDERSTOOD OUTCOME",
    meaning,
    "",
    "CURRENT SURFACE CONTEXT",
    JSON.stringify(context),
    "",
    "LOCKED REQUIREMENTS",
    JSON.stringify(requirements, null, 2),
    "",
    "Return Markdown with exactly these sections:",
    "# Pi Technical Developer Draft",
    "## Outcome",
    "## Architecture ownership",
    "Name the owning PlotPickle layer/domain and why, based on repository evidence.",
    "## Existing contracts and primitives to reuse",
    "## Likely files and symbols",
    "List only evidence-backed candidates; distinguish inspect vs likely change.",
    "## Smallest implementation path",
    "## Deterministic verification",
    "Name focused tests/contracts to add or update and nearby validation to rerun.",
    "## Risks and do-not-change boundaries",
    "## Unknowns",
    "Use 'None found from bounded inspection.' when there are no material unknowns.",
  ].join("\n");
}

async function main() {
  const input = await readStdin();
  const pi = await ensureManagedPiInstalled({ allowInstall: false });
  process.env.PLOTPICKLE_PI_COMMAND = pi.command;
  const runtime = await resolvePiLocalRuntime();
  const result = await runPiReadOnly({
    command: pi.command,
    runtime,
    prompt: promptFor(input),
    cwd: repoRoot,
    purpose: "dsdd-brief",
    timeout: 12 * 60_000,
  });
  const text = String(result.stdout || "").trim().slice(0, MAX_BRIEF_CHARS);
  if (!text) throw new Error("Pi Draft completed without producing a technical developer brief.");
  process.stdout.write(JSON.stringify({
    ok: true,
    reviewer: "pi",
    piVersion: pi.version,
    model: runtime.model,
    runtime: runtime.label,
    tools: ["read", "grep", "find", "ls"],
    repositoryMutation: false,
    text,
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
