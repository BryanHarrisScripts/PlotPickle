import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Windows runtime fingerprints the dependency set by platform and architecture", async () => {
  const runtime = await source("scripts/windows-runtime.mjs");
  assert.match(runtime, /function runtimeFingerprint\(\)/);
  assert.match(runtime, /`\$\{lockHash\(\)\}-\$\{process\.platform\}-\$\{process\.arch\}`/);
  assert.match(runtime, /PLOTPICKLE_RUNTIME_FINGERPRINT/);
  assert.match(runtime, /PLOTPICKLE_RUNTIME_PLATFORM/);
  assert.match(runtime, /PLOTPICKLE_RUNTIME_ARCH/);

  const runtimePath = fileURLToPath(new URL("../scripts/windows-runtime.mjs", import.meta.url));
  const projectRoot = fileURLToPath(root);
  const { stdout } = await execFileAsync(process.execPath, [runtimePath, "describe"], { cwd: projectRoot });
  assert.match(stdout, /Dependency fingerprint: [a-f0-9]{20}/);
  assert.match(stdout, new RegExp(`Runtime fingerprint: [a-f0-9]{20}-${process.platform}-${process.arch}`));
  assert.match(stdout, new RegExp(`Runtime platform: ${process.platform} ${process.arch}`));
});

test("Windows runtime verifies and repairs the actual Rolldown native file", async () => {
  const runtime = await source("scripts/windows-runtime.mjs");
  for (const contract of [
    "@rolldown/binding-win32-x64-msvc",
    "@rolldown/binding-win32-arm64-msvc",
    "nativeBindingStatus",
    "nativeBindingReady",
    "runtimeReady",
    "verifyModules",
    "installedRolldownVersion",
    "repairNativeBinding",
    "spawnSync",
    '"--no-save"',
    '"--package-lock=false"',
    "manifest.main",
    "existsSync(entryPath)",
    'command === "verify-runtime"',
    'command === "verify-modules"',
    'command === "repair-native"',
  ]) assert.ok(runtime.includes(contract), `Missing Windows native-runtime contract: ${contract}`);
  assert.doesNotMatch(runtime, /function runtimeReady[\s\S]{0,200}return coreReady\(modulesPath\);/);
});

test("Windows launcher repairs a damaged native runtime before starting", async () => {
  const launcher = await source("Start-PlotPickle.bat");
  for (const contract of [
    "PLOTPICKLE_RUNTIME_FINGERPRINT",
    "PLOTPICKLE_NATIVE_BINDING",
    'node "%RUNTIME_MANAGER%" verify-runtime',
    "Windows native binding is missing or damaged",
    'node "%RUNTIME_MANAGER%" repair-native "%PLOTPICKLE_RUNTIME_MODULES%"',
    'node "%RUNTIME_MANAGER%" reset-current',
    "The missing Windows native binding was repaired without rebuilding the full runtime.",
    "including the Windows native binding",
    'call "%VITE_CMD%" --version',
  ]) assert.ok(launcher.includes(contract), `Launcher is missing native-runtime recovery: ${contract}`);
  assert.match(launcher, /:dependencies_ready[\s\S]*verify-runtime[\s\S]*call "%VITE_CMD%" --version/);
  assert.match(launcher, /mark-ready[\s\S]*if errorlevel 1 exit \/b 1/);
});

test("Windows server smoke uses Node directly and saves startup diagnostics", async () => {
  const smoke = await source("scripts/windows-server-smoke.mjs");
  for (const contract of [
    "spawn(",
    "node_modules",
    "vite.js",
    '"--host", "127.0.0.1"',
    '"--strictPort"',
    "fetch(url",
    "AbortSignal.timeout",
    "windows-server-smoke.log",
    "saveLog",
    'server.kill("SIGTERM")',
  ]) assert.ok(smoke.includes(contract), `Windows server smoke is missing: ${contract}`);
  assert.doesNotMatch(smoke, /Start-Process|Invoke-WebRequest/);
});

test("Windows release validation repairs the binding and runs the captured server smoke", async () => {
  const workflow = await source(".github/workflows/release-candidate.yml");
  for (const contract of [
    'node: "24.15.0"',
    "Verify or repair Windows Rolldown native binding",
    "windows-runtime.mjs verify-modules node_modules",
    "windows-runtime.mjs repair-native node_modules",
    "Start clean-machine Windows server",
    "windows-server-smoke.mjs .",
    "Upload Windows server diagnostic",
    "windows-server-smoke.log",
  ]) assert.ok(workflow.includes(contract), `Windows release validation is missing: ${contract}`);
});

test("Windows native-runtime regression test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /windows-native-runtime\.test\.mjs/);
  assert.equal(packageJson.scripts["test:windows-runtime"], "node --test tests/windows-native-runtime.test.mjs");
});
