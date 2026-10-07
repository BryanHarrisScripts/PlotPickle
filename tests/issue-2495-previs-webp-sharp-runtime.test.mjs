import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2495 makes Sharp a direct production dependency", async () => {
  const [packageText, lockText] = await Promise.all([
    read("package.json"),
    read("package-lock.json"),
  ]);
  const packageJson = JSON.parse(packageText);
  const lock = JSON.parse(lockText);

  const version = packageJson.dependencies.sharp;
  assert.match(version, /^0\.35\.\d+$/u);
  assert.ok(Number(version.split(".")[2]) >= 4, "preserve the supported Sharp patch floor");
  assert.equal(packageJson.overrides.sharp, version);
  assert.equal(lock.packages[""].dependencies.sharp, version);
  assert.equal(lock.packages["node_modules/sharp"].version, version);
});

test("#2495 startup refuses a runtime that cannot load Sharp and can repair Windows Sharp", async () => {
  const [runtime, launcher] = await Promise.all([
    read("scripts/windows-runtime.mjs"),
    read("Start-PlotPickle.bat"),
  ]);

  assert.match(runtime, /createRequire/u);
  assert.match(runtime, /function sharpRuntimeStatus\(modulesPath\)/u);
  assert.match(runtime, /requireFromRuntime\("sharp"\)/u);
  assert.match(runtime, /runtimeReady\(modulesPath\)[\s\S]*sharpRuntimeReady\(modulesPath\)/u);
  assert.match(runtime, /const sharp = sharpRuntimeStatus\(modulesPath\)/u);
  assert.match(runtime, /WINDOWS_SHARP_BINDINGS/u);
  assert.match(runtime, /@img\/sharp-win32-x64/u);
  assert.match(runtime, /function repairSharpRuntime\(modulesPath\)/u);
  assert.match(runtime, /command === "repair-sharp"/u);

  assert.match(launcher, /repair-sharp "%PLOTPICKLE_RUNTIME_MODULES%"/u);
  assert.match(launcher, /Sharp Windows image runtime/u);
});

test("#2495 Previs WebP export does not statically load Sharp before the route can handle failure", async () => {
  const [encoder, storage, common, route] = await Promise.all([
    read("build/previs-graphic-novel-webp.ts"),
    read("build/media-storage-common.ts"),
    read("build/media-provider-common.ts"),
    read("app/api/previs/graphic-novel/export/route.ts"),
  ]);

  assert.doesNotMatch(encoder, /import sharp from "sharp"/u);
  assert.match(encoder, /await import\("sharp"\)/u);
  assert.match(encoder, /Fully restart PlotPickle so startup can repair Sharp/u);
  assert.match(encoder, /from "\.\/media-storage-common"/u);
  assert.doesNotMatch(encoder, /from "\.\/media-provider-common"/u);

  assert.match(storage, /ASSET_PATH = LOCAL_GENERATED_VISUAL_ASSET_PREFIX/u);
  assert.match(storage, /assetsDirectory/u);
  assert.match(common, /from "\.\/media-storage-common"/u);
  assert.match(common, /export \{[\s\S]*assetsDirectory[\s\S]*safeAssetStem/u);

  assert.match(route, /buildPrevisGraphicNovelWebp/u);
  assert.match(route, /error instanceof Error \? error\.message/u);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
});
