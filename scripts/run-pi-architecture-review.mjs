#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ensureManagedPiInstalled } from "./pi-managed-install.mjs";
import {
  resolvePiLocalRuntime,
  runPiReadOnly,
  runPortableCommand,
} from "./pi-worker-runtime.mjs";
import {
  buildPiArchitectureReviewPrompt,
  buildPiCiClassificationPrompt,
  buildPiImpactMapPrompt,
  buildPiSpecReviewPrompt,
  buildPiStandardsReviewPrompt,
  createPiArchitectureReviewEvidence,
  normalizePiCiClassification,
  normalizePiImpactMap,
  normalizePiReviewAxis,
  parsePiJsonResponse,
  renderPiArchitectureReviewMarkdown,
  resolvePiReviewTarget,
  resolvePiSpecDescriptor,
} from "./pi-architecture-review-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localRoot = process.env.LOCALAPPDATA || (process.platform === "win32"
  ? path.join(os.homedir(), "AppData", "Local")
  : path.join(os.homedir(), ".local", "share"));
const defaultEvidenceRoot = path.join(localRoot, "PlotPickle", "developer-agent", "pi-architecture-review");

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(34, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

function parseArgs(argv) {
  const args = { mode: "", base: "main", head: "HEAD", spec: "", impactMap: "", ciLog: "", outputRoot: "" };
  const values = [...argv];
  args.mode = values.shift() || "";
  while (values.length) {
    const flag = values.shift();
    const value = values.shift();
    if (!value) throw new Error(`Missing value for ${flag}.`);
    if (flag === "--base") args.base = value;
    else if (flag === "--head") args.head = value;
    else if (flag === "--spec") args.spec = value;
    else if (flag === "--impact-map") args.impactMap = value;
    else if (flag === "--ci-log") args.ciLog = value;
    else if (flag === "--output-root") args.outputRoot = value;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!new Set(["impact", "review", "ci"]).has(args.mode)) {
    throw new Error("Usage: node scripts/run-pi-architecture-review.mjs <impact|review|ci> [--base main] [--head HEAD] [--spec docs/brief.md] [--impact-map evidence.json] [--ci-log .artifacts/ci.log] [--output-root path]");
  }
  if (args.mode === "impact" && !args.spec) throw new Error("Impact-map mode requires --spec pointing to an authoritative issue/developer brief stored in the repository.");
  if ((args.mode === "review" || args.mode === "ci") && !args.impactMap) throw new Error(`${args.mode} mode requires --impact-map from a prior pre-change impact run.`);
  if (args.mode === "ci" && !args.ciLog) throw new Error("CI mode requires --ci-log containing the exact failing assertion/log evidence.");
  return args;
}

function ensureRepositoryPath(candidate, label) {
  const resolved = path.resolve(repoRoot, candidate);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the PlotPickle repository: ${candidate}`);
  }
  return { absolute: resolved, relative: relative.replaceAll("\\", "/") };
}

async function readBoundedText(filePath, label, maximumBytes = 1024 * 1024) {
  const buffer = await readFile(filePath);
  if (buffer.byteLength > maximumBytes) throw new Error(`${label} is larger than the ${maximumBytes}-byte review limit.`);
  return buffer.toString("utf8").replace(/\u0000/g, "");
}

function redactSensitiveLogLines(value) {
  const sensitive = /(?:authorization\s*:|bearer\s+|api[_-]?key|access[_-]?token|refresh[_-]?token|password\s*[=:]|secret\s*[=:])/i;
  return String(value).split(/\r?\n/).map((line) => sensitive.test(line) ? "[redacted sensitive line]" : line).join("\n");
}

async function git(args) {
  return runPortableCommand("git", args, { cwd: repoRoot, timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
}

async function prepareTarget(target, inputRoot) {
  const targetFile = path.join(inputRoot, "target.json");
  await writeFile(targetFile, `${JSON.stringify(target, null, 2)}\n`, "utf8");
  return path.relative(repoRoot, targetFile).replaceAll("\\", "/");
}

async function prepareDiff(target, inputRoot) {
  const result = await git(["diff", "--no-ext-diff", "--unified=40", `${target.fixedPoint}..${target.reviewedHead}`]);
  const diffFile = path.join(inputRoot, "review.diff");
  await writeFile(diffFile, `${result.stdout || "# No diff between fixed point and reviewed head."}\n`, "utf8");
  return path.relative(repoRoot, diffFile).replaceAll("\\", "/");
}

async function prepareSpec(specPath, inputRoot) {
  const descriptor = resolvePiSpecDescriptor(specPath);
  if (descriptor.status !== "present") return { descriptor, file: "" };
  const repoSpec = ensureRepositoryPath(specPath, "Spec");
  const text = await readBoundedText(repoSpec.absolute, "Spec");
  const specFile = path.join(inputRoot, "spec.md");
  await writeFile(specFile, text, "utf8");
  return {
    descriptor: Object.freeze({ ...descriptor, source: repoSpec.relative }),
    file: path.relative(repoRoot, specFile).replaceAll("\\", "/"),
  };
}

async function prepareImpactMap(impactMapPath, inputRoot) {
  if (!impactMapPath) return { map: null, file: "" };
  const raw = parsePiJsonResponse(await readBoundedText(path.resolve(impactMapPath), "Impact map"), "Impact map evidence");
  const candidate = raw.impactMap || raw;
  const map = normalizePiImpactMap(candidate);
  const impactFile = path.join(inputRoot, "impact-map.json");
  await writeFile(impactFile, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  return { map, file: path.relative(repoRoot, impactFile).replaceAll("\\", "/") };
}

async function prepareCiEvidence(ciLogPath, inputRoot) {
  const repoLog = ensureRepositoryPath(ciLogPath, "CI log");
  const raw = await readBoundedText(repoLog.absolute, "CI log", 2 * 1024 * 1024);
  const ciFile = path.join(inputRoot, "ci-failure.log");
  await writeFile(ciFile, `${redactSensitiveLogLines(raw)}\n`, "utf8");
  return path.relative(repoRoot, ciFile).replaceAll("\\", "/");
}

async function prepareBenEvidence(inputRoot) {
  const benRoot = path.join(inputRoot, "ben");
  await mkdir(benRoot, { recursive: true });
  status("BEN deterministic evidence", "START");
  const scan = await runPortableCommand(process.execPath, [
    "scripts/run-ben-code-quality.mjs",
    "--report-dir", path.relative(repoRoot, benRoot),
  ], {
    cwd: repoRoot,
    timeout: 15 * 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (scan.stdout) process.stdout.write(`${scan.stdout}\n`);
  if (scan.stderr) process.stderr.write(`${scan.stderr}\n`);
  const report = path.join(benRoot, "scan.json");
  status("BEN deterministic evidence", "READY", path.relative(repoRoot, report));
  return path.relative(repoRoot, report).replaceAll("\\", "/");
}

async function runJsonReview({ pi, runtime, purpose, prompt, label }) {
  status(label, "START", `${runtime.model} via ${runtime.label}`);
  const review = await runPiReadOnly({
    command: pi.command,
    runtime,
    prompt,
    cwd: repoRoot,
    purpose,
    timeout: 12 * 60_000,
  });
  const parsed = parsePiJsonResponse(review.stdout, label);
  status(label, "READY");
  return parsed;
}

async function writeEvidence({ evidenceRoot, mode, stamp, evidence }) {
  await mkdir(evidenceRoot, { recursive: true });
  const jsonPath = path.join(evidenceRoot, `pi-${mode}-${stamp}.json`);
  const markdownPath = path.join(evidenceRoot, `pi-${mode}-${stamp}.md`);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, `${renderPiArchitectureReviewMarkdown(evidence)}\n`, "utf8"),
  ]);
  return { jsonPath, markdownPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const inputRoot = path.join(repoRoot, ".artifacts", "pi-architecture-review", stamp);
  const evidenceRoot = args.outputRoot ? path.resolve(args.outputRoot) : defaultEvidenceRoot;
  await mkdir(inputRoot, { recursive: true });

  const target = await resolvePiReviewTarget({ baseRef: args.base, headRef: args.head, runGit: git });
  const targetFile = await prepareTarget(target, inputRoot);
  const spec = await prepareSpec(args.spec, inputRoot);
  const impact = await prepareImpactMap(args.impactMap, inputRoot);

  const pi = await ensureManagedPiInstalled({ allowInstall: false });
  process.env.PLOTPICKLE_PI_COMMAND = pi.command;
  const runtime = await resolvePiLocalRuntime();
  const runtimeEvidence = { model: runtime.model, label: runtime.label, piVersion: pi.version };

  let impactMap = impact.map;
  let architecture = null;
  let standards = null;
  let specReview = null;
  let ci = null;

  if (args.mode === "impact") {
    impactMap = normalizePiImpactMap(await runJsonReview({
      pi,
      runtime,
      purpose: "architecture-impact",
      label: "Pi architecture impact map",
      prompt: buildPiImpactMapPrompt({ targetFile, specFile: spec.file }),
    }));
  } else {
    const diffFile = await prepareDiff(target, inputRoot);
    if (args.mode === "review") {
      const benEvidenceFile = await prepareBenEvidence(inputRoot);
      architecture = normalizePiReviewAxis("architecture", await runJsonReview({
        pi,
        runtime,
        purpose: "architecture-review",
        label: "Pi Architecture review",
        prompt: buildPiArchitectureReviewPrompt({ targetFile, diffFile, specFile: spec.file, impactMapFile: impact.file }),
      }));
      standards = normalizePiReviewAxis("standards", await runJsonReview({
        pi,
        runtime,
        purpose: "standards-review",
        label: "Pi Standards review",
        prompt: buildPiStandardsReviewPrompt({ targetFile, diffFile, impactMapFile: impact.file, benEvidenceFile }),
      }));
      if (spec.descriptor.status === "present") {
        specReview = normalizePiReviewAxis("spec", await runJsonReview({
          pi,
          runtime,
          purpose: "spec-review",
          label: "Pi Spec review",
          prompt: buildPiSpecReviewPrompt({ targetFile, diffFile, specFile: spec.file }),
        }));
      }
    } else {
      const ciEvidenceFile = await prepareCiEvidence(args.ciLog, inputRoot);
      ci = normalizePiCiClassification(await runJsonReview({
        pi,
        runtime,
        purpose: "ci-classification",
        label: "Pi CI classification",
        prompt: buildPiCiClassificationPrompt({ targetFile, diffFile, ciEvidenceFile, impactMapFile: impact.file }),
      }));
    }
  }

  const evidence = createPiArchitectureReviewEvidence({
    target,
    spec: spec.descriptor,
    impactMap,
    architecture,
    standards,
    specReview,
    ci,
    runtime: runtimeEvidence,
  });
  const written = await writeEvidence({ evidenceRoot, mode: args.mode, stamp, evidence });
  status("Pi architecture evidence", "PASS", written.markdownPath);
  process.stdout.write(`${written.jsonPath}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
