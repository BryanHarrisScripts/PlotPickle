#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const work = join(root, ".sdk-release");
const compiled = join(work, "compiled");
const staged = join(work, "packages");
const packs = join(work, "tarballs");
const packages = [
  ["types", "@plotpickle/types"],
  ["core", "@plotpickle/sdk"],
  ["plugin", "@plotpickle/plugin-sdk"],
  ["testing", "@plotpickle/testing"],
];
const command = process.argv[2] ?? "validate";

function run(file, args, cwd = root) {
  execFileSync(file, args, { cwd, stdio: "inherit", env: { ...process.env, npm_config_ignore_scripts: "true" } });
}

function manifest(folder) {
  return JSON.parse(readFileSync(join(root, "sdk", folder, "package.json"), "utf8"));
}

function validate() {
  const versions = new Set();
  for (const [folder, expectedName] of packages) {
    const pkg = manifest(folder);
    if (pkg.name !== expectedName) throw new Error(`${folder}: expected package name ${expectedName}`);
    if (!pkg.version.includes("preview")) throw new Error(`${pkg.name}: release must remain preview before RC4`);
    if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) throw new Error(`${pkg.name}: dist must be allow-listed`);
    if (pkg.private) throw new Error(`${pkg.name}: private packages cannot be dry-run packed accurately`);
    if (pkg.scripts?.publish) throw new Error(`${pkg.name}: package-local publishing is forbidden`);
    versions.add(pkg.version);
  }
  if (versions.size !== 1) throw new Error("All SDK packages must use one coordinated version.");
  console.log(`Validated ${packages.length} SDK package contracts at ${[...versions][0]}.`);
}

function rewriteImports(text) {
  return text
    .replaceAll('"../../types/src/index"', '"@plotpickle/types"')
    .replaceAll('"../../plugin/src/testing"', '"@plotpickle/plugin-sdk/testing"')
    .replace(/from "(\.\.?\/[^".]+)"/g, 'from "$1.js"');
}

function build() {
  validate();
  rmSync(work, { recursive: true, force: true });
  mkdirSync(compiled, { recursive: true });
  const tsc = join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
  run(tsc, [
    "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler",
    "--declaration", "--declarationMap", "--sourceMap", "--skipLibCheck",
    "--rootDir", "sdk", "--outDir", compiled,
    "sdk/types/src/index.ts", "sdk/core/src/index.ts", "sdk/plugin/src/index.ts",
    "sdk/plugin/src/testing.ts", "sdk/testing/src/index.ts",
  ]);

  const rootLicense = existsSync(join(root, "LICENSE")) ? readFileSync(join(root, "LICENSE"), "utf8") : "AGPL-3.0-or-later\n";
  for (const [folder] of packages) {
    const target = join(staged, folder);
    mkdirSync(join(target, "dist"), { recursive: true });
    const source = join(compiled, folder, "src");
    cpSync(source, join(target, "dist"), { recursive: true });
    for (const file of ["index.js", "testing.js"]) {
      const path = join(target, "dist", file);
      if (existsSync(path)) writeFileSync(path, rewriteImports(readFileSync(path, "utf8")));
    }
    writeFileSync(join(target, "package.json"), JSON.stringify(manifest(folder), null, 2) + "\n");
    cpSync(join(root, "sdk", folder, "README.md"), join(target, "README.md"));
    writeFileSync(join(target, "LICENSE"), rootLicense);
  }
  console.log(`Built staged packages in ${staged}`);
}

function pack() {
  build();
  mkdirSync(packs, { recursive: true });
  for (const [folder] of packages) run("npm", ["pack", join(staged, folder), "--pack-destination", packs]);
  console.log(`Packed SDK tarballs in ${packs}`);
}

function verify() {
  pack();
  const consumer = join(work, "consumer");
  mkdirSync(consumer, { recursive: true });
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "plotpickle-sdk-consumer", private: true, type: "module" }, null, 2));
  const tarballs = packages.map(([folder]) => join(packs, `${manifest(folder).name.replace("@", "").replace("/", "-")}-${manifest(folder).version}.tgz`));
  run("npm", ["install", "--no-package-lock", ...tarballs], consumer);
  writeFileSync(join(consumer, "index.mjs"), 'import { PLOTPICKLE_PLUGIN_SDK_VERSION } from "@plotpickle/plugin-sdk";\nif (!PLOTPICKLE_PLUGIN_SDK_VERSION) throw new Error("SDK import failed");\n');
  run("node", ["index.mjs"], consumer);
  console.log("Clean external consumer installation verified.");
}

function publish() {
  if (process.env.PLOTPICKLE_APPROVE_SDK_PUBLISH !== "YES") {
    throw new Error("Publishing is locked. Set PLOTPICKLE_APPROVE_SDK_PUBLISH=YES only after explicit release approval.");
  }
  verify();
  for (const [folder] of packages) run("npm", ["publish", join(staged, folder), "--provenance", "--access", "public"]);
}

({ validate, build, pack, verify, publish }[command] ?? (() => { throw new Error(`Unknown command: ${command}`); }))();
