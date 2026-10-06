import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
const forbidden = /^(?:git(?:\+[^:]+)?:|github:|git@)/iu;
const findings = [];

function inspectSpec(value, location) {
  if (typeof value === "string" && forbidden.test(value.trim())) findings.push({ location, spec: value });
}

for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
  for (const [name, spec] of Object.entries(manifest[section] ?? {})) inspectSpec(spec, `package.json ${section}.${name}`);
}

function inspectOverrides(value, location = "package.json overrides") {
  if (typeof value === "string") {
    inspectSpec(value, location);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [name, nested] of Object.entries(value)) inspectOverrides(nested, `${location}.${name}`);
}
inspectOverrides(manifest.overrides);

for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  inspectSpec(entry?.resolved, `package-lock.json ${packagePath || "<root>"}.resolved`);
}

if (findings.length) {
  console.error("[PlotPickle dependency policy error] EALLOWGIT: production dependency installation may not fetch Git packages.");
  for (const finding of findings) console.error(`  - ${finding.location}: ${finding.spec}`);
  console.error("This is a deterministic PlotPickle dependency-graph error. Retrying the same runtime cannot repair it.");
  process.exitCode = 42;
} else {
  console.log("[OK] Production dependency transport policy is Git-free.");
}
