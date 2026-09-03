import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("..", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");

const runtimeDependencies = [
  "@cloudflare/vite-plugin",
  "@mastra/core",
  "@tailwindcss/postcss",
  "@vitejs/plugin-react",
  "@vitejs/plugin-rsc",
  "ai",
  "drizzle-orm",
  "libsodium-wrappers-sumo",
  "next",
  "react",
  "react-dom",
  "tailwindcss",
  "vinext",
  "vite",
  "wrangler",
];

const developerDependencies = [
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "drizzle-kit",
  "eslint",
  "eslint-config-next",
  "typescript",
];

test("#1654 exposes every source-runtime requirement through the standard production profile", async () => {
  const manifest = JSON.parse(await source("package.json"));
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), runtimeDependencies);
  assert.deepEqual(Object.keys(manifest.devDependencies).sort(), developerDependencies);
});

test("#1654 installs and repairs persistent Windows runtimes without developer dependencies", async () => {
  const [launcher, runtime] = await Promise.all([
    source("Start-PlotPickle.bat"),
    source("scripts/windows-runtime.mjs"),
  ]);
  assert.match(launcher, /npm ci --prefix "%PLOTPICKLE_RUNTIME_DIR%" --omit=dev/);
  assert.match(launcher, /npm install --prefix "%PLOTPICKLE_RUNTIME_DIR%" --omit=dev/);
  assert.doesNotMatch(launcher, /--include=dev/);
  assert.match(runtime, /"install"[\s\S]*?"--omit=dev"/);
  assert.doesNotMatch(runtime, /coreReady[\s\S]*?drizzle-kit/);
});

test("#1654 prunes the staged Windows tree and records the production profile", async () => {
  const stage = await source("scripts/windows-installer/stage.mjs");
  assert.match(stage, /"prune"[\s\S]*?"--omit=dev"[\s\S]*?"--ignore-scripts"/);
  assert.match(stage, /manifest\.dependencyProfile = "production"/);
  assert.match(stage, /manifest\.developerDependenciesBundled = false/);
  assert.match(stage, /Developer-only dependency leaked into the runtime/);
});

test("#1654 reports only packages required by the user runtime", async () => {
  const setup = await source("scripts/windows-setup-report.mjs");
  for (const packageName of runtimeDependencies) assert.ok(setup.includes(`"${packageName}"`), `${packageName} must remain in setup verification`);
  for (const packageName of developerDependencies) assert.ok(!setup.includes(`"${packageName}"`), `${packageName} must not be required during user setup`);
});
