#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [command = "help", target = "."] = process.argv.slice(2);

function fail(message) {
  console.error(`PlotPickle plugin validation failed: ${message}`);
  process.exitCode = 1;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function validateManifest(manifest, root) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") return ["plugin manifest must be a JSON object"];
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(manifest.id ?? "")) errors.push("id must be a stable lowercase identifier");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? "")) errors.push("version must use semantic versioning");
  if (manifest.apiVersion !== "1.0.0") errors.push("apiVersion must be 1.0.0");
  if (!Array.isArray(manifest.permissions)) errors.push("permissions must be an array");
  if (!Array.isArray(manifest.capabilities)) errors.push("capabilities must be an array");
  if (!manifest.entryPoint || !fs.existsSync(path.resolve(root, manifest.entryPoint))) errors.push("entryPoint must reference an existing file");
  return errors;
}

if (command === "validate") {
  const root = path.resolve(target);
  const manifestPath = fs.statSync(root).isDirectory() ? path.join(root, "plotpickle.plugin.json") : root;
  const manifest = readJson(manifestPath);
  if (manifest) {
    const errors = validateManifest(manifest, path.dirname(manifestPath));
    if (errors.length) errors.forEach(fail);
    else console.log(`Valid PlotPickle plugin: ${manifest.id}@${manifest.version}`);
  }
} else {
  console.log("Usage: node scripts/plotpickle-plugin.mjs validate <plugin-folder-or-manifest>");
}
