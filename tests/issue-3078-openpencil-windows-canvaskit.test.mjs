import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { repairOpenPencilCanvasKitWindows } from "../build/openpencil/openpencil-windows-canvaskit-compat.mjs";

const originalMain = 'export function wasm(file, ckPath) { return decodeURIComponent(new URL(file, ckPath).pathname); }\n';
const originalRaster = "export function wasmDir(ckPath) { return new URL('.', ckPath).pathname; }\n";
const wasm = Buffer.from("fake-wasm-fixture-only");
const version = "0.16.0";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-openpencil-compat-"));
  const modules = path.join(root, "node_modules");
  const core = path.join(modules, "@open-pencil", "core");
  const cli = path.join(modules, "@open-pencil", "cli");
  const raster = path.join(core, "dist", "io", "formats", "raster");
  const bin = path.join(modules, "canvaskit-wasm", "bin");
  await Promise.all([mkdir(raster, { recursive: true }), mkdir(cli, { recursive: true }), mkdir(bin, { recursive: true })]);
  const mainFile = path.join(core, "dist", "canvaskit.js");
  const rasterFile = path.join(raster, "headless.js");
  const fig = path.join(root, "assets.fig");
  await Promise.all([
    writeFile(path.join(core, "package.json"), JSON.stringify({ version })),
    writeFile(path.join(cli, "package.json"), JSON.stringify({ version })),
    writeFile(path.join(bin, "canvaskit.wasm"), wasm),
    writeFile(mainFile, originalMain),
    writeFile(rasterFile, originalRaster),
    writeFile(fig, "approved-file-must-not-change"),
  ]);
  return { root, mainFile, rasterFile, fig, core };
}

async function withFixture(callback) {
  const files = await fixture();
  try { await callback(files); } finally { await rm(files.root, { recursive: true, force: true }); }
}

test("#3078 managed 0.16.0 patches both Windows WASM loaders and preserves design bytes", async () => withFixture(async (f) => {
  const beforeFig = await readFile(f.fig);
  const result = await repairOpenPencilCanvasKitWindows(f.root, { platform: "win32" });
  assert.deepEqual(result, { state: "ready", changed: 2, mainCount: 1, rasterCount: 1 });
  const [main, raster] = await Promise.all([readFile(f.mainFile, "utf8"), readFile(f.rasterFile, "utf8")]);
  for (const file of [main, raster]) {
    assert.match(file, /import \{ fileURLToPath as __plotpickleFileURLToPath \} from "node:url"/u);
  }
  assert.match(main, /__plotpickleFileURLToPath\(new URL\(file, ckPath\)\)/u);
  assert.match(raster, /__plotpickleFileURLToPath\(new URL\("\.", ckPath\)\)/u);
  assert.doesNotMatch(main, /decodeURIComponent/u);
  assert.deepEqual(await readFile(f.fig), beforeFig);
  for (const file of [f.mainFile, f.rasterFile]) {
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr);
  }
  const again = await repairOpenPencilCanvasKitWindows(f.root, { platform: "win32" });
  assert.deepEqual(again, { state: "ready", changed: 0, mainCount: 1, rasterCount: 1 });
}));

test("#3078 no managed mutation outside Windows", async () => withFixture(async (f) => {
  const result = await repairOpenPencilCanvasKitWindows(f.root, { platform: "linux" });
  assert.deepEqual(result, { state: "not-windows", changed: 0 });
  assert.equal(await readFile(f.mainFile, "utf8"), originalMain);
}));

test("#3078 unknown installed version refuses repair", async () => withFixture(async (f) => {
  await writeFile(path.join(f.core, "package.json"), JSON.stringify({ version: "0.16.1" }));
  await assert.rejects(repairOpenPencilCanvasKitWindows(f.root, { platform: "win32" }), /OPENPENCIL_COMPAT_UNREVIEWED_VERSION/u);
  assert.equal(await readFile(f.mainFile, "utf8"), originalMain);
}));

test("#3078 absent CanvasKit WASM refuses ready status without changes", async () => withFixture(async (f) => {
  await rm(path.join(f.root, "node_modules", "canvaskit-wasm", "bin", "canvaskit.wasm"));
  await assert.rejects(repairOpenPencilCanvasKitWindows(f.root, { platform: "win32" }), /OPENPENCIL_COMPAT_WASM_MISSING/u);
  assert.equal(await readFile(f.mainFile, "utf8"), originalMain);
}));

test("#3078 changed upstream signature refuses repair without partial modifications", async () => withFixture(async (f) => {
  await writeFile(f.rasterFile, "export const harmless = true;\n");
  await writeFile(f.mainFile, "export const unknownLoader = true;\n");
  await assert.rejects(repairOpenPencilCanvasKitWindows(f.root, { platform: "win32" }), /OPENPENCIL_COMPAT_UNEXPECTED_SIGNATURE/u);
  assert.equal(await readFile(f.rasterFile, "utf8"), "export const harmless = true;\n");
}));

test("#3078 optional raster entry absent still repairs mandatory CanvasKit loader", async () => withFixture(async (f) => {
  await rm(f.rasterFile);
  const result = await repairOpenPencilCanvasKitWindows(f.root, { platform: "win32" });
  assert.deepEqual(result, { state: "ready", changed: 1, mainCount: 1, rasterCount: 0 });
}));

test("#3078 deferred Windows setup requires compatibility proof before READY", async () => {
  const setup = await readFile(new URL("../scripts/ensure-openpencil-mcp.ps1", import.meta.url), "utf8");
  assert.match(setup, /openpencil-windows-canvaskit-compat\.mjs/u);
  assert.match(setup, /& \$node\.Source \$compat \$toolRoot/u);
  assert.match(setup, /if \(\$LASTEXITCODE -ne 0\) \{\s+Write-Host "\[WARNING\] OpenPencil 0\.16\.0 CanvasKit compatibility verification failed/u);
  assert.ok(setup.indexOf("& $node.Source $compat $toolRoot") < setup.indexOf('Write-Host "[READY] OpenPencil MCP + CLI'));
});
