import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const platform = (process.argv[2] ?? "").toLowerCase();
if (!["windows", "macos", "linux"].includes(platform)) throw new Error("Use windows, macos, or linux.");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const folderName = `PlotPickle-${platform === "macos" ? "macOS" : platform[0].toUpperCase() + platform.slice(1)}`;
const stageRoot = path.join(root, "releases", "stage");
const destination = path.join(stageRoot, folderName);
const exclusions = new Set([".git", ".next", ".wrangler", "dist", "node_modules", "releases", ".env", ".env.local"]);

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });

const runtimeDirectories = [
  ".openai",
  "app",
  "build",
  "data",
  "db",
  "docs",
  "lib",
  "public",
  "schema",
  "scripts",
  "tests",
  "worker",
];

for (const entry of runtimeDirectories) {
  const source = path.join(root, entry);
  if (!existsSync(source)) throw new Error(`Required runtime directory is missing: ${entry}`);
  cpSync(source, path.join(destination, entry), {
    recursive: true,
    filter(item) {
      const relative = path.relative(root, item);
      return !relative.split(path.sep).some((part) => exclusions.has(part));
    },
  });
}
for (const file of ["package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "README.md", "LICENSE", "LICENSES.md", "CONTRIBUTING.md", "TRADEMARKS.md"]) {
  if (existsSync(path.join(root, file))) cpSync(path.join(root, file), path.join(destination, file));
}
const launcher = platform === "windows" ? "Start-PlotPickle.bat" : platform === "macos" ? "Start-PlotPickle.command" : "start-plotpickle.sh";
cpSync(path.join(root, launcher), path.join(destination, launcher));
if (platform !== "windows") chmodSync(path.join(destination, launcher), 0o755);
if (platform === "windows") {
  for (const file of ["Repair-PlotPickle.bat", "Update-PlotPickle.bat"]) if (existsSync(path.join(root, file))) cpSync(path.join(root, file), path.join(destination, file));
}
const manifest = {
  product: "PlotPickle",
  version: packageJson.version,
  candidate: true,
  platform,
  launcher,
  node: packageJson.engines?.node ?? ">=22.13.0",
  localOnly: true,
  projectFormat: ".ppf",
  createdAt: process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() : new Date().toISOString(),
};
writeFileSync(path.join(destination, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const files = [];
function walk(folder) {
  for (const name of readdirSync(folder).sort()) {
    const item = path.join(folder, name);
    const info = statSync(item);
    if (info.isDirectory()) walk(item);
    else files.push(path.relative(destination, item).split(path.sep).join("/"));
  }
}
walk(destination);
writeFileSync(path.join(destination, "FILES.txt"), `${files.join("\n")}\n`);
console.log(destination);
