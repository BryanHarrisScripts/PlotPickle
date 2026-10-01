import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const appDataRoot = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "PlotPickle")
  : path.join(os.homedir(), ".plotpickle");
const logDirectory = path.join(appDataRoot, "logs");
const logPath = path.join(logDirectory, "vite-native-config-warnings.log");
const ESC = "\u001b[";
const cyan = `${ESC}96m`;
const reset = `${ESC}0m`;

function installedPackageVersion(packagePath) {
  const file = path.join(projectRoot, "node_modules", ...packagePath.split("/"), "package.json");
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return typeof parsed.version === "string" ? parsed.version : "unknown";
  } catch {
    return "not-installed";
  }
}

const runtimeVersions = {
  react: installedPackageVersion("react"),
  reactServerDomWebpack: installedPackageVersion("react-server-dom-webpack"),
  vinext: installedPackageVersion("vinext"),
  cloudflareVitePlugin: installedPackageVersion("@cloudflare/vite-plugin"),
};

const sourceRoots = [
  path.join(projectRoot, "vite.config.ts"),
  path.join(projectRoot, "build"),
  path.join(projectRoot, "lib"),
];

function sourceFiles(entry) {
  if (!statSafe(entry)) return [];
  const stat = statSync(entry);
  if (stat.isFile()) return /\.(?:ts|tsx|mts|mjs|js)$/.test(entry) ? [entry] : [];
  const files = [];
  for (const child of readdirSync(entry)) {
    const childPath = path.join(entry, child);
    const childStat = statSafe(childPath);
    if (!childStat) continue;
    if (childStat.isDirectory()) files.push(...sourceFiles(childPath));
    else if (/\.(?:ts|tsx|mts|mjs|js)$/.test(childPath)) files.push(childPath);
  }
  return files;
}

function statSafe(value) {
  try { return statSync(value); } catch { return null; }
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function relativeDisplay(file) {
  return path.relative(projectRoot, file).replaceAll("\\", "/");
}

function scanFile(file) {
  const source = readFileSync(file, "utf8");
  const findings = [];
  const importPattern = /\b(?:import|export)\s+(?:[^"'\n]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (/\.(?:[cm]?[jt]sx?|json|css|scss|sass|less|wasm|node)$/i.test(specifier)) continue;
    findings.push(`  - import "${specifier}" without a file extension (${relativeDisplay(file)}:${lineNumber(source, match.index ?? 0)}). Add the file extension`);
  }

  const jsonPattern = /\bimport\s+[^"'\n]+?\s+from\s+["'](\.{1,2}\/[^"']+\.json)["'](?!\s+with\s*\{\s*type\s*:\s*["']json["']\s*\})/g;
  for (const match of source.matchAll(jsonPattern)) {
    findings.push(`  - JSON import "${match[1]}" without import attributes (${relativeDisplay(file)}:${lineNumber(source, match.index ?? 0)}). Add with { type: 'json' }`);
  }
  return findings;
}

const findings = sourceRoots.flatMap((root) => sourceFiles(root)).flatMap(scanFile);
mkdirSync(logDirectory, { recursive: true });
const timestamp = new Date().toISOString();
const body = [
  "PlotPickle Vite native-loader compatibility report",
  `Generated: ${timestamp}`,
  "",
  "These are forward-compatibility advisories for Vite's future native config loader.",
  "They are not startup failures and are intentionally kept out of the normal PlotPickle command window.",
  "",
  "Known development-runtime advisory:",
  "  - eval() is not supported in this environment",
  "    PlotPickle intentionally runs the local Vite app with NODE_ENV=development for the source-on-machine workflow.",
  "    React emits this exact message only from its development diagnostics when eval is unavailable. PlotPickle leaves it visible instead of masking runtime warnings.",
  `    Runtime versions: React ${runtimeVersions.react}; react-server-dom-webpack ${runtimeVersions.reactServerDomWebpack}; Vinext ${runtimeVersions.vinext}; @cloudflare/vite-plugin ${runtimeVersions.cloudflareVitePlugin}.`,
  "    React states the eval path is not used in production. Production build and Architecture Verification remain separate correctness authorities; this advisory is documented rather than treated as a product failure.",
  "",
  ...(findings.length ? findings : ["No extensionless relative imports or JSON import-attribute warnings were found by the local scanner."]),
  "",
].join("\r\n");
writeFileSync(logPath, body, "utf8");
console.log(`${cyan}[INFO]${reset} Vite native-loader compatibility details saved to ${logPath}`);
