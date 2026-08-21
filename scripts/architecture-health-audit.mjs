import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  ".vinext",
  "dist",
  "coverage",
  ".artifacts",
  ".wrangler",
]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PRODUCTION_GLOBAL_SIGNAL_ROOTS = new Set(["app", "core", "modules", "lib", "adapters", "build"]);
const MAJOR_DIRECTORY_CLASSIFICATION = {
  app: "active production runtime / application composition",
  core: "public contracts and canonical host-owned domain state",
  modules: "feature modules",
  lib: "shared host-owned services and compatibility code",
  build: "runtime/build orchestration and developer execution",
  adapters: "provider and external integration adapters",
  config: "host-owned declarative configuration",
  scripts: "developer, verification and managed-runtime tooling",
  tests: "deterministic verification only",
  ".agents": "shared Agent Skills and agent procedure assets",
  ".pi": "Pi developer-worker integration",
  ".cline": "Cline compatibility/integration surface",
  ".codex": "Codex compatibility/integration surface",
  ".openai": "OpenAI developer integration surface",
  docs: "documentation, architecture decisions and historical evidence",
  public: "static product assets",
};

async function exists(absolutePath) {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function walkDirectory(absoluteDirectory, relativeDirectory = "") {
  if (!(await exists(absoluteDirectory))) return [];
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORY_NAMES.has(entry.name)) continue;
    const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
    const absolutePath = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await walkDirectory(absolutePath, relativePath));
    else if (entry.isFile()) {
      const details = await stat(absolutePath);
      files.push({ path: relativePath, bytes: details.size });
    }
  }
  return files;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
}

async function readText(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function sumBytes(files) {
  return files.reduce((total, file) => total + file.bytes, 0);
}

function duplicateValues(record) {
  const byValue = new Map();
  for (const [key, value] of Object.entries(record)) {
    const list = byValue.get(value) ?? [];
    list.push(key);
    byValue.set(value, list);
  }
  return [...byValue.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([command, keys]) => ({ command, keys }));
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

function moduleNameFor(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  const parts = normalized.split("/");
  return parts[0] === "modules" ? parts[1] : null;
}

function resolvedRelativeImport(sourcePath, specifier) {
  if (!specifier.startsWith(".")) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier));
}

async function auditModuleBoundaries(files) {
  const sourceFiles = files.filter((file) => file.path.startsWith("modules/") && SOURCE_EXTENSIONS.has(path.extname(file.path)));
  const violations = [];
  for (const file of sourceFiles) {
    const sourceModule = moduleNameFor(file.path);
    const source = await readText(file.path);
    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolvedRelativeImport(file.path, specifier);
      if (!resolved?.startsWith("modules/")) continue;
      const targetModule = moduleNameFor(resolved);
      if (targetModule && sourceModule && targetModule !== sourceModule) {
        violations.push({ source: file.path, target: specifier, sourceModule, targetModule });
      }
    }
  }
  return violations;
}

async function auditGlobalStateSignals(files) {
  const signals = [];
  const suspicious = /\b(globalThis\.)?(currentProfile|currentHuman|currentProject|currentProvider|currentSigner|currentMemoryStore)\b/g;
  for (const file of files) {
    const root = file.path.split("/")[0];
    if (!PRODUCTION_GLOBAL_SIGNAL_ROOTS.has(root) || !SOURCE_EXTENSIONS.has(path.extname(file.path))) continue;
    const source = await readText(file.path);
    const matches = [...source.matchAll(suspicious)].map((match) => match[0]);
    if (matches.length) signals.push({ path: file.path, matches: [...new Set(matches)] });
  }
  return signals;
}

async function directoryInventory(files) {
  const inventory = [];
  for (const [directory, classification] of Object.entries(MAJOR_DIRECTORY_CLASSIFICATION)) {
    const prefix = `${directory}/`;
    const present = await exists(path.join(ROOT, directory));
    const ownedFiles = files.filter((file) => file.path === directory || file.path.startsWith(prefix));
    inventory.push({ directory, classification, present, fileCount: ownedFiles.length, bytes: sumBytes(ownedFiles) });
  }
  return inventory;
}

async function builtOutputInventory() {
  const candidates = [".vinext", ".next", "dist"];
  const output = [];
  for (const directory of candidates) {
    const absolute = path.join(ROOT, directory);
    if (!(await exists(absolute))) continue;
    const files = await walkDirectory(absolute, directory);
    output.push({ directory, fileCount: files.length, bytes: sumBytes(files) });
  }
  return output;
}

function markdownReport(report) {
  const lines = [
    "# PlotPickle architecture health audit",
    "",
    `Status: **${report.status.toUpperCase()}**`,
    `Generated: ${report.generatedAt}`,
    `Audit runtime: ${report.performance.auditDurationMs} ms`,
    "",
    "## Architecture invariants",
    "",
    ...report.invariants.map((item) => `- ${item.pass ? "PASS" : "FAIL"} — ${item.name}${item.detail ? `: ${item.detail}` : ""}`),
    "",
    "## Repository surface",
    "",
    `- tracked source/developer files inspected: ${report.repository.fileCount}`,
    `- inspected bytes: ${report.repository.bytes}`,
    `- package scripts: ${report.packageSurface.scriptCount}`,
    `- scripts directly referencing historical issue-number tests: ${report.packageSurface.issueReferencedScriptCount}`,
    `- duplicate script command bodies: ${report.packageSurface.duplicateCommandBodies.length}`,
    `- production dependencies: ${report.dependencies.production}`,
    `- development dependencies: ${report.dependencies.development}`,
    "",
    "## Major directories",
    "",
    ...report.directories.map((item) => `- ${item.directory}/ — ${item.classification}; ${item.fileCount} files; ${item.bytes} bytes`),
    "",
    "## Review signals",
    "",
    `- mutable-current-state token signals requiring human review (not automatic defects): ${report.reviewSignals.globalState.length}`,
    `- mirrored MCP compatibility config matches canonical config: ${report.mcp.mirrorMatchesCanonical}`,
    "",
    "## Build output present during this run",
    "",
    ...(report.performance.builtOutputs.length
      ? report.performance.builtOutputs.map((item) => `- ${item.directory}: ${item.fileCount} files; ${item.bytes} bytes`)
      : ["- No production build output was present. Run this audit after `npm run build` to capture bundle/output size."]),
    "",
    "## Material findings",
    "",
    ...(report.materialFindings.length ? report.materialFindings.map((finding) => `- ${finding}`) : ["- None."]),
    "",
    "Historical issue-number test commands are reported as maintenance surface only. They are not removed unless a stable subsystem command proves equivalent coverage.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export async function runArchitectureHealthAudit({ writeArtifact = true } = {}) {
  const started = performance.now();
  const files = await walkDirectory(ROOT);
  const packageJson = await readJson("package.json");
  const agentSkills = await readJson("config/agent-skills.json");
  const runtimeManifest = await readJson("config/runtime-manifest.json");
  const mcp = await readJson(".mcp.json");
  const clineMcp = (await exists(path.join(ROOT, ".cline/mcp.json"))) ? await readJson(".cline/mcp.json") : null;
  const pluginPlatform = await readText("lib/plugin-platform.ts");
  const coreServices = await readText("lib/core-services.ts");
  const moduleBoundaryViolations = await auditModuleBoundaries(files);
  const globalStateSignals = await auditGlobalStateSignals(files);
  const skillIds = agentSkills.skills.map((skill) => skill.id);
  const duplicateSkillIds = skillIds.filter((id, index) => skillIds.indexOf(id) !== index);
  const missingSkillEntries = [];
  for (const skill of agentSkills.skills) if (!(await exists(path.join(ROOT, skill.entry)))) missingSkillEntries.push(skill.entry);
  const runtimeIds = runtimeManifest.components.map((component) => component.id);
  const duplicateRuntimeIds = runtimeIds.filter((id, index) => runtimeIds.indexOf(id) !== index);
  const futureNode = runtimeManifest.components.find((component) => component.id === "plotpickle-node-service");
  const mcpServerNames = Object.keys(mcp.mcpServers ?? {});
  const mirrorMatchesCanonical = clineMcp ? JSON.stringify(clineMcp) === JSON.stringify(mcp) : null;
  const scripts = packageJson.scripts ?? {};
  const issueReferencedScriptCount = Object.values(scripts).filter((command) => /tests\/issue-\d+/i.test(command)).length;
  const materialFindings = [];
  const invariants = [];
  const addInvariant = (name, pass, detail = "") => {
    invariants.push({ name, pass, detail });
    if (!pass) materialFindings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  };

  addInvariant("PluginHost remains the versioned plugin authority", pluginPlatform.includes("export class PluginHost") && pluginPlatform.includes("PLUGIN_API_VERSION"));
  addInvariant("Core Services remain the permissioned plugin service boundary", coreServices.includes("export type PlotPickleServices") && coreServices.includes("authorizeService"));
  addInvariant("Agent Skills use one progressive registry with unique IDs", agentSkills.discovery === "progressive" && duplicateSkillIds.length === 0, duplicateSkillIds.join(", "));
  addInvariant("Every registered Agent Skill entry exists", missingSkillEntries.length === 0, missingSkillEntries.join(", "));
  addInvariant("Canonical MCP surface contains exactly one PlotPickle server", mcpServerNames.length === 1 && mcpServerNames[0] === "plotpickle-dev", mcpServerNames.join(", "));
  addInvariant("Cline MCP compatibility mirror cannot drift from canonical MCP config", mirrorMatchesCanonical !== false);
  addInvariant("Runtime Supervisor manifest has unique component owners", runtimeManifest.authority === "plotpickle-runtime-supervisor" && duplicateRuntimeIds.length === 0, duplicateRuntimeIds.join(", "));
  addInvariant("Future compute Node remains disabled by default", !futureNode || futureNode.enabled === false);
  addInvariant("Feature modules do not import sibling module internals", moduleBoundaryViolations.length === 0, moduleBoundaryViolations.slice(0, 5).map((item) => `${item.source} -> ${item.target}`).join("; "));

  const elapsed = Math.round((performance.now() - started) * 100) / 100;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: materialFindings.length ? "violated" : issueReferencedScriptCount > 0 ? "healthy-with-cleanup" : "healthy",
    invariants,
    materialFindings,
    repository: { fileCount: files.length, bytes: sumBytes(files) },
    directories: await directoryInventory(files),
    packageSurface: {
      scriptCount: Object.keys(scripts).length,
      issueReferencedScriptCount,
      duplicateCommandBodies: duplicateValues(scripts),
    },
    dependencies: {
      production: Object.keys(packageJson.dependencies ?? {}).length,
      development: Object.keys(packageJson.devDependencies ?? {}).length,
      optional: Object.keys(packageJson.optionalDependencies ?? {}).length,
    },
    plugins: {
      apiVersionDeclared: pluginPlatform.includes("PLUGIN_API_VERSION"),
      coreServicesApiDeclared: coreServices.includes("CORE_SERVICES_API_VERSION"),
    },
    agents: {
      skillCount: agentSkills.skills.length,
      duplicateSkillIds,
      missingSkillEntries,
      mcpReadyCount: agentSkills.skills.filter((skill) => skill.mcpReady).length,
    },
    mcp: { canonicalServerCount: mcpServerNames.length, canonicalServers: mcpServerNames, mirrorMatchesCanonical },
    runtime: { componentCount: runtimeManifest.components.length, duplicateRuntimeIds, futureNodeEnabled: futureNode?.enabled ?? null },
    modules: { crossModulePrivateImportViolations: moduleBoundaryViolations },
    reviewSignals: { globalState: globalStateSignals },
    performance: { auditDurationMs: elapsed, builtOutputs: await builtOutputInventory() },
  };

  if (writeArtifact) {
    const artifactDirectory = path.join(ROOT, ".artifacts", "architecture-health");
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(path.join(artifactDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(path.join(artifactDirectory, "report.md"), markdownReport(report), "utf8");
  }
  return report;
}

async function main() {
  const report = await runArchitectureHealthAudit({ writeArtifact: true });
  console.log(markdownReport(report));
  if (report.materialFindings.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
