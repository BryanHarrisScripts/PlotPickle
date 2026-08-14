import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.PLOTPICKLE_HOME
  ? path.resolve(process.env.PLOTPICKLE_HOME)
  : process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "PlotPickle")
    : path.join(os.homedir(), ".plotpickle");
const logDir = path.join(home, "logs");
const reportPath = path.join(logDir, "vite-native-config-warnings.log");

const sourceRoots = [
  path.join(root, "vite.config.ts"),
  path.join(root, "build"),
  path.join(root, "lib"),
];

function walk(target) {
  if (!statSync(target).isDirectory()) return [target];
  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:ts|tsx|mts|cts)$/.test(entry.name) ? [full] : [];
  });
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function extensionlessRelative(specifier) {
  if (!specifier.startsWith(".")) return false;
  const clean = specifier.split(/[?#]/, 1)[0];
  return !path.posix.extname(clean);
}

const findings = [];
for (const file of sourceRoots.flatMap(walk)) {
  const source = readFileSync(file, "utf8");
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const patterns = [
    /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      const line = lineNumber(source, match.index ?? 0);
      if (extensionlessRelative(specifier)) {
        findings.push(`${relative}:${line}  import ${JSON.stringify(specifier)} without a file extension`);
      } else if (/\.json$/i.test(specifier)) {
        const statement = source.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 80);
        if (!/\bwith\s*\{\s*type\s*:\s*["']json["']\s*\}/.test(statement)) {
          findings.push(`${relative}:${line}  JSON import ${JSON.stringify(specifier)} without import attributes`);
        }
      }
    }
  }
}

findings.sort();
mkdirSync(logDir, { recursive: true });
const generated = new Date().toISOString();
const lines = [
  "PlotPickle Vite native-config compatibility report",
  `Generated: ${generated}`,
  "",
  "These are forward-compatibility advisories for Vite's future native config loader.",
  "They are not current PlotPickle startup failures. Production CI remains the source of truth.",
  "",
  ...findings.map((finding) => `- ${finding}`),
  "",
  `Total advisory candidates: ${findings.length}`,
];
writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(reportPath);
