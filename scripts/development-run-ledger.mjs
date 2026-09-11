import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const DEVELOPMENT_RUN_LEDGER_MARKER = "<!-- plotpickle-development-run-ledger:v1 -->";
export const DEVELOPMENT_RUN_STATES = Object.freeze([
  "WORKING",
  "WAITING",
  "FIXING",
  "BLOCKED",
  "READY",
  "MERGED",
]);

export const DEVELOPMENT_RUN_GATE_STATUSES = Object.freeze([
  "PENDING",
  "RUNNING",
  "SUCCESS",
  "FAILURE",
  "CANCELLED",
  "SKIPPED",
  "UNKNOWN",
]);

export const REQUIRED_DEVELOPMENT_RUN_GATES = Object.freeze([
  { key: "pr", name: "PR Gate" },
  { key: "product", name: "Product Gate" },
]);

const STATE_ICONS = Object.freeze({
  WORKING: "🔵",
  WAITING: "🟡",
  FIXING: "🔴",
  BLOCKED: "🟠",
  READY: "🟢",
  MERGED: "✅",
});

const GATE_ICONS = Object.freeze({
  PENDING: "⚪",
  RUNNING: "🟡",
  SUCCESS: "✅",
  FAILURE: "❌",
  CANCELLED: "⚫",
  SKIPPED: "⚪",
  UNKNOWN: "❔",
});

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha(value) {
  return nonEmptyString(value) && /^[0-9a-f]{7,64}$/iu.test(value.trim());
}

function sameSha(left, right) {
  return nonEmptyString(left)
    && nonEmptyString(right)
    && left.trim().toLowerCase() === right.trim().toLowerCase();
}

function shortSha(value) {
  return nonEmptyString(value) ? value.trim().slice(0, 12) : "—";
}

function gateFor(run, key) {
  return run?.gates?.[key] ?? null;
}

function gateIsCurrentSuccess(run, key) {
  const gate = gateFor(run, key);
  return gate?.status === "SUCCESS" && sameSha(gate.headSha, run.headSha);
}

export function validateDevelopmentRunLedger(run) {
  const errors = [];

  if (!run || typeof run !== "object" || Array.isArray(run)) {
    return { valid: false, errors: ["Run state must be an object."] };
  }

  if (!Number.isInteger(run.issue) || run.issue <= 0) errors.push("issue must be a positive integer.");
  if (!Number.isInteger(run.pr) || run.pr <= 0) errors.push("pr must be a positive integer.");
  if (!nonEmptyString(run.branch)) errors.push("branch is required.");
  if (!isSha(run.headSha)) errors.push("headSha must be a Git commit SHA.");
  if (!DEVELOPMENT_RUN_STATES.includes(run.state)) errors.push(`state must be one of: ${DEVELOPMENT_RUN_STATES.join(", ")}.`);
  if (!nonEmptyString(run.currentStep)) errors.push("currentStep is required.");

  for (const { key, name } of REQUIRED_DEVELOPMENT_RUN_GATES) {
    const gate = gateFor(run, key);
    if (!gate || typeof gate !== "object") {
      errors.push(`${name} status is required.`);
      continue;
    }
    if (!DEVELOPMENT_RUN_GATE_STATUSES.includes(gate.status)) {
      errors.push(`${name} status must be one of: ${DEVELOPMENT_RUN_GATE_STATUSES.join(", ")}.`);
    }
    if (gate.headSha != null && !isSha(gate.headSha)) errors.push(`${name} headSha must be null or a Git commit SHA.`);
  }

  if (run.state === "WAITING") {
    const waitingOnGate = REQUIRED_DEVELOPMENT_RUN_GATES.some(({ key }) => {
      const status = gateFor(run, key)?.status;
      return status === "PENDING" || status === "RUNNING";
    });
    if (!waitingOnGate) errors.push("WAITING requires at least one required gate to be PENDING or RUNNING.");
  }

  if (run.state === "BLOCKED" && !nonEmptyString(run.blocker)) {
    errors.push("BLOCKED requires blocker to explain the external dependency or Human decision.");
  }

  if (run.state === "READY" || run.state === "MERGED") {
    for (const { key, name } of REQUIRED_DEVELOPMENT_RUN_GATES) {
      if (!gateIsCurrentSuccess(run, key)) {
        errors.push(`${run.state} requires ${name} SUCCESS on the current head SHA.`);
      }
    }
  }

  if (run.state === "MERGED") {
    if (run.merge?.confirmed !== true) errors.push("MERGED requires merge.confirmed=true from GitHub merge evidence.");
    if (!isSha(run.merge?.sha)) errors.push("MERGED requires merge.sha from the confirmed GitHub merge.");
  }

  return { valid: errors.length === 0, errors };
}

function renderGate(run, key, name) {
  const gate = gateFor(run, key);
  const status = gate?.status ?? "UNKNOWN";
  const testedHead = gate?.headSha ? shortSha(gate.headSha) : "—";
  const freshness = gate?.headSha && !sameSha(gate.headSha, run.headSha) ? " ⚠ stale" : "";
  return `| ${name} | ${GATE_ICONS[status] ?? "❔"} ${status} | \`${testedHead}\`${freshness} |`;
}

function renderChangedFiles(run) {
  const files = Array.isArray(run.changedFiles) ? run.changedFiles.filter(nonEmptyString) : [];
  if (files.length === 0) return ["_No changed-file summary recorded yet._"];
  const visible = files.slice(0, 12).map((file) => `- \`${file}\``);
  if (files.length > visible.length) visible.push(`- …and ${files.length - visible.length} more`);
  return visible;
}

function renderNextActions(run) {
  const actions = Array.isArray(run.nextActions) ? run.nextActions.filter(nonEmptyString) : [];
  if (actions.length === 0) return ["_No next action recorded._"];
  return actions.map((action, index) => `${index + 1}. ${action}`);
}

export function renderDevelopmentRunLedger(run) {
  const validation = validateDevelopmentRunLedger(run);
  if (!validation.valid) {
    throw new Error(`Invalid PlotPickle development run ledger:\n- ${validation.errors.join("\n- ")}`);
  }

  const lines = [
    DEVELOPMENT_RUN_LEDGER_MARKER,
    "## PlotPickle Development Run",
    "",
    `> ${STATE_ICONS[run.state]} **${run.state}** — ${run.currentStep.trim()}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Issue | #${run.issue} |`,
    `| PR | #${run.pr} |`,
    `| Branch | \`${run.branch.trim()}\` |`,
    `| Current head | \`${shortSha(run.headSha)}\` |`,
    "",
    "### Verification",
    "",
    "| Gate | Status | Tested head |",
    "| --- | --- | --- |",
    ...REQUIRED_DEVELOPMENT_RUN_GATES.map(({ key, name }) => renderGate(run, key, name)),
    "",
    "### Changed files",
    "",
    ...renderChangedFiles(run),
  ];

  if (run.failure && (nonEmptyString(run.failure.location) || nonEmptyString(run.failure.cause))) {
    lines.push(
      "",
      "### Current failure",
      "",
      nonEmptyString(run.failure.location) ? `**Location:** \`${run.failure.location.trim()}\`` : "**Location:** —",
      "",
      nonEmptyString(run.failure.cause) ? run.failure.cause.trim() : "Cause not recorded yet.",
    );
  }

  if (run.state === "BLOCKED") {
    lines.push("", "### Blocker", "", run.blocker.trim());
  }

  if (run.state === "MERGED") {
    lines.push("", "### Merge", "", `Confirmed by GitHub at \`${shortSha(run.merge.sha)}\`.`);
  }

  lines.push(
    "",
    "### Next action",
    "",
    ...renderNextActions(run),
    "",
    "### Last meaningful action",
    "",
    nonEmptyString(run.lastAction) ? run.lastAction.trim() : "_Not recorded yet._",
    "",
    `Updated: ${nonEmptyString(run.updatedAt) ? run.updatedAt.trim() : "not recorded"}`,
    "",
    "_This comment is the single Human-visible execution ledger for the PR. Update it in place; do not create status-comment spam._",
  );

  return `${lines.join("\n")}\n`;
}

async function readInput(argv) {
  const inputFlag = argv.indexOf("--input");
  if (inputFlag >= 0) {
    const file = argv[inputFlag + 1];
    if (!file) throw new Error("--input requires a JSON file path.");
    return JSON.parse(await readFile(file, "utf8"));
  }

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error("Provide ledger JSON on stdin or with --input <file>.");
  return JSON.parse(text);
}

async function main() {
  const run = await readInput(process.argv.slice(2));
  const validation = validateDevelopmentRunLedger(run);
  if (!validation.valid) {
    process.stderr.write(`${validation.errors.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(renderDevelopmentRunLedger(run));
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
