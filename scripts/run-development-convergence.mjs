import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONVERGENCE_DIR = "config/development-convergence/";
const DEFAULT_REPORT_DIR = ".artifacts/development-convergence";
const EVIDENCE_TYPES = new Set(["path-exists", "file-contains"]);

function normalizeRelativePath(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty repository-relative path.`);
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`${field} must stay inside the repository.`);
  }
  return normalized;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isAllowedChange(file, allowedChanges) {
  return allowedChanges.some((entry) => entry.endsWith("/") ? file.startsWith(entry) : file === entry);
}

async function pathExists(root, relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function evaluateEvidence(root, evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { passed: false, reason: "Evidence entry must be an object." };
  }
  if (!EVIDENCE_TYPES.has(evidence.type)) {
    return { passed: false, reason: `Unsupported evidence type: ${String(evidence.type)}` };
  }

  let relativePath;
  try {
    relativePath = normalizeRelativePath(evidence.path, "evidence.path");
  } catch (error) {
    return { passed: false, reason: error.message };
  }

  if (!(await pathExists(root, relativePath))) {
    return { type: evidence.type, path: relativePath, passed: false, reason: "Evidence path does not exist." };
  }

  if (evidence.type === "path-exists") {
    return { type: evidence.type, path: relativePath, passed: true };
  }

  if (typeof evidence.contains !== "string" || !evidence.contains.length) {
    return { type: evidence.type, path: relativePath, passed: false, reason: "file-contains evidence requires a non-empty contains string." };
  }

  const content = await readFile(path.join(root, relativePath), "utf8");
  const passed = content.includes(evidence.contains);
  return {
    type: evidence.type,
    path: relativePath,
    contains: evidence.contains,
    passed,
    ...(passed ? {} : { reason: "Expected contract text was not found." }),
  };
}

export async function evaluateDevelopmentConvergence({
  manifest,
  manifestPath = "<memory>",
  root = process.cwd(),
  changedFiles = [],
}) {
  const manifestErrors = [];
  if (!manifest || typeof manifest !== "object") manifestErrors.push("Manifest must be a JSON object.");
  if (manifest?.schemaVersion !== 1) manifestErrors.push("schemaVersion must be 1.");
  if (!Number.isInteger(manifest?.issue) || manifest.issue <= 0) manifestErrors.push("issue must be a positive integer.");

  let brief = null;
  try {
    brief = normalizeRelativePath(manifest?.brief, "brief");
  } catch (error) {
    manifestErrors.push(error.message);
  }

  let allowedChanges = [];
  if (!Array.isArray(manifest?.allowedChanges) || !manifest.allowedChanges.length) {
    manifestErrors.push("allowedChanges must contain at least one exact file or directory prefix.");
  } else {
    for (const [index, entry] of manifest.allowedChanges.entries()) {
      try {
        allowedChanges.push(normalizeRelativePath(entry, `allowedChanges[${index}]`));
      } catch (error) {
        manifestErrors.push(error.message);
      }
    }
    allowedChanges = uniqueSorted(allowedChanges);
  }

  const acceptance = Array.isArray(manifest?.acceptance) ? manifest.acceptance : [];
  if (!acceptance.length) manifestErrors.push("acceptance must contain at least one criterion.");
  const ids = new Set();
  for (const [index, criterion] of acceptance.entries()) {
    if (!criterion || typeof criterion !== "object") {
      manifestErrors.push(`acceptance[${index}] must be an object.`);
      continue;
    }
    if (typeof criterion.id !== "string" || !criterion.id.trim()) manifestErrors.push(`acceptance[${index}].id must be non-empty.`);
    else if (ids.has(criterion.id)) manifestErrors.push(`Duplicate acceptance id: ${criterion.id}`);
    else ids.add(criterion.id);
    if (typeof criterion.criterion !== "string" || !criterion.criterion.trim()) manifestErrors.push(`acceptance[${index}].criterion must be non-empty.`);
    if (!Array.isArray(criterion.evidence) || !criterion.evidence.length) manifestErrors.push(`acceptance[${index}].evidence must not be empty.`);
  }

  const normalizedChangedFiles = uniqueSorted(changedFiles.map((file, index) => normalizeRelativePath(file, `changedFiles[${index}]`)));
  const unrelatedFiles = allowedChanges.length
    ? normalizedChangedFiles.filter((file) => !isAllowedChange(file, allowedChanges))
    : normalizedChangedFiles;

  const briefExists = brief ? await pathExists(root, brief) : false;
  if (brief && !briefExists) manifestErrors.push(`Developer brief does not exist: ${brief}`);

  const criteria = [];
  for (const criterion of acceptance) {
    if (!criterion || typeof criterion !== "object" || !Array.isArray(criterion.evidence)) continue;
    const evidence = [];
    for (const item of criterion.evidence) evidence.push(await evaluateEvidence(root, item));
    const passed = evidence.length > 0 && evidence.every((item) => item.passed);
    criteria.push({
      id: String(criterion.id || ""),
      criterion: String(criterion.criterion || ""),
      passed,
      evidence,
    });
  }

  const remaining = [];
  for (const error of manifestErrors) remaining.push(error);
  for (const file of unrelatedFiles) remaining.push(`Unrelated changed file: ${file}`);
  for (const criterion of criteria) {
    if (!criterion.passed) remaining.push(`Acceptance ${criterion.id || "<missing-id>"} lacks valid evidence.`);
  }

  const status = remaining.length === 0 ? "CONVERGED" : "NOT_CONVERGED";
  return {
    schemaVersion: 1,
    issue: Number.isInteger(manifest?.issue) ? manifest.issue : null,
    manifest: manifestPath,
    brief,
    status,
    changedFiles: normalizedChangedFiles,
    unrelatedFiles,
    criteria,
    remaining,
  };
}

export function changedFilesFromGit({ root = process.cwd(), baseRef = null } = {}) {
  const resolvedBase = baseRef || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main");
  const mergeBase = execFileSync("git", ["merge-base", "HEAD", resolvedBase], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  }).trim();
  const output = execFileSync("git", ["diff", "--name-only", `${mergeBase}..HEAD`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  return uniqueSorted(output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean));
}

async function loadManifest(root, manifestPath) {
  const normalized = normalizeRelativePath(manifestPath, "manifest");
  const content = await readFile(path.join(root, normalized), "utf8");
  return { path: normalized, value: JSON.parse(content) };
}

function parseArgs(argv) {
  const args = { changed: false, manifest: null, baseRef: null, reportDir: DEFAULT_REPORT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--changed") args.changed = true;
    else if (value === "--manifest") args.manifest = argv[++index] || null;
    else if (value === "--base-ref") args.baseRef = argv[++index] || null;
    else if (value === "--report-dir") args.reportDir = argv[++index] || DEFAULT_REPORT_DIR;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.changed && !args.manifest) throw new Error("Use --changed or --manifest <path>.");
  if (args.changed && args.manifest) throw new Error("Use either --changed or --manifest, not both.");
  return args;
}

async function writeReport(root, reportDir, report) {
  const directory = path.join(root, normalizeRelativePath(reportDir, "reportDir"));
  await mkdir(directory, { recursive: true });
  const suffix = report.issue ? `issue-${report.issue}` : "summary";
  const outputPath = path.join(directory, `${suffix}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path.relative(root, outputPath).replaceAll("\\", "/");
}

export async function runDevelopmentConvergence(argv = process.argv.slice(2), root = process.cwd()) {
  const args = parseArgs(argv);
  const changedFiles = changedFilesFromGit({ root, baseRef: args.baseRef });
  const manifestPaths = args.changed
    ? changedFiles.filter((file) => file.startsWith(CONVERGENCE_DIR) && file.endsWith(".json"))
    : [normalizeRelativePath(args.manifest, "manifest")];

  if (!manifestPaths.length) {
    const summary = {
      schemaVersion: 1,
      status: "NOT_APPLICABLE",
      reason: "No development-convergence manifest changed in this diff.",
      changedFiles,
    };
    const reportPath = await writeReport(root, args.reportDir, summary);
    console.log(`Development convergence: ${summary.status} (${reportPath})`);
    return { exitCode: 0, reports: [summary] };
  }

  const reports = [];
  let failed = false;
  for (const manifestPath of manifestPaths) {
    const loaded = await loadManifest(root, manifestPath);
    const report = await evaluateDevelopmentConvergence({
      manifest: loaded.value,
      manifestPath: loaded.path,
      root,
      changedFiles,
    });
    const reportPath = await writeReport(root, args.reportDir, report);
    console.log(`Development convergence #${report.issue ?? "?"}: ${report.status} (${reportPath})`);
    for (const item of report.remaining) console.log(`- ${item}`);
    if (report.status !== "CONVERGED") failed = true;
    reports.push(report);
  }
  return { exitCode: failed ? 1 : 0, reports };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const result = await runDevelopmentConvergence();
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`Development convergence failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
