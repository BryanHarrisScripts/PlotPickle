import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = "config/repository-architecture-target.json";
const SKIP = new Set([".git", "node_modules", ".next", ".vinext", ".sites-runtime", "dist", "coverage", ".artifacts", ".wrangler"]);
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const RESOLVABLE_EXTENSIONS = [...SOURCE_EXTENSIONS, ".json"];
const TEXT_EXTENSIONS = new Set([...SOURCE_EXTENSIONS, ".json", ".md", ".yml", ".yaml", ".toml", ".txt", ".css", ".scss", ".ps1", ".cmd", ".bat"]);

async function text(relative) { return readFile(path.join(ROOT, relative), "utf8"); }
async function json(relative) { return JSON.parse(await text(relative)); }

async function walk(dir = ROOT, relative = "") {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    const next = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute, next));
    else if (entry.isFile()) files.push({ path: next, bytes: (await stat(absolute)).size });
  }
  return files;
}

function directoryMetrics(files) {
  const map = new Map();
  const ensure = (directory) => {
    if (!map.has(directory)) map.set(directory, { directory, directFiles: 0, directSourceFiles: 0, totalFiles: 0, bytes: 0, childDirectories: new Set(), maxDescendantDepth: 0 });
    return map.get(directory);
  };
  for (const file of files) {
    const parts = file.path.split("/");
    const parentDepth = parts.length - 1;
    for (let depth = 1; depth <= parentDepth; depth += 1) {
      const directory = parts.slice(0, depth).join("/");
      const item = ensure(directory);
      item.totalFiles += 1;
      item.bytes += file.bytes;
      item.maxDescendantDepth = Math.max(item.maxDescendantDepth, parentDepth - depth);
      if (depth === parentDepth) {
        item.directFiles += 1;
        if (SOURCE_EXTENSIONS.includes(path.extname(file.path))) item.directSourceFiles += 1;
      } else {
        item.childDirectories.add(parts.slice(0, depth + 1).join("/"));
      }
    }
  }
  return [...map.values()].map((item) => ({ ...item, childDirectories: [...item.childDirectories].sort(), directChildDirectoryCount: item.childDirectories.size }));
}

function importSpecifiers(source) {
  const found = [];
  for (const regex of [
    /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ]) for (const match of source.matchAll(regex)) found.push(match[1]);
  return found;
}

function resolveSpecifier(fromPath, specifier, fileSet) {
  let base = "";
  if (specifier.startsWith("@/")) base = specifier.slice(2);
  else if (specifier.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
  else return null;
  const candidates = [base, ...RESOLVABLE_EXTENSIONS.map((ext) => `${base}${ext}`), ...RESOLVABLE_EXTENSIONS.map((ext) => path.posix.join(base, `index${ext}`))];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function matchesBatch(file, batch) {
  if (!file.startsWith(`${batch.sourceRoot}/`)) return false;
  const relative = file.slice(batch.sourceRoot.length + 1);
  if (batch.directFilesOnly !== false && relative.includes("/")) return false;
  const name = path.posix.basename(file);
  const selector = batch.selector ?? {};
  const checks = [];
  if (selector.files?.length) checks.push(selector.files.includes(name));
  if (selector.prefixes?.length) checks.push(selector.prefixes.some((prefix) => name.startsWith(prefix)));
  if (selector.suffixes?.length) checks.push(selector.suffixes.some((suffix) => name.endsWith(suffix)));
  return checks.length ? checks.some(Boolean) : false;
}

function expandMoves(files, config) {
  const moves = [];
  for (const batch of config.moveBatches) {
    const matched = files.filter((file) => matchesBatch(file.path, batch));
    for (const file of matched) {
      moves.push({
        phase: batch.phase,
        batchId: batch.id,
        domain: batch.domain,
        mode: batch.mode ?? "move",
        source: file.path,
        target: batch.targetMap?.[path.posix.basename(file.path)] ?? path.posix.join(batch.targetRoot, path.posix.basename(file.path)),
      });
    }
  }
  return moves;
}

async function buildDependencyEvidence(files, moves) {
  const fileSet = new Set(files.map((file) => file.path));
  const reverseImports = new Map();
  const textCache = new Map();
  const textFiles = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file.path)) && file.bytes <= 1024 * 1024);
  for (const file of textFiles) {
    let source;
    try { source = await text(file.path); } catch { continue; }
    textCache.set(file.path, source);
    if (!SOURCE_EXTENSIONS.includes(path.extname(file.path))) continue;
    for (const specifier of importSpecifiers(source)) {
      const target = resolveSpecifier(file.path, specifier, fileSet);
      if (!target) continue;
      reverseImports.set(target, [...(reverseImports.get(target) ?? []), file.path]);
    }
  }
  return moves.map((move) => {
    const hardcodedPathConsumers = [];
    for (const [file, source] of textCache) if (file !== move.source && source.includes(move.source)) hardcodedPathConsumers.push(file);
    return {
      ...move,
      directImportConsumers: [...new Set(reverseImports.get(move.source) ?? [])].sort(),
      hardcodedPathConsumers: [...new Set(hardcodedPathConsumers)].sort(),
    };
  });
}

function assessPlan(config, files, moves, evidence) {
  const issues = [];
  const sourceSeen = new Map();
  const targetSeen = new Map();
  for (const move of moves) {
    sourceSeen.set(move.source, [...(sourceSeen.get(move.source) ?? []), move.batchId]);
    targetSeen.set(move.target, [...(targetSeen.get(move.target) ?? []), move.source]);
  }
  for (const [source, batches] of sourceSeen) if (batches.length > 1) issues.push(`Planned source appears in multiple move batches: ${source} -> ${batches.join(", ")}`);
  for (const [target, sources] of targetSeen) if (sources.length > 1) issues.push(`Multiple planned sources target the same path: ${target} <- ${sources.join(", ")}`);
  const fileSet = new Set(files.map((file) => file.path));
  for (const batch of config.moveBatches) {
    const matched = moves.filter((move) => move.batchId === batch.id);
    if (!matched.length && batch.allowEmpty !== true) issues.push(`Move batch ${batch.id} matches no current files.`);
  }
  for (const move of moves) if (!fileSet.has(move.source)) issues.push(`Planned move source does not exist: ${move.source}`);
  for (const batch of config.moveBatches.filter((item) => item.targetMustExist)) {
    for (const move of moves.filter((item) => item.batchId === batch.id)) if (!fileSet.has(move.target)) issues.push(`Canonical retirement target does not exist: ${move.target}`);
  }
  for (const item of evidence) if (!Array.isArray(item.directImportConsumers) || !Array.isArray(item.hardcodedPathConsumers)) issues.push(`Missing consumer evidence for ${item.source}`);
  return issues;
}

function hotspots(metrics, config) {
  const exceptions = new Set((config.structuralCeilings.exceptions ?? []).map((item) => item.path));
  const top = metrics.filter((item) => !item.directory.includes("/"));
  const findings = [];
  for (const item of top) {
    const exempt = exceptions.has(item.directory);
    if (item.directSourceFiles >= config.structuralCeilings.flatRootEvidenceThreshold) findings.push({ type: "flat-root", path: item.directory, value: item.directSourceFiles, exempt });
    if (item.directChildDirectoryCount >= config.structuralCeilings.fanOutEvidenceThreshold) findings.push({ type: "fan-out", path: item.directory, value: item.directChildDirectoryCount, exempt });
    if (item.maxDescendantDepth >= config.structuralCeilings.deepTreeEvidenceThreshold) findings.push({ type: "deep-tree", path: item.directory, value: item.maxDescendantDepth, exempt });
  }
  return findings.sort((a, b) => b.value - a.value || a.path.localeCompare(b.path));
}

function markdown(report) {
  const lines = [
    "# PlotPickle repository architecture inventory", "",
    `Status: **${report.status.toUpperCase()}**`,
    `Generated: ${report.generatedAt}`, "",
    "## Repository", "",
    `- files inspected: ${report.repository.fileCount}`,
    `- directories measured: ${report.repository.directoryCount}`,
    `- bytes inspected: ${report.repository.bytes}`, "",
    "## Top-level inventory", "",
    "| Root | Direct files | Direct source files | Child dirs | Total files | Max descendant depth |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...report.topLevel.map((item) => `| ${item.directory}/ | ${item.directFiles} | ${item.directSourceFiles} | ${item.directChildDirectoryCount} | ${item.totalFiles} | ${item.maxDescendantDepth} |`), "",
    "## Evidenced hotspots", "",
    ...(report.hotspots.length ? report.hotspots.map((item) => `- ${item.type}: ${item.path}/ = ${item.value}${item.exempt ? " (documented exception)" : ""}`) : ["- None at the current evidence thresholds."]), "",
    "## Ratified move batches", "",
    ...report.batches.map((batch) => `- Phase ${batch.phase} — ${batch.id} (${batch.mode}): ${batch.moveCount} current file(s) → ${batch.targetRoot}/; ${batch.directConsumerCount} direct import consumer(s); ${batch.hardcodedConsumerCount} hardcoded path consumer(s).`), "",
    "## Structural ceilings for Phase 5 enforcement", "",
    `- governed direct source-file ceiling: ${report.structuralCeilings.maxDirectSourceFiles}`,
    `- governed direct child-directory ceiling: ${report.structuralCeilings.maxDirectChildDirectories}`,
    `- governed relative nesting ceiling: ${report.structuralCeilings.maxRelativeDepth}`,
    `- single-file directory rule: ${report.structuralCeilings.singleFileDirectoryRule}`, "",
    "## Plan validation", "",
    ...(report.planIssues.length ? report.planIssues.map((issue) => `- FAIL — ${issue}`) : ["- PASS — every declared move batch has deterministic current-path expansion and consumer evidence."]), "",
  ];
  return lines.join("\n");
}

export async function runRepositoryArchitectureInventory({ writeArtifact = true } = {}) {
  const [files, config] = await Promise.all([walk(), json(CONFIG_PATH)]);
  const metrics = directoryMetrics(files);
  const expandedMoves = expandMoves(files, config);
  const moveEvidence = await buildDependencyEvidence(files, expandedMoves);
  const planIssues = assessPlan(config, files, expandedMoves, moveEvidence);
  const topLevel = metrics.filter((item) => !item.directory.includes("/")).sort((a, b) => b.totalFiles - a.totalFiles || a.directory.localeCompare(b.directory));
  const batches = config.moveBatches.map((batch) => {
    const items = moveEvidence.filter((item) => item.batchId === batch.id);
    return {
      id: batch.id,
      phase: batch.phase,
      domain: batch.domain,
      mode: batch.mode ?? "move",
      sourceRoot: batch.sourceRoot,
      targetRoot: batch.targetRoot,
      moveCount: items.length,
      directConsumerCount: new Set(items.flatMap((item) => item.directImportConsumers)).size,
      hardcodedConsumerCount: new Set(items.flatMap((item) => item.hardcodedPathConsumers)).size,
    };
  });
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: planIssues.length ? "invalid-plan" : "ratified-plan-ready",
    repository: { fileCount: files.length, directoryCount: metrics.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) },
    topLevel,
    hotspots: hotspots(metrics, config),
    domains: config.domains,
    targetTree: config.targetTree,
    structuralCeilings: config.structuralCeilings,
    batches,
    plannedMoves: moveEvidence,
    planIssues,
  };
  if (writeArtifact) {
    const artifact = path.join(ROOT, ".artifacts", "repository-architecture");
    await mkdir(artifact, { recursive: true });
    await writeFile(path.join(artifact, "inventory.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(path.join(artifact, "inventory.md"), `${markdown(report)}\n`, "utf8");
  }
  return report;
}

async function main() {
  const report = await runRepositoryArchitectureInventory();
  console.log(markdown(report));
  if (report.planIssues.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
