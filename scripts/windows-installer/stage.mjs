import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  throw new Error("The Windows installer stage must be built on Windows so native dependencies match the target platform.");
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../..");
const stage = path.join(root, "releases", "stage", "PlotPickle-Windows");
const appModules = path.join(root, "node_modules");
const nodeRoot = path.dirname(process.execPath);
const stagedModules = path.join(stage, "node_modules");
const stagedNode = path.join(stage, "runtime", "node");

assert.ok(existsSync(stage), `Windows package stage is missing: ${stage}`);
assert.ok(existsSync(path.join(stage, "release-manifest.json")), "Windows release manifest is missing.");
assert.ok(existsSync(appModules), "node_modules is missing. Run npm ci before building the installer.");
for (const required of ["node.exe", "npm.cmd"]) {
  assert.ok(existsSync(path.join(nodeRoot, required)), `The active Node distribution does not contain ${required}.`);
}
for (const required of ["vite", "react", "vinext", "rolldown", "@mastra"]) {
  assert.ok(existsSync(path.join(appModules, required)), `Required installed dependency is missing: ${required}`);
}

rmSync(stagedModules, { recursive: true, force: true });
rmSync(stagedNode, { recursive: true, force: true });
mkdirSync(path.dirname(stagedNode), { recursive: true });

console.log("Bundling the verified Windows dependency tree...");
cpSync(appModules, stagedModules, { recursive: true, dereference: false });
console.log(`Bundling Node ${process.versions.node} from ${nodeRoot}...`);
cpSync(nodeRoot, stagedNode, { recursive: true, dereference: false });

const manifestPath = path.join(stage, "release-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.distribution = "windows-installer";
manifest.dependenciesBundled = true;
manifest.bundledNode = {
  version: process.versions.node,
  architecture: process.arch,
  executable: "runtime/node/node.exe",
  npm: "runtime/node/npm.cmd",
};
manifest.userDataHome = "%LOCALAPPDATA%/PlotPickle";
manifest.applicationHome = "%LOCALAPPDATA%/Programs/PlotPickle";
manifest.updateModel = "signed-reinstall";
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const installerManifest = {
  format: "plotpickle-windows-installer-stage",
  version: 1,
  applicationVersion: manifest.version,
  bundledNodeVersion: process.versions.node,
  bundledDependencies: true,
  nativeLauncher: "PlotPickle.exe",
  userDataSeparated: true,
  optionalCompanions: ["BUZZ", "Ollama", "ComfyUI"],
};
writeFileSync(path.join(stage, "installer-manifest.json"), `${JSON.stringify(installerManifest, null, 2)}\n`, "utf8");

console.log(`Prepared Windows installer stage at ${stage}`);
