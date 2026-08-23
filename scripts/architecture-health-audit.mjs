import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "node_modules", ".next", ".vinext", "dist", "coverage", ".artifacts", ".wrangler"]);
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const DIRECTORY_CLASSES = {
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

async function exists(file) { try { await stat(file); return true; } catch { return false; } }
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

function imports(source) {
  const found = [];
  for (const regex of [/\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g, /\bimport\(\s*["']([^"']+)["']\s*\)/g]) {
    for (const match of source.matchAll(regex)) found.push(match[1]);
  }
  return found;
}

async function sourceTarget(base) {
  for (const candidate of [base, ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`), ...SOURCE_EXTENSIONS.map((ext) => path.posix.join(base, `index${ext}`))]) {
    if (await exists(path.join(ROOT, candidate))) return candidate;
  }
  return null;
}

function isCoreBridge(source) {
  const code = source.replace(/^\s*\/\/.*$/gm, "").trim();
  const statements = code.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return statements.length > 0 && statements.every((line) => /^export\s+\*\s+from\s+["'](?:\.\.\/)+core\/[^"']+["'];?$/.test(line));
}

async function moduleBoundaryAudit(files) {
  const violations = [];
  const bridges = [];
  for (const file of files.filter((item) => item.path.startsWith("modules/") && SOURCE_EXTENSIONS.includes(path.extname(item.path)))) {
    const sourceModule = file.path.split("/")[1];
    for (const specifier of imports(await text(file.path))) {
      if (!specifier.startsWith(".")) continue;
      const targetBase = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), specifier));
      if (!targetBase.startsWith("modules/")) continue;
      const targetModule = targetBase.split("/")[1];
      if (targetModule === sourceModule) continue;
      const target = await sourceTarget(targetBase);
      if (target && isCoreBridge(await text(target))) bridges.push({ source: file.path, target });
      else violations.push({ source: file.path, target: specifier, sourceModule, targetModule });
    }
  }
  return { violations, bridges };
}

async function directoryInventory(files) {
  return Promise.all(Object.entries(DIRECTORY_CLASSES).map(async ([directory, classification]) => {
    const owned = files.filter((file) => file.path.startsWith(`${directory}/`));
    return { directory, classification, present: await exists(path.join(ROOT, directory)), fileCount: owned.length, bytes: owned.reduce((sum, file) => sum + file.bytes, 0) };
  }));
}

function duplicateCommands(scripts) {
  const grouped = new Map();
  for (const [name, command] of Object.entries(scripts)) grouped.set(command, [...(grouped.get(command) ?? []), name]);
  return [...grouped.entries()].filter(([, names]) => names.length > 1).map(([command, names]) => ({ command, names }));
}

async function globalSignals(files) {
  const pattern = /\b(globalThis\.)?(currentProfile|currentHuman|currentProject|currentProvider|currentSigner|currentMemoryStore)\b/g;
  const signals = [];
  for (const file of files.filter((item) => ["app", "core", "modules", "lib", "adapters", "build"].includes(item.path.split("/")[0]) && SOURCE_EXTENSIONS.includes(path.extname(item.path)))) {
    const matches = [...(await text(file.path)).matchAll(pattern)].map((match) => match[0]);
    if (matches.length) signals.push({ path: file.path, matches: [...new Set(matches)] });
  }
  return signals;
}

async function outputSizes() {
  const result = [];
  for (const directory of [".vinext", ".next", "dist"]) {
    if (!(await exists(path.join(ROOT, directory)))) continue;
    const files = await walk(path.join(ROOT, directory), directory);
    result.push({ directory, fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) });
  }
  return result;
}

function markdown(report) {
  return [
    "# PlotPickle architecture health audit", "",
    `Status: **${report.status.toUpperCase()}**`, `Generated: ${report.generatedAt}`, `Audit runtime: ${report.performance.auditDurationMs} ms`, "",
    "## Architecture invariants", "", ...report.invariants.map((item) => `- ${item.pass ? "PASS" : "FAIL"} — ${item.name}${item.detail ? `: ${item.detail}` : ""}`), "",
    "## Repository surface", "",
    `- files inspected: ${report.repository.fileCount}`, `- inspected bytes: ${report.repository.bytes}`,
    `- package scripts: ${report.packageSurface.scriptCount}`, `- scripts referencing historical issue-number tests: ${report.packageSurface.issueReferencedScriptCount}`,
    `- duplicate command bodies: ${report.packageSurface.duplicateCommandBodies.length}`, `- production dependencies: ${report.dependencies.production}`, `- development dependencies: ${report.dependencies.development}`, "",
    "## Boundary cleanup", "", `- private sibling-module violations: ${report.modules.crossModulePrivateImportViolations.length}`, `- core-owned compatibility bridges: ${report.modules.coreCompatibilityBridges.length}`, `- mutable-current-state review signals: ${report.reviewSignals.globalState.length}`, "",
    "## Major directories", "", ...report.directories.map((item) => `- ${item.directory}/ — ${item.classification}; ${item.fileCount} files; ${item.bytes} bytes`), "",
    "## Build output", "", ...(report.performance.builtOutputs.length ? report.performance.builtOutputs.map((item) => `- ${item.directory}: ${item.fileCount} files; ${item.bytes} bytes`) : ["- No build output present; run after production build to capture it."]), "",
    "## Material findings", "", ...(report.materialFindings.length ? report.materialFindings.map((item) => `- ${item}`) : ["- None."]), "",
    "Historical issue-linked commands are maintenance surface, not runtime failure. Healthy subsystems are left alone.", "",
  ].join("\n");
}

export async function runArchitectureHealthAudit({ writeArtifact = true } = {}) {
  const started = performance.now();
  const files = await walk();
  const [packageJson, skills, runtime, mcp, pluginSource, serviceSource] = await Promise.all([
    json("package.json"), json("config/agent-skills.json"), json("config/runtime-manifest.json"), json(".mcp.json"), text("lib/plugin-platform.ts"), text("lib/core-services.ts"),
  ]);
  const clineMcp = await exists(path.join(ROOT, ".cline/mcp.json")) ? await json(".cline/mcp.json") : null;
  const moduleAudit = await moduleBoundaryAudit(files);
  const skillIds = skills.skills.map((skill) => skill.id);
  const duplicateSkillIds = skillIds.filter((id, index) => skillIds.indexOf(id) !== index);
  const missingSkillEntries = [];
  for (const skill of skills.skills) if (!(await exists(path.join(ROOT, skill.entry)))) missingSkillEntries.push(skill.entry);
  const runtimeIds = runtime.components.map((component) => component.id);
  const duplicateRuntimeIds = runtimeIds.filter((id, index) => runtimeIds.indexOf(id) !== index);
  const futureNode = runtime.components.find((component) => component.id === "plotpickle-node-service");
  const mcpServers = Object.keys(mcp.mcpServers ?? {});
  const scripts = packageJson.scripts ?? {};
  const issueReferencedScriptCount = Object.values(scripts).filter((command) => /tests\/issue-\d+/i.test(command)).length;
  const materialFindings = [];
  const invariants = [];
  const check = (name, pass, detail = "") => { invariants.push({ name, pass, detail }); if (!pass) materialFindings.push(`${name}${detail ? ` — ${detail}` : ""}`); };

  check("PluginHost remains versioned plugin authority", pluginSource.includes("export class PluginHost") && pluginSource.includes("PLUGIN_API_VERSION"));
  check("Core Services remain permissioned plugin boundary", serviceSource.includes("export type PlotPickleServices") && serviceSource.includes("authorizeService"));
  check("Agent Skills use one progressive registry with unique IDs", skills.discovery === "progressive" && duplicateSkillIds.length === 0, duplicateSkillIds.join(", "));
  check("Every registered Agent Skill entry exists", missingSkillEntries.length === 0, missingSkillEntries.join(", "));
  check("Canonical MCP contains exactly one PlotPickle server", mcpServers.length === 1 && mcpServers[0] === "plotpickle-dev", mcpServers.join(", "));
  check("Cline MCP compatibility mirror matches canonical MCP", !clineMcp || JSON.stringify(clineMcp) === JSON.stringify(mcp));
  check("Runtime Supervisor manifest has unique component owners", runtime.authority === "plotpickle-runtime-supervisor" && duplicateRuntimeIds.length === 0, duplicateRuntimeIds.join(", "));
  check("Future compute Node remains disabled", !futureNode || futureNode.enabled === false);
  check("Feature modules avoid sibling private implementations", moduleAudit.violations.length === 0, moduleAudit.violations.slice(0, 5).map((item) => `${item.source} -> ${item.target}`).join("; "));

  const report = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), status: materialFindings.length ? "violated" : issueReferencedScriptCount ? "healthy-with-cleanup" : "healthy", invariants, materialFindings,
    repository: { fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }, directories: await directoryInventory(files),
    packageSurface: { scriptCount: Object.keys(scripts).length, issueReferencedScriptCount, duplicateCommandBodies: duplicateCommands(scripts) },
    dependencies: { production: Object.keys(packageJson.dependencies ?? {}).length, development: Object.keys(packageJson.devDependencies ?? {}).length, optional: Object.keys(packageJson.optionalDependencies ?? {}).length },
    plugins: { apiVersionDeclared: pluginSource.includes("PLUGIN_API_VERSION"), coreServicesApiDeclared: serviceSource.includes("CORE_SERVICES_API_VERSION") },
    agents: { skillCount: skills.skills.length, duplicateSkillIds, missingSkillEntries, mcpReadyCount: skills.skills.filter((skill) => skill.mcpReady).length },
    mcp: { canonicalServerCount: mcpServers.length, canonicalServers: mcpServers, mirrorMatchesCanonical: !clineMcp || JSON.stringify(clineMcp) === JSON.stringify(mcp) },
    runtime: { componentCount: runtime.components.length, duplicateRuntimeIds, futureNodeEnabled: futureNode?.enabled ?? null },
    modules: { crossModulePrivateImportViolations: moduleAudit.violations, coreCompatibilityBridges: moduleAudit.bridges }, reviewSignals: { globalState: await globalSignals(files) },
    performance: { auditDurationMs: 0, builtOutputs: await outputSizes() },
  };
  report.performance.auditDurationMs = Math.round((performance.now() - started) * 100) / 100;
  if (writeArtifact) {
    const artifact = path.join(ROOT, ".artifacts", "architecture-health"); await mkdir(artifact, { recursive: true });
    await writeFile(path.join(artifact, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"); await writeFile(path.join(artifact, "report.md"), `${markdown(report)}\n`, "utf8");
  }
  return report;
}

async function main() { const report = await runArchitectureHealthAudit(); console.log(markdown(report)); if (report.materialFindings.length) process.exitCode = 1; }
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
