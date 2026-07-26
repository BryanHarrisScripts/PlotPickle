import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const folder = path.resolve(process.argv[2] ?? "");
assert.ok(folder && existsSync(folder), "Release package folder does not exist.");
const manifest = JSON.parse(readFileSync(path.join(folder, "release-manifest.json"), "utf8"));
assert.equal(manifest.product, "PlotPickle");
assert.equal(manifest.projectFormat, ".ppf");
assert.equal(manifest.localOnly, true);
for (const file of [
  ".openai/hosting.json",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "README.md",
  "worker/index.ts",
  "db/index.ts",
  "lib/project-package.ts",
  "build/local-project-gateway.ts",
  "scripts/windows-runtime.mjs",
  "scripts/windows-server-smoke.mjs",
]) {
  assert.ok(existsSync(path.join(folder, file)), `Missing packaged file: ${file}`);
}
const launcher = manifest.platform === "windows" ? "Start-PlotPickle.bat" : manifest.platform === "macos" ? "Start-PlotPickle.command" : "start-plotpickle.sh";
assert.ok(existsSync(path.join(folder, launcher)), `Missing ${manifest.platform} launcher.`);
const launcherSource = readFileSync(path.join(folder, launcher), "utf8");
assert.match(launcherSource, /127\.0\.0\.1/);
assert.match(launcherSource, /PlotPickle/);
assert.ok(!launcherSource.includes("0.0.0.0"), "Release launcher must remain loopback-only.");
console.log(`Verified ${manifest.platform} PlotPickle ${manifest.version} package at ${folder}`);
