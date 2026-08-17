import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
export const VERIFICATION_STAGE_NAMES = [
  "1 of 9 - Agent Skills registry",
  "2 of 9 - Agent Skills architecture boundaries",
  "3 of 9 - LEARN curriculum validation",
  "4 of 9 - Production build",
  "5 of 9 - Ensure Pi local repair model",
  "6 of 9 - Pi repair preflight",
  "7 of 9 - Verify BUZZ live activity",
  "8 of 9 - Exhaustive code-aware UI and UX UAT",
  "9 of 9 - Writer-in-Residence",
];
const CATEGORIES = ["Architecture", "Curriculum", "Production Build", "Local AI / Pi", "BUZZ", "UI / UX UAT", "Writer Journey"];
const SAFE_STATUS = new Set(["PASS", "FAIL", "BLOCKED"]);

export function verificationInboxRoot(env = process.env) {
  if (env.PLOTPICKLE_HOME) return path.join(path.resolve(env.PLOTPICKLE_HOME), "verification-inbox");
  if (env.LOCALAPPDATA) return path.join(env.LOCALAPPDATA, "PlotPickle", "verification-inbox");
  return path.join(os.homedir(), ".plotpickle", "verification-inbox");
}

export function redactVerificationText(value) {
  return String(value ?? "")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/((?:password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*)\S+/gi, "$1[redacted]")
    .replace(/\b[A-Za-z]:\\Users\\[^\\\s]+/gi, "%USERPROFILE%")
    .replace(/\/(?:home|Users)\/[^/\s]+/g, "~")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function gitValue(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? String(result.stdout || "").trim().slice(0, 160) : "";
}

async function packageVersion() {
  try {
    const source = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
    return typeof source.version === "string" ? source.version : "unknown";
  } catch { return "unknown"; }
}

function stageRecord(input, expectedName, index) {
  const source = input && typeof input === "object" ? input : {};
  const status = SAFE_STATUS.has(String(source.Status || source.status).toUpperCase()) ? String(source.Status || source.status).toUpperCase() : "BLOCKED";
  const exitCode = Number(source.ExitCode ?? source.exitCode ?? (status === "PASS" ? 0 : 1));
  const category = redactVerificationText(source.Category ?? source.category) || "Uncategorized";
  const detail = redactVerificationText(source.Detail ?? source.detail);
  return {
    number: index + 1,
    name: expectedName,
    category,
    status,
    exitCode: Number.isFinite(exitCode) ? exitCode : status === "PASS" ? 0 : 1,
    detail,
  };
}

export function normalizeVerificationRecord(input, metadata = {}) {
  const suppliedStages = Array.isArray(input?.stages) ? input.stages : [];
  const stages = VERIFICATION_STAGE_NAMES.map((name, index) => {
    const match = suppliedStages.find((item) => item && (item.Step === name || item.name === name));
    return stageRecord(match, name, index);
  });
  const passCount = stages.filter((stage) => stage.status === "PASS").length;
  const deterministicResult = passCount === stages.length ? "PASS" : "FAIL";
  const categoryResults = CATEGORIES.map((category) => {
    const items = stages.filter((stage) => stage.category === category);
    const status = items.some((item) => item.status === "FAIL") ? "FAIL"
      : items.some((item) => item.status === "BLOCKED") ? "BLOCKED"
        : items.length && items.every((item) => item.status === "PASS") ? "PASS" : "NOT RUN";
    return { category, status };
  });
  const rawLogName = path.basename(String(input?.rawLogName || ""));
  const failureSummaries = stages.filter((stage) => stage.status !== "PASS").map((stage) => ({
    stage: stage.name,
    status: stage.status,
    summary: stage.detail || (stage.status === "BLOCKED" ? "Stage was blocked." : `Stage exited with code ${stage.exitCode}.`),
  }));
  return {
    schemaVersion: 1,
    runId: metadata.runId || `verification-${Date.now()}-${randomUUID().slice(0, 8)}`,
    plotPickleVersion: metadata.plotPickleVersion || "unknown",
    git: { commit: metadata.commit || "", ref: metadata.ref || "" },
    startedAt: String(input?.startedAt || ""),
    completedAt: String(input?.completedAt || ""),
    platformClass: metadata.platformClass || `${process.platform}/${process.arch}`,
    deterministicResult,
    passCount,
    totalStages: stages.length,
    headline: deterministicResult === "PASS"
      ? `${passCount}/${stages.length} PASS — PlotPickle verification complete`
      : `${passCount}/${stages.length} PASS — ${stages.length - passCount} checks need attention`,
    stages,
    categoryResults,
    evidenceReferences: rawLogName ? [{ kind: "transcript", ref: `full-verification/${rawLogName}` }] : [],
    agentObservations: [],
    failureSummaries,
    repairAttempts: [],
    retests: [],
    integrity: {
      deterministicResultDerivedFromStages: true,
      agentMayOverrideResult: false,
      recordIsAppendOnly: true,
      storyCanon: false,
    },
  };
}

export async function writeVerificationRecord(input, options = {}) {
  const metadata = {
    runId: options.runId,
    plotPickleVersion: options.plotPickleVersion || await packageVersion(),
    commit: options.commit ?? gitValue(["rev-parse", "HEAD"]),
    ref: options.ref ?? gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
    platformClass: options.platformClass || `${process.platform}/${process.arch}`,
  };
  const record = normalizeVerificationRecord(input, metadata);
  const root = options.root || verificationInboxRoot();
  const recordsRoot = path.join(root, "records");
  await mkdir(recordsRoot, { recursive: true, mode: 0o700 });
  const filePath = path.join(recordsRoot, `${record.runId}.json`);
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return { record, filePath };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { record, filePath } = await writeVerificationRecord(await readStdin());
    process.stdout.write(JSON.stringify({ ok: true, runId: record.runId, deterministicResult: record.deterministicResult, passCount: record.passCount, totalStages: record.totalStages, filePath }));
  } catch (error) {
    process.stderr.write(redactVerificationText(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
